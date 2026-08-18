// Server-only: the review queue for /penize/kontrola — the human-verification console
// for the 211 pending MP↔company ties. Reads the SAME shared money layer as the ledger
// (moneyLoader.ts::loadMoneyLayer — one `cache()`-wrapped read per request, and the same
// cardinality-floor gate every other money surface has), but
// shapes ONE ROW PER TIE through the SAME `mapLinkedToTie` the ledger and the case file
// use, enriched with the deterministic triage signals (tie class, triangle,
// near-threshold, parsed role period), the primary-registry deep-links a reviewer needs,
// and the tie's DECISION HISTORY from `review_audit`.
//
// It returns TWO lists: `ties` (the pending queue a review session works through) and
// `decided` (verified/rejected ties, which used to vanish from the product with no way to
// see or correct them). Read-only; it NEVER writes review_state — that is
// `reviewActions.submitReviewDecision` → `ReviewRepository.setTieReviewState` alone.
//
// Called only from the /penize/kontrola server component; the `server-only`
// import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import type { ReviewAuditRow } from "@/lib/db/types";
// The per-edge decision history is assembled ONCE on this platform, by the provenance
// capsule's `gateFromEdge` (features/shared/provenance/receipt.ts) — the console reuses it
// rather than growing a second assembler that could disagree with /zdroj.
import { gateFromEdge } from "@/features/shared/provenance/receipt";
import { loadMoneyLayer, mapLinkedToTie, pspIdFromNodeId } from "./moneyLoader";
import { reachableMoney } from "./reachableMoney";
import { hasStaleOngoingFlag } from "./tieFlags";
import {
  buildRegistryLinks,
  parsePeriod,
  type ReviewQueue,
  type ReviewState,
  type ReviewTie,
} from "./reviewTypes";

// Grouping key for one edge. A space is safe: no kg node id contains one.
const edgeKey = (src: string, dst: string) => src + " " + dst;

/** Cap on the decision ledger read. Far above any realistic review history (the live
 *  store holds 0 rows), and a bound rather than an unbounded `select *`. */
const AUDIT_READ_CAP = 10_000;

/**
 * The whole decision ledger, grouped by the edge it belongs to, newest first (the order
 * `listReviewAudit` itself returns). A ledger read failure must NOT take the queue down:
 * the console then shows the ties with an empty history rather than nothing at all — but
 * it is reported, never swallowed.
 */
async function loadAuditByEdge(): Promise<Map<string, ReviewAuditRow[]>> {
  const byEdge = new Map<string, ReviewAuditRow[]>();
  try {
    const store = await getStore();
    if (!store) return byEdge;
    const rows = await store.listReviewAudit({ limit: AUDIT_READ_CAP });
    for (const r of rows) {
      const key = edgeKey(r.src, r.dst);
      const list = byEdge.get(key);
      if (list) list.push(r);
      else byEdge.set(key, [r]);
    }
  } catch (err) {
    console.warn("[getVerificationQueue] review audit read failed; histories render empty", err);
  }
  return byEdge;
}

