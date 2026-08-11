// Server-only: JEDNA čtecí cesta k hlasovacímu záznamu PSP10.
//
// ── Proč tenhle modul vznikl (2026-08-10) ───────────────────────────────────────
// getVoteRecord.ts a getKompas.ts si každý četl SVÝCH pět stejných relací
// (vote_event, vote_ballot, clubByMandate, mandate, person) se svými vlastními
// literálovými limity. Dvě kopie jedné čtecí cesty nad jedním grafem znamenají dvě
// místa, kde se dá zapomenout na práh připravenosti, a dvě různá čísla na dvou
// plochách o týchž hlasech. Tady je ta cesta jedna a prahy jsou její součástí.
//
// ── Co to stojí (změřeno na živém store, PSP10, 3 kola) ─────────────────────────
//   listVoteEvents    2 030 řádků                                    251 ms
//   listVoteBallots   406 000 řádků         15 758 / 15 987 / 15 984 ms  ← celá cena
//   registr (kluby + mandáty + osoby)                                 779 ms
//   deriveVoteRecord (neomezená kronika)                          459–555 ms
// Měření drží features/profile/getRebellionRecord.ts, které tuhle cenu platí taky.
// V getVoteRecord.ts stálo do 2026-08-10 „~tens of ms“ — o dva řády vedle.
//
// ── Rozsahy ────────────────────────────────────────────────────────────────────
// `react.cache()` je per POŽADAVEK: dedupluje čtení mezi loadery jedné stránky
// (/hlasovani volá readVoteEvents z getVoteRecord i z getVoteThemes — dřív to byla
// dvě čtení). Napříč požadavky memoizují loadery svůj ODVOZENÝ výsledek přes
// ledgerMemo.ts; syrové hlasy se nikdy nedrží.
//
// Limity čtou `KG_READ_CAP` (lib/db/readCap.ts) — jeden strop pro celou aplikaci.
// Malý limit navíc v PGlite vede na průchod primárním klíčem místo indexu (viz
// CLAUDE.md, /zebricek 2026-08-04).

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { getStore } from "@/lib/db/store";
import type { VoteBallotRow, VoteEventRow, VoteTagRow } from "@/lib/db/types";
import type { EventIn } from "./record/derive";

export const TERM = "PSP10";

/** Readiness floors for the vote ledger itself (the kg cardinality floors in
 * lib/db/readiness.ts guard graph nodes, not ballots). ≈70 % of the 2026-07
 * ingest (2 030 events / 406 000 ballots) — below these a half-ingested ledger
 * would publish real-looking discipline numbers off a partial record. */
export const EVENT_FLOOR = 1400;
export const BALLOT_FLOOR = 280_000;

/** Klub / osoba / jméno pro mandáty období — registr bez jediného hlasu.
 *  Vlastní ho `readLedger()`, ale čte se i samostatně: /kompas potřebuje jména
 *  a kluby k ~4 000 hlasům vybraných hlasování, ne k 406 000. */
export interface RegistryRead {
  clubByMandate: ReadonlyMap<number, string>;
  personByMandate: ReadonlyMap<number, number>;
  nameByPerson: ReadonlyMap<number, string>;
}

/** Whole-ledger read + registry, floors already applied. */
export interface LedgerRead {
  events: EventIn[];
  /** Raw rows — structurally a `BallotIn`. Deliberately NOT re-mapped: a second
   *  406 000-object allocation buys nothing but memory. */
  ballots: readonly VoteBallotRow[];
  clubByMandate: ReadonlyMap<number, string>;
  personByMandate: ReadonlyMap<number, number>;
  nameByPerson: ReadonlyMap<number, string>;
}

/** The one row→input projection. Both loaders derive from the same event shape.
 *
 *  `published` nese sloupce, které sněmovna sama zveřejnila u toho hlasování —
 *  jediné místo v aplikaci, kde se z `vote_event` čtou. Předávají se DOSLOVA,
 *  včetně `null`: chybějící sloupec je v kontrole (record/reconcile.ts) neporovnaný
 *  slot, nikdy domyšlená nula. */
