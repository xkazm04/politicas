// Server-only loader Vote-Collision Engine (/penize/strety): tenká IO slupka
// nad čistou derivací (deriveCollisions.ts). Skládá TŘI už existující čtecí
// cesty, nic nového nematerializuje a NIC NEZAPISUJE:
//   • peněžní vrstvu grafu přes loadMoneyLayer + mapLinkedToTie (JEDINÉ místo,
//     kde se linked_to hrana stává vazbou — paritní pravidlo se veze zdarma),
//   • reálný hlasovací ledger PSP10 přes SDÍLENOU cestu features/votetrack/
//     ledgerRead.ts (readLedger — prahy připravenosti jsou její součástí),
//   • legislativní vrstvu (bill uzly + amends hrany + law uzly pro názvy).
// Degraduje na null přesně jako loadery, na kterých stojí: žádný store, ledger
// pod floorem, prázdná peněžní vrstva nebo chyba čtení → null, nikdy částečný
// tvar. `server-only` udělá z importu v klientské komponentě build-time chybu.
//
// ── ZKRAT PRÁZDNÉ BRÁNY (2026-08-11) ────────────────────────────────────────
// Vstupní brána joinu vyžaduje `review_state === "verified"` (statuteRelevance
// .tieEntersJoin). Na živém grafu je VŠECH 211 vazeb `pending_review`, takže
// `tiesEntering` = 0 a kandidátů je nula bez ohledu na to, co je v ledgeru.
// Přesto se každý požadavek četlo ~410 000 řádků (2 030 hlasování + 406 000
// lístků + mandáty + celá legislativní vrstva) — změřeno 15 800 ms studeně,
// 10 409 ms znovu — aby se vykreslily čtyři sloupce nul.
// Brána se proto počítá PŘED čtením ledgeru: když je prázdná, hlasovací ani
// legislativní vrstva se nečte VŮBEC a coverage o hlasování je `null`, ne nula
// (viz CollisionCoverage — dva druhy nuly). Plocha to říká vlastní větou.
//
// ── MEMOIZACE ───────────────────────────────────────────────────────────────
// `react.cache()` má rozsah JEDNOHO požadavku. Odvozený výsledek se proto drží
// napříč požadavky na `MONEY_MEMO_TTL_MS` (importované, nikdy nepředeklarované)
// stejným primitivem, jaký používá /hlasovani (createLedgerMemo). `null` se
// nememoizuje nikdy — jeden výpadek PGlite by jinak na den zmrazil větu
// „datová vrstva je nedostupná".
// PRÁZDNÝ VÝSLEDEK SE NAOPAK MEMOIZUJE, a to je vědomý rozdíl proti ledgerMemo
// /hlasovani i proti chamberMemo /zebricek: tam je prázdno k nerozeznání od
// nenaingestovaného záznamu, kdežto tady je nula kandidátů PLNOHODNOTNÝ
// VÝSLEDEK odvozený z reálných čtení (vazby se přečetly, brána je zavřená).
// Zahodit ji jako „podezřelou" by znamenalo platit celý průchod znovu za to,
// že produkt funguje, jak má.

import "server-only";
import { cache } from "react";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
// JEDNA čtecí cesta k hlasovacímu záznamu (prahy připravenosti uvnitř) a JEDNA
// politika memoizace nad grafem — obojí vlastní votetrack; tenhle modul je jen
// importuje, aby dvě plochy nad jedním ledgerem nemohly mít dvě různá pravidla.
import { readLedger, readVoteEvents } from "@/features/votetrack/ledgerRead";
import { createLedgerMemo } from "@/features/votetrack/ledgerMemo";
import { decodeUnl, parseUnl } from "@/lib/ingest/unl";
import { readZipMap } from "@/lib/ingest/zip";
import { loadMoneyLayer, mapLinkedToTie, pspIdFromNodeId } from "../moneyLoader";
import type { CollisionBillIn, CollisionData, CollisionTieIn } from "./collisionTypes";
import { deriveCollisions } from "./deriveCollisions";
import { tieEntersJoin } from "./statuteRelevance";
import { buildAgendaTiskMap, type AgendaTisk } from "./voteAgenda";

