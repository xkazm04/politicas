// Server-only: shared raw-data fetch for the /penize surfaces. Both getMoneyData.ts
// (the ledger) and getMpDetail.ts (the per-MP case file) walk the SAME materialized
// money layer of the knowledge graph — person --linked_to--> company --supplies-->
// contract — so this module is the single place that fetches it, keeping the two
// loaders from drifting (e.g. one aggregating contract amounts differently than the
// other). Degrades to null exactly like the loaders that use it: no store, no
// materialized money layer, or a fetch error → null, never a partial/guessed shape.
//
// The `server-only` import makes any client-component import a build-time error.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import { asUnion } from "@/lib/db/narrow";
import { CORROBORATIONS, type ContractLine, type MoneyTie, type ReviewState } from "./moneyTypes";
import { classifyTie, isDeMinimis, nearThresholdCount, reviewRank, reviewSignal, reviewTier } from "./reviewTypes";
import { KG_READ_CAP } from "@/lib/db/readCap";

const TERM = "PSP10";
const CONTRACT_LINES_PER_COMPANY = 400; // generous cap; UI slices its own top-N

/** `props` is a jsonb blob (see lib/db/types.ts) with no schema guarantee an
 * amount landed as a JS number rather than a numeric string. Treating every
 * non-number as "worth zero" conflates that common serialization shape with a
 * genuinely absent value, silently undercounting reachable money. Attempt a
 * real parse first; only a truly absent/unparseable value defaults to 0. */
export function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
    console.warn(`[moneyLoader] num() could not parse numeric string: ${JSON.stringify(v)}`);
  }
  return 0;
}

export function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}

export interface CompanyContracts {
  count: number;
  czk: number;
  amounts: number[]; // for near-threshold detection
  lines: ContractLine[]; // sorted by amount desc, capped at CONTRACT_LINES_PER_COMPANY
}

/**
 * The ONE place a `linked_to` edge becomes a MoneyTie. Both /penize (ledger) and
 * /penize/[pspId] (case file) rendered the identical 25-field projection from
 * hand-copied blocks; a new tie prop had to be added twice and silently diverged
 * otherwise. `MoneyTieDetail` is this plus its contract lines — the caller
 * spreads and extends, it does not re-map.
 * See docs/architect/decisions/2026-07-26-money-tie-mapper-dedup.md.
 */
export function mapLinkedToTie(args: {
  edge: KgEdgeRow;
  company: KgNodeRow;
  contracts: CompanyContracts;
  /** the tied person node — only `absentee_manager_lead` is read (signal input). */
  person: KgNodeRow | undefined;
}): MoneyTie {
  const { edge: e, company: comp, contracts, person } = args;
  const cp = comp.props ?? {};
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
  const absenteeManagerLead = Boolean(person?.props?.absentee_manager_lead);
  const corroboration = asUnion(e.props?.corroboration, CORROBORATIONS, null);

  return {
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
    donationRecipientParty: cp.donation_recipient_party != null ? String(cp.donation_recipient_party) : null,
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
}

export interface MoneyLayer {
  companies: KgNodeRow[];
  persons: KgNodeRow[];
  linked: KgEdgeRow[];
  companyById: Map<string, KgNodeRow>;
  personById: Map<string, KgNodeRow>;
  clubByPerson: Map<number, string>;
  /** company kg_node id → its supplies-reachable contracts, aggregated + line items.
   *
   *  CONTAINS UNTIED COMPANIES. Since the batch-012 re-ingest the graph holds contracts
   *  for companies that are in it only as ownership PARENTS (Ministerstvo financí, Praha,
   *  ČSOB, České dráhy …) and have no `linked_to` tie to any MP at all — 6.68 tn CZK of
   *  public-body activity that no politician may be associated with. Anything that
   *  aggregates "money reachable through MPs" MUST intersect this with `tiedCompanyIds`
   *  (or iterate `linked`), never sum it whole. */
  contractsByCompany: Map<string, CompanyContracts>;
  /** Companies with at least one `linked_to` tie — the ONLY ones whose contracts may be
   *  attributed to a politician. Derived here so no consumer has to re-derive it (and get
   *  it wrong). */
  tiedCompanyIds: Set<string>;
  /** the pass that materialized the money layer (self-awareness surface). */
  pass: number;
}

export async function loadMoneyLayer(): Promise<MoneyLayer | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company", "contract"]))) return null;

    const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
    const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
    const contracts = await store.listKgNodes({ kind: "contract", limit: KG_READ_CAP });
    const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
    const supplies = await store.listKgEdges({ rel: "supplies", limit: KG_READ_CAP });
    if (linked.length === 0 || companies.length === 0) return null;

    const companyById = new Map(companies.map((c) => [c.id, c]));
    const personById = new Map(persons.map((p) => [p.id, p]));
    const contractById = new Map(contracts.map((c) => [c.id, c]));

    const contractsByCompany = new Map<string, CompanyContracts>();
    for (const e of supplies) {
      const cur = contractsByCompany.get(e.src) ?? { count: 0, czk: 0, amounts: [], lines: [] };
      const ct = contractById.get(e.dst);
      const amount = num(e.weight) || num(ct?.props?.amount);
      cur.count += 1;
      cur.czk += amount;
      if (amount > 0) cur.amounts.push(amount);
      if (cur.lines.length < CONTRACT_LINES_PER_COMPANY) {
        cur.lines.push({
          id: e.dst,
          label: ct?.label ?? e.dst,
          amountCzk: amount > 0 ? amount : null,
          signedOn: (ct?.props?.signedOn as string | null | undefined) ?? null,
        });
      }
      contractsByCompany.set(e.src, cur);
    }
    for (const agg of contractsByCompany.values()) {
      agg.lines.sort((a, b) => (b.amountCzk ?? 0) - (a.amountCzk ?? 0));
    }

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
      console.warn("[moneyLoader] club resolution failed; continuing without clubs", err);
    }

    const pass = num((linked[0]?.provenance as Record<string, unknown> | undefined)?.pass) || 0;

    const tiedCompanyIds = new Set(linked.map((e) => e.dst));

    return {
      companies,
      persons,
      linked,
      companyById,
      personById,
      clubByPerson,
      contractsByCompany,
      tiedCompanyIds,
      pass,
    };
  } catch (err) {
    reportLoaderFailure("moneyLoader.loadMoneyLayer", err);
    return null;
  }
}