export async function getVerificationQueue(): Promise<ReviewQueue | null> {
  try {
    // ONE shared read with the ledger (moneyLoader.ts), `cache()`-wrapped. This loader
    // used to repeat all five of the ledger's whole-relation scans — the same ~307 000
    // rows, materialized twice per request when both surfaces were touched, and two
    // copies of the "what is a tie" mapping to keep in step by hand.
    const layer = await loadMoneyLayer();
    if (!layer) return null;
    const { linked, companyById, personById, clubByPerson, contractsByCompany, pass } = layer;

    // ONE read of the decision ledger for the whole page, grouped per edge — not a query
    // per decided tie. `review_audit` holds 0 rows on the live store today (no decision
    // has ever been made against it), so this costs nothing now and stays a single
    // indexed read when it does not.
    const auditByEdge = await loadAuditByEdge();

    const ties: ReviewTie[] = [];
    const decided: ReviewTie[] = [];
    for (const e of linked) {
      const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
      const reviewState: ReviewState =
        rawState === "verified" ? "verified" : rawState === "rejected" ? "rejected" : "pending_review";

      const comp = companyById.get(e.dst);
      const pspId = pspIdFromNodeId(e.src);
      const person = personById.get(e.src);
      if (!comp || pspId == null) continue; // unresolved endpoint → drop, never guess

      // THE ONE MAPPER (moneyLoader.mapLinkedToTie), shared with the ledger and the case
      // file. This loader used to lift its OWN narrower projection off the same edge, so
      // the reviewer deciding a tie saw less evidence than a member of the public reading
      // /penize/[pspId] — no flags, no analyst note, no owner stake, no prior decision.
      const base = mapLinkedToTie({
        edge: e,
        company: comp,
        contracts: contractsByCompany.get(comp.id) ?? { count: 0, czk: 0, amounts: [] },
        person,
      });
      const { from, to } = parsePeriod(base.source);

      const tie: ReviewTie = {
        ...base,
        id: `tie:${pspId}:${base.ico}`,
        src: e.src,
        dst: e.dst,
        pspId,
        mpName: person?.label ?? String(pspId),
        club: clubByPerson.get(pspId) ?? null,
        absenteeManagerLead: Boolean(person?.props?.absentee_manager_lead),
        periodFrom: from,
        periodTo: to,
        links: buildRegistryLinks(base.ico, base.source),
        // THE decision history, assembled by the ONE assembler the provenance capsule
        // (/zdroj) already uses — `gateFromEdge` reads the same edge props and the same
        // audit rows, so the two surfaces cannot tell a reviewer and a reader different
        // stories about the same decision.
        gate: gateFromEdge(e, auditByEdge.get(edgeKey(e.src, e.dst)) ?? []),
      };

      // The PENDING queue is what a review session works through. A decided tie is not
      // discarded any more (it used to vanish from the product entirely, with no way to
      // see it and no way to correct it) — it moves to the decided list, which carries
      // its history and the reversal path.
      if (reviewState === "pending_review") ties.push(tie);
      else decided.push(tie);
    }

    // Newest decision first — the same ordering `listReviewAudit` returns and the console
    // states. Ties broken by tie id so the order is total and reproducible.
    decided.sort((a, b) => {
      const ta = a.gate?.reviewedAt ?? a.gate?.audit[0]?.decidedAt ?? "";
      const tb = b.gate?.reviewedAt ?? b.gate?.audit[0]?.decidedAt ?? "";
      return tb.localeCompare(ta) || a.id.localeCompare(b.id);
    });

    // Batch-005: PRIMARY sort is the review-order axis (registry-confirmed
    // owner-operators → managers → confirmed stewards → unconfirmed, money desc within
    // tier) — this is what drives a real review session, not the raw story-worthiness
    // signalScore (still computed per-tie above and shown on the card for context).
    ties.sort((a, b) => a.reviewRank - b.reviewRank || a.id.localeCompare(b.id));

    const tierCounts: [number, number, number, number] = [0, 0, 0, 0];
    for (const t of ties) tierCounts[t.reviewTier] += 1;

    const stats = {
      pending: ties.length,
      ownerOperator: ties.filter((t) => t.tieClass === "owner-operator").length,
      manager: ties.filter((t) => t.tieClass === "manager").length,
      steward: ties.filter((t) => t.tieClass === "steward").length,
      triangles: ties.filter((t) => t.triangle).length,
      nearThreshold: ties.filter((t) => t.nearThresholdCount > 0).length,
      // THE shared definition (reachableMoney.ts). This tile used to sum per TIE across
      // every class, so the 14 companies tied to more than one MP were counted twice and
      // a hospital's own contracting sat in the same figure as a firm an MP owns:
      // 579 140 308 806 Kč claimed vs 526 385 963 683 Kč of distinct reachable money.
      reachable: reachableMoney(
        ties.map((t) => ({
          companyId: t.dst,
          tieClass: t.tieClass,
          contractCount: t.contractCount,
          contractCzk: t.contractCzk,
          subsidiesCzk: t.subsidiesCzk,
          donatedToPartyCzk: t.donatedToPartyCzk,
        })),
      ),
      tierCounts,
      classOrigin: {
        stored: ties.filter((t) => t.tieClassOrigin === "stored").length,
        derived: ties.filter((t) => t.tieClassOrigin === "derived").length,
      },
      staleReviewOrder: ties.filter((t) => t.reviewOrderOrigin === "stale-recomputed").length,
      // Measured on the live graph 2026-08-04: 82 of 211 pending ties carry at least one
      // flag and 42 carry `stale-ongoing-in-graph`. The console's staleness prompt used to
      // key off `periodTo === null && !corroboration`, which matches ZERO ties (all 211
      // carry a corroboration verdict) — a dead condition standing in for a real 42.
      flagged: ties.filter((t) => t.flags.length > 0).length,
      staleOngoing: ties.filter((t) => hasStaleOngoingFlag(t.flags)).length,
      withAnalystNote: ties.filter((t) => (t.reviewerNote ?? "").trim().length > 0).length,
      classDisagreements: ties.filter(
        (t) => t.tieClassOrigin === "stored" && t.tieClassHeuristic !== t.tieClass,
      ).length,
    };

    return { ties, decided, stats, source: "registr smluv ⋈ ares ⋈ hlídač státu", pass };
  } catch (err) {
    reportLoaderFailure("getVerificationQueue", err);
    return null;
  }
}
