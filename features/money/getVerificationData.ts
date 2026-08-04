// Server-only: the review queue for /penize/kontrola — the human-verification console
// for the 211 pending MP↔company ties. Reads the SAME shared money layer as the ledger
// (moneyLoader.ts::loadMoneyLayer — one `cache()`-wrapped read per request, and the same
// cardinality-floor gate every other money surface has), but
// shapes ONE ROW PER PENDING TIE, enriched with the deterministic triage signals
// (tie class, triangle, near-threshold, parsed role period) and the primary-registry
// deep-links a reviewer needs. Read-only; it NEVER writes review_state — the write path
// is a fleet-mode handoff item.
//
// Called only from the /penize/kontrola server component; the `server-only`
// import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
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

export async function getVerificationQueue(): Promise<ReviewQueue | null> {
  try {
    // ONE shared read with the ledger (moneyLoader.ts), `cache()`-wrapped. This loader
    // used to repeat all five of the ledger's whole-relation scans — the same ~307 000
    // rows, materialized twice per request when both surfaces were touched, and two
    // copies of the "what is a tie" mapping to keep in step by hand.
    const layer = await loadMoneyLayer();
    if (!layer) return null;
    const { linked, companyById, personById, clubByPerson, contractsByCompany, pass } = layer;

    const ties: ReviewTie[] = [];
    for (const e of linked) {
      const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
      const reviewState: ReviewState =
        rawState === "verified" ? "verified" : rawState === "rejected" ? "rejected" : "pending_review";
      // the console shows the PENDING queue only — verified ties are resolved, and
      // rejected ties (D7, batch 004) are a terminal decision that must not be
      // re-served forever, same as verified.
      if (reviewState !== "pending_review") continue;

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

      ties.push({
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
      });
    }

    // Batch-005: PRIMARY sort is the review-order axis (registry-confirmed
    // owner-operators → managers → confirmed stewards → unconfirmed, money desc within
    // tier) — this is what drives a real review session, not the raw story-worthiness
    // signalScore (still computed per-tie above and shown on the card for context).
    ties.sort((a, b) => a.reviewRank - b.reviewRank);

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

    return { ties, stats, source: "registr smluv ⋈ ares ⋈ hlídač státu", pass };
  } catch (err) {
    reportLoaderFailure("getVerificationQueue", err);
    return null;
  }
}
