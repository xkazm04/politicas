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
// pending_review and excluded from `verifiedCount`/any score.
//
// The three counts (`verifiedTies` / `pendingTies` / `rejectedTies`) are the
// page's ONLY source for what the gate has decided. They used to be computed
// and rendered nowhere, while two hard-coded sentences asserted that everything
// was still pending — true only until the console could write `verified`, which
// it has been able to since e8bf6c8. See `reviewSummary.ts`.
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
import { bucketReachCzk, reachableMoney, tieReach, type ReachableTie } from "./reachableMoney";
import {
  GRAPH_COMPANY_CAP,
  type MoneyData,
  type MoneyGraphData,
  type MoneyMp,
  type MoneyMpStub,
  type MoneyTie,
} from "./moneyTypes";

export async function getMoneyData(): Promise<MoneyData | null> {
  try {
    const layer = await loadMoneyLayer();
    if (!layer) return null;
    const { persons, linked, companyById, personById, clubByPerson, contractsByCompany, pass, mandatesTotal } =
      layer;

    // Group ties by MP.
    const tiesByPerson = new Map<string, MoneyTie[]>();
    const distinctCompanies = new Set<string>();
    let verifiedTies = 0;
    let pendingTies = 0;
    let rejectedTies = 0;
    /** Every tie that survived resolution, handed to THE shared money definition
     *  (reachableMoney.ts) — per-company de-duplication and the steward/attributable
     *  split are not this surface's private choices. */
    const reachable: ReachableTie[] = [];

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

      const contracts = contractsByCompany.get(comp.id) ?? { count: 0, czk: 0, amounts: [] };
      const tie = mapLinkedToTie({ edge: e, company: comp, contracts, person: pnode });
      if (tie.reviewState === "verified") verifiedTies += 1;
      else if (tie.reviewState === "pending_review") pendingTies += 1;
      else if (tie.reviewState === "rejected") rejectedTies += 1;

      const arr = tiesByPerson.get(e.src) ?? [];
      arr.push(tie);
      tiesByPerson.set(e.src, arr);
      distinctCompanies.add(comp.id);
      reachable.push({
        companyId: comp.id,
        tieClass: tie.tieClass,
        contractCount: tie.contractCount,
        contractCzk: tie.contractCzk,
        subsidiesCzk: tie.subsidiesCzk,
        donatedToPartyCzk: tie.donatedToPartyCzk,
      });
    }
    const money = reachableMoney(reachable);

    const mps: MoneyMp[] = [];
    for (const [personId, ties] of tiesByPerson) {
      const pnode = personById.get(personId);
      const pspId = pspIdFromNodeId(personId);
      if (!pnode || pspId == null) continue;
      // Strongest evidence first within a case file (reviewRank — tier
      // ascending, reachable CZK descending only within a tier). Was sorted
      // by raw money, contradicting this very comment (UX audit 2026-07-27, #4).
      ties.sort((a, b) => a.reviewRank - b.reviewRank);
      // The two class-MIXING totals this used to carry (`totalContractCzk` /
      // `totalSubsidiesCzk`) were the ranking key, so the "strongest case file" — the one
      // the front page draws as a graph — was most often the MP who sits on the
      // supervisory board of the biggest hospital. Both sides now come from THE shared
      // definition, per company de-duplicated and split by class.
      // `MoneyTie` structurally satisfies `ReachableTie` — no projection, no second shape.
      const perMp = reachableMoney(ties);
      mps.push({
        pspId,
        name: pnode.label,
        club: clubByPerson.get(pspId) ?? null,
        absenteeManagerLead: Boolean(pnode.props?.absentee_manager_lead),
        ties,
        verifiedCount: ties.filter((t) => t.reviewState === "verified").length,
        pendingCount: ties.filter((t) => t.reviewState === "pending_review").length,
        attributableReachCzk: bucketReachCzk(perMp.attributable),
        stewardReachCzk: bucketReachCzk(perMp.steward),
      });
    }
    // THE selection rule, stated on the page beside the graph it decides: MPs ordered by
    // ATTRIBUTABLE reach descending — money reaching firms the MP owns or runs. Steward
    // money never enters the key, because /penize's own methodology says it is the
    // institution's. Ties broken by pspId ascending so the order is total and stable
    // (a registry number makes no claim), never by name collation.
    mps.sort((a, b) => b.attributableReachCzk - a.attributableReachCzk || a.pspId - b.pspId);

    // MPs with no tie — absence of a finding is also a finding.
    const tiedPersonIds = new Set(tiesByPerson.keys());
    const mpsWithoutTies: MoneyMpStub[] = persons
      .filter((p) => !tiedPersonIds.has(p.id))
      .map((p) => ({ pspId: pspIdFromNodeId(p.id), name: p.label }))
      .filter((s): s is { pspId: number; name: string } => s.pspId != null)
      .map((s) => ({ ...s, club: clubByPerson.get(s.pspId) ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));

    // Featured entity graph = the case file the SELECTION RULE above picks, i.e. the
    // heaviest ATTRIBUTABLE reach. An MP whose whole file is steward seats is never
    // featured: there is no claim to draw, so rather than crowning a waterworks board the
    // graph stays empty and the page falls back to its labelled mock.
    let graph: MoneyGraphData | null = null;
    const lead = mps.find((mp) => mp.attributableReachCzk > 0);
    if (lead) {
      graph = {
        mp: { pspId: lead.pspId, name: lead.name, club: lead.club },
        selectedByCzk: lead.attributableReachCzk,
        // Populace PŘED řezem — obrázek pak umí přiznat, že je výřez.
        companiesTotal: lead.ties.length,
        companies: lead.ties.slice(0, GRAPH_COMPANY_CAP).map((t) => {
          const reach = tieReach(t);
          return {
            id: t.companyId,
            company: t.company,
            role: t.role,
            reviewState: t.reviewState,
            tieClass: t.tieClass,
            reachCzk: reach.czk,
            attributable: reach.attributable,
            donatedToPartyCzk: t.donatedToPartyCzk,
            donationRecipientParty: t.donationRecipientParty,
          };
        }),
      };
    }

    // The finding, and how much of it is a RECORDED class rather than a substring guess.
    // `classifyTie`'s derived class carries no registry fact (see `tieClassOriginInfo`),
    // so a count that mixes the two may not sit under a bare ARES citation.
    const ownerOperator = mps.filter((mp) => mp.ties.some((t) => t.tieClass === "owner-operator"));
    const ownerOperatorMps = ownerOperator.length;
    const ownerOperatorMpsStoredClass = ownerOperator.filter((mp) =>
      mp.ties.some((t) => t.tieClass === "owner-operator" && t.tieClassOrigin === "stored"),
    ).length;

    return {
      mps,
      mpsWithoutTies,
      graph,
      stats: {
        mpsWithTies: mps.length,
        // The tile's own denominator, read from the mandate registry rather than
        // written into the copy. `null` when the registry read failed — the sentence
        // then states no denominator at all (a floor, not a zero).
        mandatesTotal,
        companiesLinked: distinctCompanies.size,
        money,
        // Views onto `money`, kept because /dashboard's headline reads them by these
        // names. Derived here in one expression so they cannot drift from the shared
        // definition — never recompute either of them anywhere.
        contractCzkAttributable: money.attributable.contractCzk,
        contractCzkSteward: money.steward.contractCzk,
        contractCoverage: money.coverage,
        totalTies: linked.length,
        verifiedTies,
        pendingTies,
        rejectedTies,
        ownerOperatorMps,
        ownerOperatorMpsStoredClass,
      },
      source: "registr smluv ⋈ ares ⋈ hlídač státu",
      pass,
    };
  } catch (err) {
    reportLoaderFailure("getMoneyData", err);
    return null;
  }
}