/* Pořad schůze (schuze.zip, týž lokální cache adresář jako ingest —
 * scripts/data-analysis/ingest.ts). bod_schuze.unl má ~20 MB; mapa se proto
 * memoizuje na (mtime, size) souboru, ne na každý požadavek. Chybějící nebo
 * nečitelný dump NENÍ chyba stránky: joinu zbude záložní titulkové pravidlo
 * a výstup to přizná (agendaAvailable=false). */
const SCHUZE_ZIP = join(process.env.PSP_CACHE_DIR || "./.data/psp", "schuze.zip");
let agendaMemo: { key: string; map: Map<string, AgendaTisk> } | null = null;

function loadAgendaTiskMap(): Map<string, AgendaTisk> | undefined {
  try {
    if (!existsSync(SCHUZE_ZIP)) return undefined;
    const st = statSync(SCHUZE_ZIP);
    const key = `${st.mtimeMs}:${st.size}`;
    if (agendaMemo?.key === key) return agendaMemo.map;
    const members = readZipMap(new Uint8Array(readFileSync(SCHUZE_ZIP)));
    const unl = (name: string) => {
      const bytes = members.get(name);
      return bytes ? parseUnl(decodeUnl(bytes)) : [];
    };
    const map = buildAgendaTiskMap(unl("schuze.unl"), unl("bod_schuze.unl"));
    if (map.size === 0) return undefined; // prázdný dump = pořad fakticky chybí
    agendaMemo = { key, map };
    return map;
  } catch (err) {
    reportLoaderFailure("getCollisionCandidates.agenda", err);
    return undefined;
  }
}

/** Memo napříč požadavky. `usable: () => true` — o prázdnu rozhoduje komentář
 *  v hlavičce modulu, ne tenhle predikát: `write()` už `null` odfiltroval a
 *  nula kandidátů je výsledek, ne prázdné čtení. */
const collisionMemo = createLedgerMemo<CollisionData>({ usable: () => true });

/** Testovací šev (vzor `resetSuppliesMemo`) — aplikace ho nikdy nevolá. */
export function resetCollisionMemo(): void {
  collisionMemo.reset();
}

