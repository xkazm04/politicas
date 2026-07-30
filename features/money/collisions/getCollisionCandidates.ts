// Server-only loader Vote-Collision Engine (/penize/strety): tenká IO slupka
// nad čistou derivací (deriveCollisions.ts). Skládá TŘI už existující čtecí
// cesty, nic nového nematerializuje a NIC NEZAPISUJE:
//   • peněžní vrstvu grafu přes loadMoneyLayer + mapLinkedToTie (JEDINÉ místo,
//     kde se linked_to hrana stává vazbou — paritní pravidlo se veze zdarma),
//   • reálný hlasovací ledger PSP10 (vote_event + vote_ballot + mandáty),
//     tytéž readiness floory jako getVoteRecord.ts,
//   • legislativní vrstvu (bill uzly + amends hrany + law uzly pro názvy).
// Degraduje na null přesně jako loadery, na kterých stojí: žádný store, ledger
// pod floorem, prázdná peněžní vrstva nebo chyba čtení → null, nikdy částečný
// tvar. `server-only` udělá z importu v klientské komponentě build-time chybu.

import "server-only";
import { cache } from "react";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { EVENT_FLOOR, BALLOT_FLOOR } from "@/features/votetrack/getVoteRecord";
import { decodeUnl, parseUnl } from "@/lib/ingest/unl";
import { readZipMap } from "@/lib/ingest/zip";
import { loadMoneyLayer, mapLinkedToTie, pspIdFromNodeId } from "../moneyLoader";
import type { CollisionBillIn, CollisionData, CollisionTieIn } from "./collisionTypes";
import { deriveCollisions } from "./deriveCollisions";
import { buildAgendaTiskMap, type AgendaTisk } from "./voteAgenda";

const TERM = "PSP10";

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

export const getCollisionCandidates = cache(async function getCollisionCandidates(): Promise<CollisionData | null> {
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

    /* hlasovací ledger — tytéž floory jako Seismograf: pod nimi by join
     * publikoval kandidáty (i poctivé nuly) nad polovičním záznamem */
    const events = await store.listVoteEvents({ termCode: TERM, limit: 100_000 });
    if (events.length < EVENT_FLOOR) {
      if (events.length > 0) {
        reportLoaderFailure(
          "getCollisionCandidates",
          new Error(`vote_event below readiness floor: ${events.length}<${EVENT_FLOOR}`),
        );
      }
      return null;
    }
    const ballots = await store.listVoteBallots({ termCode: TERM, limit: 1_000_000 });
    if (ballots.length < BALLOT_FLOOR) {
      reportLoaderFailure(
        "getCollisionCandidates",
        new Error(`vote_ballot below readiness floor: ${ballots.length}<${BALLOT_FLOOR}`),
      );
      return null;
    }
    const mandates = await store.listMandates({ termCode: TERM });
    const personByMandate = new Map(mandates.map((m) => [m.pspId, m.personPspId]));

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
      ballots,
      personByMandate,
      pass: layer.pass,
    });
  } catch (err) {
    reportLoaderFailure("getCollisionCandidates", err);
    return null;
  }
});