export function toEventIn(e: VoteEventRow): EventIn {
  return {
    pspId: e.pspId,
    published: { yes: e.yes, no: e.no, abstain: e.abstain, notVoting: e.notVoting },
    votedOn: e.votedOn,
    votedAt: e.votedAt,
    sessionNo: e.sessionNo,
    voteNo: e.voteNo,
    outcome: e.outcome,
    voided: e.voided,
    titleLong: e.titleLong,
    titleShort: e.titleShort,
    titleNorm: e.titleNorm,
    sourceUrl: e.sourceUrl,
  };
}

/** Roll calls of the term. Per-request shared: /hlasovani reads them for the record
 *  AND for the theme filter. Empty array = no store / unreadable (never an error). */
export const readVoteEvents = cache(async function readVoteEvents(): Promise<VoteEventRow[]> {
  const store = await getStore();
  if (!store) return [];
  return store.listVoteEvents({ termCode: TERM, limit: KG_READ_CAP });
});

/** Silver-layer theme tags. Per-request shared by /kompas and the theme filter. */
export const readVoteTags = cache(async function readVoteTags(): Promise<VoteTagRow[]> {
  const store = await getStore();
  if (!store) return [];
  return store.listVoteTags({ limit: KG_READ_CAP });
});

/**
 * Kluby, mandáty a jména — JEDNA definice registru pro obě plochy.
 *
 * Vyňato z `readLedger()` (2026-08-11), ne zkopírováno: /kompas si k jmenovitým
 * hlasům ~20 vybraných hlasování potřebuje týž registr, ale ne 406 000 hlasů,
 * kvůli kterým by celý `readLedger()` volat musel. Cena na živém store:
 * clubByMandate 28 ms · listMandates 12 ms · listPersons 314 ms.
 */
export const readRegistry = cache(async function readRegistry(): Promise<RegistryRead | null> {
  const store = await getStore();
  if (!store) return null;
  const clubByMandate = await store.clubByMandate(TERM);
  const mandates = await store.listMandates({ termCode: TERM, limit: KG_READ_CAP });
  const personByMandate = new Map(mandates.map((m) => [m.pspId, m.personPspId]));
  const persons = await store.listPersons({ limit: KG_READ_CAP });
  const nameByPerson = new Map(persons.map((p) => [p.pspId, p.nameFull]));
  return { clubByMandate, personByMandate, nameByPerson };
});

/**
 * Jmenovité hlasy VYJMENOVANÝCH hlasování — indexované čtení přes
 * `vote_ballot_vote_idx` (lib/db/store.ts `BallotListOptions`).
 *
 * Existuje pro /kompas: jediná věc, kterou ta plocha z hlasů opravdu potřebuje,
 * jsou poziční hlasy ~20 vybraných hlasování, a do 2026-08-11 si kvůli nim četla
 * celou relaci. Prázdný seznam id vrací prázdno, ne celé období.
 */
export async function readBallotsForVotes(voteIds: readonly number[]): Promise<VoteBallotRow[]> {
  if (voteIds.length === 0) return [];
  const store = await getStore();
  if (!store) return [];
  return store.listVoteBallots({ voteIds, limit: KG_READ_CAP });
}

/**
 * The whole ledger, ready to derive from. `null` = no store, PGlite unavailable, or
 * the record is BELOW its readiness floor — and the floor runs HERE, before any
 * caller can memoize, so a half-ingested ledger is never frozen for a TTL window.
 */
export const readLedger = cache(async function readLedger(): Promise<LedgerRead | null> {
  const store = await getStore();
  if (!store) return null;

  const events = await readVoteEvents();
  if (events.length < EVENT_FLOOR) {
    if (events.length > 0) {
      reportLoaderFailure(
        "votetrack/readLedger",
        new Error(`vote_event below readiness floor: ${events.length}<${EVENT_FLOOR}`),
      );
    }
    return null;
  }

  const ballots = await store.listVoteBallots({ termCode: TERM, limit: KG_READ_CAP });
  if (ballots.length < BALLOT_FLOOR) {
    reportLoaderFailure(
      "votetrack/readLedger",
      new Error(`vote_ballot below readiness floor: ${ballots.length}<${BALLOT_FLOOR}`),
    );
    return null;
  }

  const registry = await readRegistry();
  if (registry === null) return null;

  return { events: events.map(toEventIn), ballots, ...registry };
});