async function computeCollisions(): Promise<CollisionData | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const layer = await loadMoneyLayer();
    if (!layer) return null;

    /* vazby: identická projekce jako ledger (mapLinkedToTie), zúžená na
     * vstupní tvar derivace */
    const ties: CollisionTieIn[] = [];
    for (const e of layer.linked) {
      const company = layer.companyById.get(e.dst);
      if (!company) continue;
      const personPspId = pspIdFromNodeId(e.src);
      if (personPspId === null) continue;
      const person = layer.personById.get(e.src);
      const tie = mapLinkedToTie({
        edge: e,
        company,
        contracts: layer.contractsByCompany.get(company.id) ?? { count: 0, czk: 0, amounts: [] },
        person,
      });
      ties.push({
        personPspId,
        personName: person?.label ?? `#${personPspId}`,
        club: layer.clubByPerson.get(personPspId) ?? null,
        edgeSrc: e.src,
        edgeRel: e.rel,
        edgeDst: e.dst,
        companyId: tie.companyId,
        company: tie.company,
        ico: tie.ico,
        role: tie.role,
        tieClass: tie.tieClass,
        reviewState: tie.reviewState,
        corroboration: tie.corroboration ?? null,
        roleValidFrom: tie.roleValidFrom ?? null,
        roleValidTo: tie.roleValidTo ?? null,
        contractCount: tie.contractCount,
        subsidiesCount: tie.subsidiesCount,
        donatedToPartyCzk: tie.donatedToPartyCzk,
      });
    }
    if (ties.length === 0) return null;

    /* ── zkrat: prázdná brána vazeb ──────────────────────────────────────────
     * TÝŽ predikát, který o vstupu rozhoduje uvnitř derivace (tieEntersJoin,
     * importovaný — druhá kopie brány by se dřív nebo později rozešla a
     * stránka by pak přeskakovala čtení, které výsledek MĚNIT může). Prázdné
     * `votes`/`ballots`/`bills` jsou tu záměr, ne výpadek; derivace to ví
     * z `voteLayerConsulted` a coverage o hlasování vyjde `null`. */
    if (!ties.some(tieEntersJoin)) {
      return deriveCollisions({
        ties,
        votes: [],
        ballots: [],
        bills: [],
        personByMandate: new Map(),
        voteLayerConsulted: false,
        pass: layer.pass,
      });
    }

    /* hlasovací ledger — SDÍLENÁ cesta votetracku i s prahy připravenosti
     * (EVENT_FLOOR / BALLOT_FLOOR běží uvnitř readLedger, PŘED memem, takže
     * polovičně naingestovaný záznam se nikdy nezapamatuje). `null` = store
     * nedostupný nebo záznam pod prahem → celá stránka degraduje, nikdy
     * částečný join.
     * `readVoteEvents()` se volá zvlášť kvůli SYROVÝM řádkům: projekce
     * `toEventIn` nenese `termPspId` ani `agendaItem`, tedy klíč do pořadu
     * schůze. Obě funkce jsou `react.cache()`d, takže vote_event se přesto čte
     * jen jednou za požadavek. */
    const ledger = await readLedger();
    if (!ledger) return null;
    const events = await readVoteEvents();

    /* legislativní vrstva: tisk → novelizované zákony (amends hrany; law uzly
     * jen kvůli lidskému názvu — týž fallback ref jako getLawData.lawRefOf) */
    const billNodes = await store.listKgNodes({ kind: "bill", limit: KG_READ_CAP });
    const lawNodes = await store.listKgNodes({ kind: "law", limit: KG_READ_CAP });
    const amends = await store.listKgEdges({ rel: "amends", limit: KG_READ_CAP });
    const lawByUrn = new Map(lawNodes.map((n) => [n.id, n]));
    const refsByBill = new Map<string, { ref: string; label: string }[]>();
    for (const e of amends) {
      const law = lawByUrn.get(e.dst);
      const props = (law?.props ?? {}) as Record<string, unknown>;
      const ref =
        typeof props.ref === "string" && props.ref.length > 0
          ? props.ref
          : e.dst.replace(/^law:sb:/, "").replace("-", "/");
      const arr = refsByBill.get(e.src) ?? [];
      arr.push({ ref, label: law?.label ?? ref });
      refsByBill.set(e.src, arr);
    }
    const bills: CollisionBillIn[] = billNodes.map((n) => {
      const p = (n.props ?? {}) as Record<string, unknown>;
      return {
        nodeId: n.id,
        cislo: typeof p.cislo === "number" ? p.cislo : null,
        title: n.label,
        amendedRefs: refsByBill.get(n.id) ?? [],
      };
    });

    return deriveCollisions({
      ties,
      votes: events.map((e) => ({
        pspId: e.pspId,
        votedOn: e.votedOn,
        voided: e.voided,
        title: (e.titleLong ?? e.titleShort ?? e.titleNorm ?? "").trim() || `#${e.pspId}`,
        outcome: e.outcome,
        sourceUrl: e.sourceUrl,
        termPspId: e.termPspId,
        sessionNo: e.sessionNo,
        agendaItem: e.agendaItem,
      })),
      agendaTisk: loadAgendaTiskMap(),
      bills,
      ballots: ledger.ballots,
      personByMandate: ledger.personByMandate,
      pass: layer.pass,
    });
  } catch (err) {
    reportLoaderFailure("getCollisionCandidates", err);
    return null;
  }
}

export const getCollisionCandidates = cache(async function getCollisionCandidates(): Promise<CollisionData | null> {
  const memoized = collisionMemo.read();
  if (memoized) return memoized;
  const fresh = await computeCollisions();
  collisionMemo.write(fresh);
  return fresh;
});
