// Server-only loader hlídek grafu (/admin, sekce „Hlídky grafu") — tenká IO
// slupka nad čistou derivací lib/analysis/tripwires.ts. Skládá VÝHRADNĚ už
// existující čtecí cesty a NIC NEZAPISUJE — kandidáti se odvozují znovu při
// každém čtení (precedens 4C):
//   • peněžní vrstva grafu přes loadMoneyLayer + mapLinkedToTie (táž projekce
//     jako /penize a /penize/strety — paritní pravidlo review_state zdarma),
//   • hlasovací ledger PSP10 zúžený na hlasování o tiscích novelizujících
//     zákony z vyhlášené tabulky relevance (tatáž pravidla napojení na tisk
//     jako Vote-Collision Engine: primárně pořad schůze, záložně titulek),
//   • rapporteur a owns_stake hrany grafu,
//   • živí kandidáti střetů (getCollisionCandidates — cache()-sdílené se
//     /penize/strety) jen kvůli křížovým odkazům #s-<id>.
// Degraduje po vrstvách, ne celkem: bez peněžní vrstvy → null (bez vazeb není
// co hlídat); hlasovací ledger pod floorem → votesAvailable=false a hlídka T1
// se přizná jako slepá; strety nedostupné → collisionsAvailable=false.

import "server-only";
import { cache } from "react";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { EVENT_FLOOR } from "@/features/votetrack/getVoteRecord";
import { decodeUnl, parseUnl } from "@/lib/ingest/unl";
import { readZipMap } from "@/lib/ingest/zip";
import { loadMoneyLayer, mapLinkedToTie, num, pspIdFromNodeId } from "@/features/money/moneyLoader";
import { getCollisionCandidates } from "@/features/money/collisions/getCollisionCandidates";
import {
  relevantStatutesFor,
  tiskRefOf,
} from "@/features/money/collisions/statuteRelevance";
import { agendaKey, buildAgendaTiskMap, type AgendaTisk } from "@/features/money/collisions/voteAgenda";
import {
  deriveTripwires,
  type TripwireData,
  type TripwireRapporteurIn,
  type TripwireStakeIn,
  type TripwireTieIn,
  type TripwireVoteIn,
} from "@/lib/analysis/tripwires";

const TERM = "PSP10";

/* Pořad schůze — týž lokální dump a táž (mtime, size) memoizace jako
 * getCollisionCandidates.loadAgendaTiskMap (tam je funkce modulově privátní;
 * duplikát je vědomý a oba čtou z jednoho souboru týmž builderem). */
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
    if (map.size === 0) return undefined;
    agendaMemo = { key, map };
    return map;
  } catch (err) {
    reportLoaderFailure("getTripwireData.agenda", err);
    return undefined;
  }
}

/** bill:tisk:<interní id> → interní id (klíč pořadu schůze); jinak null. */
const internalTiskIdOf = (nodeId: string): number | null => {
  const m = /^bill:tisk:(\d+)$/.exec(nodeId);
  return m ? Number(m[1]) : null;
};

