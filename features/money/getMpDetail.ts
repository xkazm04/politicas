// Server-only: full evidence chain for ONE MP — the /penize/[pspId] case-file
// surface. Same materialized money layer as getMoneyData.ts (via moneyLoader.ts),
// scoped to a single person, with each tie's reachable contracts expanded into
// line items (top-N shown, remainder counted, never dropped silently).
//
// The `server-only` import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { asUnion } from "@/lib/db/narrow";
import { loadMoneyLayer, num, pspIdFromNodeId } from "./moneyLoader";
import { CORROBORATIONS } from "./moneyTypes";
import type { MoneyMpDetail, MoneyTieDetail, ReviewState } from "./moneyTypes";
import {
  classifyTie,
  isDeMinimis,
  nearThresholdCount,
  reviewRank,
  reviewSignal,
  reviewTier,
} from "./reviewTypes";

export const MP_CONTRACT_LINES_SHOWN = 8;

export async function getMoneyMpDetail(pspId: number): Promise<MoneyMpDetail | null> {
  try {
    const layer = await loadMoneyLayer();
    if (!layer) return null;
    const { persons, linked, companyById, personById, clubByPerson, contractsByCompany, pass } = layer;

    const personId = `psp:person:${pspId}`;
    const pnode = personById.get(personId) ?? persons.find((p) => pspIdFromNodeId(p.id) === pspId);
    if (!pnode) return null;

    const ties: MoneyTieDetail[] = [];
    for (const e of linked) {
      if (e.src !== pnode.id) continue;
      const comp = companyById.get(e.dst);
      if (!comp) continue; // unresolved company → drop, never guess
      const cp = comp.props ?? {};
      const contracts = contractsByCompany.get(comp.id) ?? { count: 0, czk: 0, amounts: [], lines: [] };
      const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
      const reviewState: ReviewState =
        rawState === "verified" ? "verified" : rawState === "rejected" ? "rejected" : "pending_review";

      const role = String(e.props?.role ?? "");
      const contractCzk = contracts.czk;
      const subsidiesCzk = num(cp.subsidies_total_czk);
      const donatedToPartyCzk = cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null;
      const tieClass = classifyTie(role, comp.label);
      const triangle = contractCzk > 0 && subsidiesCzk > 0 && (donatedToPartyCzk ?? 0) > 0;
      const near = nearThresholdCount(contracts.amounts);
      const absenteeManagerLead = Boolean(pnode.props?.absentee_manager_lead);
      const corroboration = asUnion(e.props?.corroboration, CORROBORATIONS, null);

      ties.push({
        companyId: comp.id,
        ico: String(cp.ico ?? comp.id.split(":").pop() ?? ""),
        company: comp.label,
        role,
        reviewState,
        source: String(e.props?.source ?? ""),
        contractCount: contracts.count,
        contractCzk,
        subsidiesCount: num(cp.subsidies_count),
        subsidiesCzk,
        donatedToPartyCzk,
        donationRecipientParty:
          cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
        corroboration,
        roleValidFrom: (e.props?.role_valid_from as string | null | undefined) ?? null,
        roleValidTo: (e.props?.role_valid_to as string | null | undefined) ?? null,
        temporalStatus: (e.props?.temporal_status as string | null | undefined) ?? null,
        tieClass,
        triangle,
        nearThresholdCount: near,
        deMinimis: isDeMinimis(contractCzk, subsidiesCzk),
        signalScore: reviewSignal({
          contractCzk,
          subsidiesCzk,
          tieClass,
          triangle,
          nearThresholdCount: near,
          donatedToPartyCzk,
          absenteeManagerLead,
        }),
        reviewTier: reviewTier({ tieClass, corroboration }),
        reviewRank: reviewRank({ tieClass, corroboration, contractCzk, subsidiesCzk }),
        reviewNote: (e.props?.review_note as string | null | undefined) ?? null,
        reviewerNote: (e.props?.reviewer_note as string | null | undefined) ?? null,
        lastDecision: (e.props?.last_decision as string | null | undefined) ?? null,
        lastReviewer: (e.props?.last_reviewer as string | null | undefined) ?? null,
        lastReviewedAt: (e.props?.last_reviewed_at as string | null | undefined) ?? null,
        ownerStakePct: e.props?.owner_stake_pct != null ? num(e.props.owner_stake_pct) : null,
        priorTerm: (e.props?.prior_term as string | null | undefined) ?? null,
        falseEdgeSuspected: Boolean(e.props?.false_edge_suspected),
        flags: Array.isArray(e.props?.flags) ? (e.props.flags as string[]) : [],
        contracts: contracts.lines.slice(0, MP_CONTRACT_LINES_SHOWN),
        contractsMoreCount: Math.max(0, contracts.lines.length - MP_CONTRACT_LINES_SHOWN),
      });
    }
    if (ties.length === 0) return null;

    ties.sort((a, b) => b.contractCzk + b.subsidiesCzk - (a.contractCzk + a.subsidiesCzk));

    return {
      pspId,
      name: pnode.label,
      club: clubByPerson.get(pspId) ?? null,
      absenteeManagerLead: Boolean(pnode.props?.absentee_manager_lead),
      ties,
      totalContractCzk: ties.reduce((s, t) => s + t.contractCzk, 0),
      totalSubsidiesCzk: ties.reduce((s, t) => s + t.subsidiesCzk, 0),
      totalDonatedCzk: ties.reduce((s, t) => s + (t.donatedToPartyCzk ?? 0), 0),
      source: "registr smluv ⋈ ares ⋈ hlídač státu",
      pass,
    };
  } catch (err) {
    reportLoaderFailure("getMoneyMpDetail", err);
    return null;
  }
}
