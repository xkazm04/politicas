// Server-only: loader Newsroom Evidence Terminalu (/rentgen, batch-7 7C).
//
// Čte STRIKTNĚ read-only tři vrstvy, které už vlastní jiné plochy, a mapuje
// je na vstupy čistého modelu (terminalModel.ts):
//
//   1. Peněžní vrstva — loadMoneyLayer + mapLinkedToTie (features/money/
//      moneyLoader.ts, JEDINÉ místo, kde se linked_to hrana stává MoneyTie —
//      terminál tedy nemůže spočítat jiné peníze než /penize). Verified-only
//      filtr NEDĚLÁ loader, ale čistý model — disciplína se testuje.
//   2. Lidská brána — store.listReviewAudit (newest first) + labely endpointů.
//   3. Proud „zaznamenáno" — change_event (ChangeEventRepository.list…).
//      Backfill terminál NIKDY nespouští: vlastní ho /denik
//      (getDenikData.ensureChangesBackfilled); tady se jen čte, co existuje.
//
// Degradace po vrstvách jako getDenikData: každá vrstva padá NEZÁVISLE a
// `coverage` říká ploše, co terminál právě unese; null se vrací jen když není
// čitelná ŽÁDNÁ vrstva (plocha pak přizná ilustrativní režim — archivní
// vzorek zůstává, označený).

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { getChangesRepo } from "@/lib/db/pglite/repositories/changes";
import { loadMoneyLayer, mapLinkedToTie, pspIdFromNodeId } from "@/features/money/moneyLoader";
import {
  deriveTerminalGraph,
  deriveTerminalLedger,
  mergeTailLog,
  type TailChangeLike,
  type TailReviewLike,
  type TerminalCoverage,
  type TerminalTieLike,
  type TerminalViewData,
} from "./terminalModel";

export type TerminalData = TerminalViewData;

/** Stropy čtení tailu — pojistky, ne stránkování (model řeže na 24 řádků). */
const MAX_AUDIT_ROWS = 300;
const MAX_CHANGE_EVENTS = 300;

async function readTies(): Promise<{ ties: TerminalTieLike[]; pass: number; ok: boolean }> {
  try {
    const layer = await loadMoneyLayer();
    if (!layer) return { ties: [], pass: 0, ok: false };
    const ties: TerminalTieLike[] = [];
    for (const e of layer.linked) {
      const company = layer.companyById.get(e.dst);
      if (!company) continue;
      const person = layer.personById.get(e.src);
      const tie = mapLinkedToTie({
        edge: e,
        company,
        contracts: layer.contractsByCompany.get(e.dst) ?? { count: 0, czk: 0, amounts: [] },
        person,
      });
      const pspId = pspIdFromNodeId(e.src);
      ties.push({
        srcId: e.src,
        dstId: e.dst,
        pspId,
        mpName: person?.label ?? e.src,
        club: pspId !== null ? (layer.clubByPerson.get(pspId) ?? null) : null,
        ico: tie.ico,
        company: tie.company,
        role: tie.role,
        reviewState: tie.reviewState,
        tieClass: tie.tieClass,
        contractCount: tie.contractCount,
        contractCzk: tie.contractCzk,
        subsidiesCzk: tie.subsidiesCzk,
        source: tie.source,
      });
    }
    return { ties, pass: layer.pass, ok: true };
  } catch (err) {
    reportLoaderFailure("getTerminalData.ties", err);
    return { ties: [], pass: 0, ok: false };
  }
}

async function readReviews(): Promise<{ reviews: TailReviewLike[]; ok: boolean; auditRows: number }> {
  try {
    const store = await getStore();
    if (!store) return { reviews: [], ok: false, auditRows: 0 };
    const audit = await store.listReviewAudit({ limit: MAX_AUDIT_ROWS });

    const ids = [...new Set(audit.flatMap((r) => [r.src, r.dst]))];
    const labels = new Map<string, string>();
    if (ids.length > 0) {
      try {
        for (const n of await store.getKgNodes(ids)) labels.set(n.id, n.label);
      } catch (err) {
        // Labely jsou obohacení; log degraduje na id uzlů, neumírá.
        reportLoaderFailure("getTerminalData.reviewLabels", err);
      }
    }

    return {
      reviews: audit.map((r) => ({
        id: r.id,
        decision: r.decision,
        decidedAt: r.decidedAt,
        mp: labels.get(r.src) ?? r.src,
        company: labels.get(r.dst) ?? r.dst,
      })),
      ok: true,
      auditRows: audit.length,
    };
  } catch (err) {
    reportLoaderFailure("getTerminalData.reviews", err);
    return { reviews: [], ok: false, auditRows: 0 };
  }
}

async function readChanges(): Promise<{ changes: TailChangeLike[]; ok: boolean }> {
  try {
    const repo = await getChangesRepo();
    if (!repo) return { changes: [], ok: false };
    const events = await repo.listChangeEvents({ limit: MAX_CHANGE_EVENTS });

    const ids = [
      ...new Set(events.flatMap((e) => [e.src, e.dst].filter((v): v is string => v !== null))),
    ];
    const labels = new Map<string, string>();
    if (ids.length > 0) {
      try {
        const store = await getStore();
        if (store) for (const n of await store.getKgNodes(ids)) labels.set(n.id, n.label);
      } catch (err) {
        reportLoaderFailure("getTerminalData.changeLabels", err);
      }
    }

    return {
      changes: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        recordedAt: e.recordedAt,
        src: e.src,
        dst: e.dst,
        srcLabel: e.src !== null ? (labels.get(e.src) ?? null) : null,
        dstLabel: e.dst !== null ? (labels.get(e.dst) ?? null) : null,
        pending: e.payload.review_state !== "verified",
      })),
      ok: true,
    };
  } catch (err) {
    reportLoaderFailure("getTerminalData.changes", err);
    return { changes: [], ok: false };
  }
}

export const getTerminalData = cache(async function getTerminalData(): Promise<TerminalData | null> {
  const [money, gate, changeStream] = await Promise.all([readTies(), readReviews(), readChanges()]);
  const coverage: TerminalCoverage = {
    money: money.ok,
    reviews: gate.ok,
    changes: changeStream.ok,
  };

  if (!coverage.money && !coverage.reviews && !coverage.changes) {
    reportLoaderFailure(
      "getTerminalData",
      new Error("žádná vrstva není čitelná — /rentgen přizná ilustrativní režim"),
    );
    return null;
  }

  return {
    graph: deriveTerminalGraph(money.ties),
    ledger: deriveTerminalLedger(money.ties),
    tail: mergeTailLog({ reviews: gate.reviews, changes: changeStream.changes }),
    coverage,
    pass: money.pass,
    auditRows: gate.auditRows,
    retrievedOn: new Date().toISOString().slice(0, 10),
  };
});
