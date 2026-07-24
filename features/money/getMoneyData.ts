// Server-only: the REAL FollowTheMoney read for /penize. Walks the materialized
// money layer of the knowledge graph — person --linked_to--> company
// --supplies--> contract, plus subsidy/donation props on the company node — and
// shapes it into the typed props the /penize surface renders. Degrades
// gracefully to null (→ the page keeps its labelled mock) if no store is
// configured, the money layer hasn't been materialized, or PGlite is
// unavailable at request time — so introducing the store read can never break
// the page.
//
// TRUST IS THE PRODUCT: every MP↔company `linked_to` edge is human-gated
// (props.review_state). Ties that have not passed review are surfaced as
// pending_review and excluded from `verifiedCount`/any score — exactly as the
// mock's verified:false ties. Nothing here is presented as an accusation.
//
// Called only from the /penize server component; getStore() carries its own
// client guard, so this must never be imported into a client component.

import { getStore } from "@/lib/db/store";
import type {
  MoneyData,
  MoneyGraphData,
  MoneyMp,
  MoneyMpStub,
  MoneyTie,
  ReviewState,
} from "./moneyTypes";

const TERM = "PSP10";
const GRAPH_COMPANY_CAP = 5; // companies rendered in the featured entity graph

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}

export async function getMoneyData(): Promise<MoneyData | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
    const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
    const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
    const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });
    // No money layer materialized yet → hand back null, page keeps its mock.
    if (linked.length === 0 || companies.length === 0) return null;

    // company id → {count, czk} reachable via supplies
    const contractByCompany = new Map<string, { count: number; czk: number }>();
    for (const e of supplies) {
      const agg = contractByCompany.get(e.src) ?? { count: 0, czk: 0 };
      agg.count += 1;
      agg.czk += num(e.weight);
      contractByCompany.set(e.src, agg);
    }

    const companyById = new Map(companies.map((c) => [c.id, c]));
    const personById = new Map(persons.map((p) => [p.id, p]));

    // personPspId → club abbrev (clubByMandate keys on the MANDATE psp id).
    const clubByPerson = new Map<number, string>();
    try {
      const mandates = await store.listMandates({ termCode: TERM });
      const clubByMandate = await store.clubByMandate(TERM);
      for (const m of mandates) {
        const club = clubByMandate.get(m.pspId);
        if (club) clubByPerson.set(m.personPspId, club);
      }
    } catch (err) {
      // clubs are decorative here — absence must not drop the money picture.
      console.warn("[getMoneyData] club resolution failed; continuing without clubs", err);
    }

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
      const contracts = contractByCompany.get(comp.id) ?? { count: 0, czk: 0 };
      const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
      const reviewState: ReviewState = rawState === "verified" ? "verified" : "pending_review";
      if (reviewState === "verified") verifiedTies += 1;
      else pendingTies += 1;

      const tie: MoneyTie = {
        companyId: comp.id,
        ico: String(cp.ico ?? comp.id.split(":").pop() ?? ""),
        company: comp.label,
        role: String(e.props?.role ?? ""),
        reviewState,
        source: String(e.props?.source ?? ""),
        contractCount: contracts.count,
        contractCzk: contracts.czk,
        subsidiesCount: num(cp.subsidies_count),
        subsidiesCzk: num(cp.subsidies_total_czk),
        donatedToPartyCzk: cp.donated_to_party_czk != null ? num(cp.donated_to_party_czk) : null,
        donationRecipientParty:
          cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
      };

      const arr = tiesByPerson.get(e.src) ?? [];
      arr.push(tie);
      tiesByPerson.set(e.src, arr);
      distinctCompanies.add(comp.id);
      if (!reachableSeen.has(comp.id)) {
        reachableSeen.add(comp.id);
        contractCzkReachable += contracts.czk;
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

    const pass = num((linked[0]?.provenance as Record<string, unknown> | undefined)?.pass) || 0;

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
  } catch {
    return null;
  }
}
