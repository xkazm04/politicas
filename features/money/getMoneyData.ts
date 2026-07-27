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
import { loadMoneyLayer, mapLinkedToTie, pspIdFromNodeId } from "./moneyLoader";
import type { MoneyData, MoneyGraphData, MoneyMp, MoneyMpStub, MoneyTie } from "./moneyTypes";

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

      // The person side used to be checked only later, in the per-MP grouping
      // loop below — so an edge whose person failed to resolve there (stale
      // edge, term-boundary mismatch, a person filtered out of the "person"
      // listing) still landed in these stats but was silently absent from
      // `mps`/the visible ledger, making the aggregate tiles permanently
      // unreconcilable with the rows a user can actually see. Resolve both
      // sides up front so an edge either contributes to nothing or to
      // everything it's counted in.
      const pnode = personById.get(e.src);
      const pspId = pspIdFromNodeId(e.src);
      if (!pnode || pspId == null) {
        console.warn(`[getMoneyData] dropping linked_to edge — person unresolved: ${e.src} -> ${e.dst}`);
        continue;
      }

      const contracts = contractsByCompany.get(comp.id) ?? { count: 0, czk: 0, amounts: [], lines: [] };
      const tie = mapLinkedToTie({ edge: e, company: comp, contracts, person: pnode });
      if (tie.reviewState === "verified") verifiedTies += 1;
      else if (tie.reviewState === "pending_review") pendingTies += 1;
      const contractCzk = tie.contractCzk;

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
      // Strongest evidence first within a case file (reviewRank — tier
      // ascending, reachable CZK descending only within a tier). Was sorted
      // by raw money, contradicting this very comment (UX audit 2026-07-27, #4).
      ties.sort((a, b) => a.reviewRank - b.reviewRank);
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

    const ownerOperatorMps = mps.filter((mp) => mp.ties.some((t) => t.tieClass === "owner-operator")).length;

    // Is the contract corpus a census or a capped per-company sample? The original
    // money feed pulled a bounded page of contracts per company, so a run of companies
    // sitting at exactly the same maximum is the cap's signature, not a coincidence
    // (money batch 011: 35 companies at exactly 25). When it is capped, every CZK
    // figure below is a FLOOR and the surface must say so — rendering a truncated sum
    // as a total is precisely what the brand rule forbids. Computed from the data
    // rather than hardcoded, so a future uncapped re-ingest silently turns this off.
    const perCompanyCounts = [...reachableSeen].map((id) => contractsByCompany.get(id)?.count ?? 0);
    const observedMax = perCompanyCounts.length ? Math.max(...perCompanyCounts) : 0;
    const companiesAtCap = perCompanyCounts.filter((n) => n === observedMax).length;
    // A real ceiling is low AND shared by several companies; one big supplier that
    // happens to top the list is not a cap.
    const isFloor = observedMax > 0 && observedMax <= 100 && companiesAtCap >= 3;
    const contractCoverage = {
      perCompanyCap: isFloor ? observedMax : null,
      companiesAtCap: isFloor ? companiesAtCap : 0,
      isFloor,
    };

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
        ownerOperatorMps,
        contractCoverage,
      },
      source: "registr smluv ⋈ ares ⋈ hlídač státu",
      pass,
    };
  } catch (err) {
    reportLoaderFailure("getMoneyData", err);
    return null;
  }
}
