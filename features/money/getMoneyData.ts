// Server-only: the REAL FollowTheMoney read for /penize. Walks the materialized
// money layer of the knowledge graph via moneyLoader.ts — person --linked_to-->
// company --supplies--> contract, plus subsidy/donation props on the company node
// — and shapes it into the typed props the /penize surface renders. Degrades
// gracefully to null (→ the page keeps its labelled mock) if no store is
// configured, the money layer hasn't been materialized, or PGlite is
// unavailable at request time — so introducing the store read can never break
// the page.
//
// TRUST IS THE PRODUCT: every MP↔company `linked_to` edge is human-gated
// (props.review_state). Ties that have not passed review are surfaced as
// pending_review and excluded from `verifiedCount`/any score — exactly as the
// mock's verified:false ties.
//
// Each tie also carries the SAME deterministic annotation the /penize/kontrola
// review console computes (tieClass, signalScore, reviewTier/Rank, triangle,
// near-threshold, de-minimis) — reused verbatim from reviewTypes.ts's pure
// helpers so the ledger and the console never disagree on what a tie "is".
//
// Called only from the /penize server component; the `server-only` import
// makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { loadMoneyLayer, num, pspIdFromNodeId } from "./moneyLoader";
import type { MoneyData, MoneyGraphData, MoneyMp, MoneyMpStub, MoneyTie, ReviewState } from "./moneyTypes";
import {
  classifyTie,
  isDeMinimis,
  nearThresholdCount,
  reviewRank,
  reviewSignal,
  reviewTier,
} from "./reviewTypes";

const GRAPH_COMPANY_CAP = 5; // companies rendered in the featured entity graph

export async function getMoneyData(): Promise<MoneyData | null> {
  try {
    const layer = await loadMoneyLayer();
    if (!layer) return null;
    const { persons, linked, companyById, personById, clubByPerson, contractsByCompany, pass } = layer;

    // Group ties by MP.
    const tiesByPerson = new Map<string, MoneyTie[]>();
    const distinctCompanies = new Set<string>();
    let verifiedTies = 0;
    let pendingTies = 0;
    let contractCzkReachable = 0;
    const reachableSeen = new Set<string>();

    for (const e of linked) {
      const comp = companyById.get(e.dst);
      if (!comp) continue; // unresolved company → drop, never guess
      const cp = comp.props ?? {};
      const contracts = contractsByCompany.get(comp.id) ?? { count: 0, czk: 0, amounts: [], lines: [] };
      const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
      const reviewState: ReviewState =
        rawState === "verified" ? "verified" : rawState === "rejected" ? "rejected" : "pending_review";
      if (reviewState === "verified") verifiedTies += 1;
      else if (reviewState === "pending_review") pendingTies += 1;

      const person = personById.get(e.src);
      const role = String(e.props?.role ?? "");
      const contractCzk = contracts.czk;
      const subsidiesCzk = num(cp.subsidies_total_czk);
      const donatedToPartyCzk = cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null;
      const tieClass = classifyTie(role, comp.label);
      const triangle = contractCzk > 0 && subsidiesCzk > 0 && (donatedToPartyCzk ?? 0) > 0;
      const near = nearThresholdCount(contracts.amounts);
      const absenteeManagerLead = Boolean(person?.props?.absentee_manager_lead);
      const corroboration = (e.props?.corroboration as MoneyTie["corroboration"]) ?? null;

      const tie: MoneyTie = {
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
        // ARES-VR reconciliation (case-money batch 001/002) — absent on ties not yet
        // reconciled; the component renders that as "not checked", never as active.
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
      };

      const arr = tiesByPerson.get(e.src) ?? [];
      arr.push(tie);
      tiesByPerson.set(e.src, arr);
      distinctCompanies.add(comp.id);
      if (!reachableSeen.has(comp.id)) {
        reachableSeen.add(comp.id);
        contractCzkReachable += contractCzk;
      }
    }

    const mps: MoneyMp[] = [];
    for (const [personId, ties] of tiesByPerson) {
      const pnode = personById.get(personId);
      const pspId = pspIdFromNodeId(personId);
      if (!pnode || pspId == null) continue;
      // strongest evidence first within a case file
      ties.sort((a, b) => b.contractCzk + b.subsidiesCzk - (a.contractCzk + a.subsidiesCzk));
      const totalContractCzk = ties.reduce((s, t) => s + t.contractCzk, 0);
      const totalSubsidiesCzk = ties.reduce((s, t) => s + t.subsidiesCzk, 0);
      mps.push({
        pspId,
        name: pnode.label,
        club: clubByPerson.get(pspId) ?? null,
        absenteeManagerLead: Boolean(pnode.props?.absentee_manager_lead),
        ties,
        verifiedCount: ties.filter((t) => t.reviewState === "verified").length,
        pendingCount: ties.filter((t) => t.reviewState === "pending_review").length,
        totalContractCzk,
        totalSubsidiesCzk,
      });
    }
    // MPs with the heaviest reachable money first.
    mps.sort(
      (a, b) =>
        b.totalContractCzk + b.totalSubsidiesCzk - (a.totalContractCzk + a.totalSubsidiesCzk),
    );

    // MPs with no tie — absence of a finding is also a finding.
    const tiedPersonIds = new Set(tiesByPerson.keys());
    const mpsWithoutTies: MoneyMpStub[] = persons
      .filter((p) => !tiedPersonIds.has(p.id))
      .map((p) => ({ pspId: pspIdFromNodeId(p.id), name: p.label }))
      .filter((s): s is { pspId: number; name: string } => s.pspId != null)
      .map((s) => ({ ...s, club: clubByPerson.get(s.pspId) ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));

    // Featured entity graph = the strongest case file, its top firms by reach.
    let graph: MoneyGraphData | null = null;
    const lead = mps[0];
    if (lead) {
      graph = {
        mp: { pspId: lead.pspId, name: lead.name, club: lead.club },
        companies: lead.ties.slice(0, GRAPH_COMPANY_CAP).map((t) => ({
          id: t.companyId,
          company: t.company,
          role: t.role,
          reviewState: t.reviewState,
          contractCzk: t.contractCzk,
          subsidiesCzk: t.subsidiesCzk,
          donatedToPartyCzk: t.donatedToPartyCzk,
          donationRecipientParty: t.donationRecipientParty,
        })),
      };
    }

    return {
      mps,
      mpsWithoutTies,
      graph,
      stats: {
        mpsWithTies: mps.length,
        companiesLinked: distinctCompanies.size,
        contractCzkReachable,
        totalTies: linked.length,
        verifiedTies,
        pendingTies,
      },
      source: "registr smluv ⋈ ares ⋈ hlídač státu",
      pass,
    };
  } catch (err) {
    reportLoaderFailure("getMoneyData", err);
    return null;
  }
}
