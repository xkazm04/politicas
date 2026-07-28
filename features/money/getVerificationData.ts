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
import { loadMoneyLayer, num, pspIdFromNodeId } from "./moneyLoader";
import { reachableMoney } from "./reachableMoney";
import {
  buildRegistryLinks,
  isDeMinimis,
  nearThresholdCount,
  parsePeriod,
  resolveReviewOrder,
  resolveTieClass,
  reviewSignal,
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

      const cp = comp.props ?? {};
      const a = contractsByCompany.get(comp.id) ?? { count: 0, czk: 0, amounts: [] };
      const role = String(e.props?.role ?? "");
      const source = String(e.props?.source ?? "");
      const ico = String(cp.ico ?? comp.id.split(":").pop() ?? "");
      const { from, to } = parsePeriod(source);
      // Stored class wins over the heuristic — the console must never re-derive over a
      // correction a reviewer already made (see resolveTieClass).
      const cls = resolveTieClass(e.props?.tie_class, role, comp.label);
      const tieClass = cls.tieClass;
      const contractCzk = a.czk;
      const subsidiesCzk = num(cp.subsidies_total_czk);
      const donatedToPartyCzk = cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null;
      const near = nearThresholdCount(a.amounts);
      const absenteeManagerLead = Boolean(person?.props?.absentee_manager_lead);
      const triangle = contractCzk > 0 && subsidiesCzk > 0 && (donatedToPartyCzk ?? 0) > 0;
      const corroboration = (e.props?.corroboration as ReviewTie["corroboration"]) ?? null;
      const order = resolveReviewOrder({
        storedTier: e.props?.review_tier,
        storedRank: e.props?.review_rank,
        tieClass,
        corroboration,
        contractCzk,
        subsidiesCzk,
      });

      ties.push({
        id: `tie:${pspId}:${ico}`,
        src: e.src,
        dst: e.dst,
        pspId,
        mpName: person?.label ?? String(pspId),
        club: clubByPerson.get(pspId) ?? null,
        absenteeManagerLead,
        ico,
        company: comp.label,
        role,
        source,
        reviewState,
        tieClass,
        tieClassOrigin: cls.origin,
        tieClassHeuristic: cls.heuristic,
        periodFrom: from,
        periodTo: to,
        contractCount: a.count,
        contractCzk,
        subsidiesCount: num(cp.subsidies_count),
        subsidiesCzk,
        donatedToPartyCzk,
        donationRecipientParty:
          cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
        triangle,
        nearThresholdCount: near,
        deMinimis: isDeMinimis(contractCzk, subsidiesCzk),
        corroboration,
        roleValidFrom: (e.props?.role_valid_from as string | null | undefined) ?? null,
        roleValidTo: (e.props?.role_valid_to as string | null | undefined) ?? null,
        temporalStatus: (e.props?.temporal_status as string | null | undefined) ?? null,
        signalScore: reviewSignal({
          contractCzk,
          subsidiesCzk,
          tieClass,
          triangle,
          nearThresholdCount: near,
          donatedToPartyCzk,
          absenteeManagerLead,
        }),
        reviewTier: order.reviewTier,
        reviewRank: order.reviewRank,
        reviewOrderOrigin: order.origin,
        links: buildRegistryLinks(ico, source),
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