export const getTripwireData = cache(async function getTripwireData(): Promise<TripwireData | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const layer = await loadMoneyLayer();
    if (!layer) return null;

    /* vazby: identická projekce jako strety (mapLinkedToTie) + kanály firmy */
    const ties: TripwireTieIn[] = [];
    for (const e of layer.linked) {
      const company = layer.companyById.get(e.dst);
      if (!company) continue;
      const personPspId = pspIdFromNodeId(e.src);
      if (personPspId === null) continue;
      const person = layer.personById.get(e.src);
      const contracts = layer.contractsByCompany.get(company.id) ?? { count: 0, czk: 0, amounts: [] };
      const tie = mapLinkedToTie({ edge: e, company, contracts, person });
      ties.push({
        edgeSrc: e.src,
        edgeDst: e.dst,
        personPspId,
        personName: person?.label ?? `#${personPspId}`,
        club: layer.clubByPerson.get(personPspId) ?? null,
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
        contractCzk: tie.contractCzk,
        subsidiesCzk: tie.subsidiesCzk,
        deMinimis: tie.deMinimis,
        channelStatutes: relevantStatutesFor({
          contractCount: tie.contractCount,
          subsidiesCount: tie.subsidiesCount,
          donatedToPartyCzk: tie.donatedToPartyCzk,
        }),
      });
    }
    if (ties.length === 0) return null;

    /* legislativní vrstva: tisk → novelizované zákony (jako strety loader) */
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
    const billById = new Map(billNodes.map((b) => [b.id, b]));
    const billByInternal = new Map<number, (typeof billNodes)[number]>();
    const billByCislo = new Map<number, (typeof billNodes)[number]>();
    for (const b of billNodes) {
      const internal = internalTiskIdOf(b.id);
      if (internal !== null) billByInternal.set(internal, b);
      const p = (b.props ?? {}) as Record<string, unknown>;
      if (typeof p.cislo !== "number") continue;
      const prev = billByCislo.get(p.cislo);
      if (!prev || b.id < prev.id) billByCislo.set(p.cislo, b);
    }

    /* zákony, které vůbec mohou být kanálem některé vazby — hlasování mimo
     * tenhle průnik hlídku nezajímají a nepodávají se derivaci */
    const anyChannelRefs = new Set(ties.flatMap((t) => t.channelStatutes.map((s) => s.ref)));

    /* hlasovací ledger — týž floor jako Seismograf/strety; pod ním je hlídka
     * T1 SLEPÁ (votesAvailable=false), nikdy „bez nálezu" */
    const agendaTisk = loadAgendaTiskMap();
    let votesAvailable = false;
    const votes: TripwireVoteIn[] = [];
    try {
      const events = await store.listVoteEvents({ termCode: TERM, limit: 100_000 });
      if (events.length >= EVENT_FLOOR) {
        votesAvailable = true;
        for (const v of events) {
          if (v.voided || v.votedOn === null) continue;
          /* napojení na tisk: primárně pořad schůze, nejednoznačný bod se
           * konzervativně vynechává; záložně „tisk N" v titulku (pravidla
           * Vote-Collision Engine) */
          const title = (v.titleLong ?? v.titleShort ?? v.titleNorm ?? "").trim() || `#${v.pspId}`;
          let bill: (typeof billNodes)[number] | undefined;
          let ambiguous = false;
          if (agendaTisk && v.termPspId !== null && v.sessionNo !== null && v.agendaItem !== null) {
            const hit = agendaTisk.get(agendaKey(v.termPspId, v.sessionNo, v.agendaItem));
            if (hit === "ambiguous") ambiguous = true;
            else if (typeof hit === "number") bill = billByInternal.get(hit);
          }
          if (ambiguous) continue;
          if (!bill) {
            const cislo = tiskRefOf(title);
            if (cislo !== null) bill = billByCislo.get(cislo);
          }
          if (!bill) continue;
          const refs = refsByBill.get(bill.id) ?? [];
          const relevant = refs.filter((r) => anyChannelRefs.has(r.ref));
          if (relevant.length === 0) continue;
          const bp = (bill.props ?? {}) as Record<string, unknown>;
          votes.push({
            votePspId: v.pspId,
            votedOn: v.votedOn.slice(0, 10),
            voteTitle: title,
            sourceUrl: v.sourceUrl,
            billCislo: typeof bp.cislo === "number" ? bp.cislo : null,
            billTitle: bill.label,
            amendedRefs: relevant,
          });
        }
      } else if (events.length > 0) {
        reportLoaderFailure(
          "getTripwireData",
          new Error(`vote_event below readiness floor: ${events.length}<${EVENT_FLOOR}`),
        );
      }
    } catch (err) {
      reportLoaderFailure("getTripwireData.votes", err);
      votesAvailable = false;
    }

    /* rapporteur hrany (person → bill) s novelizovanými zákony tisku */
    const rapporteurs: TripwireRapporteurIn[] = [];
    try {
      const raps = await store.listKgEdges({ rel: "rapporteur", limit: KG_READ_CAP });
      for (const e of raps) {
        const personPspId = pspIdFromNodeId(e.src);
        if (personPspId === null) continue;
        const bill = billById.get(e.dst);
        const refs = refsByBill.get(e.dst) ?? [];
        if (refs.length === 0) continue;
        const bp = (bill?.props ?? {}) as Record<string, unknown>;
        rapporteurs.push({
          personPspId,
          billNodeId: e.dst,
          billCislo: typeof bp.cislo === "number" ? bp.cislo : null,
          billTitle: bill?.label ?? e.dst,
          amendedRefs: refs,
        });
      }
    } catch (err) {
      reportLoaderFailure("getTripwireData.rapporteurs", err);
    }

    /* owns_stake hrany (company → company) + smlouvy držené firmy */
    const stakes: TripwireStakeIn[] = [];
    try {
      const stakeEdges = await store.listKgEdges({ rel: "owns_stake", limit: KG_READ_CAP });
      for (const e of stakeEdges) {
        const dst = layer.companyById.get(e.dst);
        const money = layer.contractsByCompany.get(e.dst) ?? { count: 0, czk: 0, amounts: [] };
        const dp = (dst?.props ?? {}) as Record<string, unknown>;
        stakes.push({
          srcCompanyId: e.src,
          dstCompanyId: e.dst,
          dstCompany: dst?.label ?? e.dst,
          dstIco: typeof dp.ico === "string" ? dp.ico : null,
          // Zapisovač (batch-006 ownership-chains, pass 28) ukládá podíl jako
          // `share`; `stake_pct` žádný writer nikdy neemitoval a čtení jen jeho
          // nechávalo T4 trvale v degradovaném „drží podíl" bez procenta.
          stakePct:
            e.props?.share != null
              ? num(e.props.share)
              : e.props?.stake_pct != null
                ? num(e.props.stake_pct)
                : null,
          dstContractCount: money.count,
          dstContractCzk: money.czk,
        });
      }
    } catch (err) {
      reportLoaderFailure("getTripwireData.stakes", err);
    }

    /* živé střety — jen kvůli křížovým odkazům #s-<id> */
    let collisionsAvailable = false;
    let liveCollisions: { id: string; edgeSrc: string; edgeDst: string }[] = [];
    try {
      const collisions = await getCollisionCandidates();
      if (collisions) {
        collisionsAvailable = true;
        liveCollisions = collisions.candidates.map((c) => ({
          id: c.id,
          edgeSrc: c.tieRef.src,
          edgeDst: c.tieRef.dst,
        }));
      }
    } catch (err) {
      reportLoaderFailure("getTripwireData.collisions", err);
    }

    return deriveTripwires({
      ties,
      votes,
      rapporteurs,
      stakes,
      liveCollisions,
      votesAvailable,
      agendaAvailable: agendaTisk !== undefined,
      collisionsAvailable,
    });
  } catch (err) {
    reportLoaderFailure("getTripwireData", err);
    return null;
  }
});
