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
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { storeReady } from "@/lib/db/readiness";
import { getStore, type Store } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import { asUnion } from "@/lib/db/narrow";
import { byListOrder } from "@/lib/db/kgOrder";
import { CORROBORATIONS, type ContractLine, type MoneyTie, type ReviewState } from "./moneyTypes";
import { isDeMinimis, nearThresholdCount, resolveReviewOrder, resolveTieClass, reviewSignal } from "./reviewTypes";
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

/** Per-company contract aggregate. NO line items: a contract's label and signature date
 *  live on the `contract` NODE, and reading 152 788 of them costs 7.8 s to answer a
 *  question only the per-MP case file asks. Measured on the live store: of the 153 731
 *  `supplies` edges, 33 628 carry no weight — and every single one of those points at a
 *  contract node with no `amount` either, so the node scan contributed exactly 0 CZK to
 *  any aggregate. Line items are fetched per company on the case-file path
 *  (`loadMpMoneySlice`), where 8 of them render. */
export interface CompanyContracts {
  count: number;
  czk: number;
  amounts: number[]; // for near-threshold detection
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
  // Precedence, not recomputation: a class a reviewer or an analysis batch wrote onto the
  // edge wins over `classifyTie`'s substring guess (see resolveTieClass). The heuristic
  // travels along so the surface can show the disagreement instead of silently picking.
  const cls = resolveTieClass(e.props?.tie_class, role, comp.label);
  const tieClass = cls.tieClass;
  const triangle = contractCzk > 0 && subsidiesCzk > 0 && (donatedToPartyCzk ?? 0) > 0;
  const near = nearThresholdCount(contracts.amounts);
  const absenteeManagerLead = Boolean(person?.props?.absentee_manager_lead);
  const corroboration = asUnion(e.props?.corroboration, CORROBORATIONS, null);
  const order = resolveReviewOrder({
    storedTier: e.props?.review_tier,
    storedRank: e.props?.review_rank,
    tieClass,
    corroboration,
    contractCzk,
    subsidiesCzk,
  });

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
    tieClassOrigin: cls.origin,
    tieClassHeuristic: cls.heuristic,
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
    reviewTier: order.reviewTier,
    reviewRank: order.reviewRank,
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

/** personPspId → club abbreviation. Registry tables (207 mandates), not the graph.
 *  Clubs are decorative here: their absence must never drop the money picture. */
async function loadClubs(store: Store): Promise<Map<number, string>> {
  const clubByPerson = new Map<number, string>();
  try {
    const mandates = await store.listMandates({ termCode: TERM });
    const clubByMandate = await store.clubByMandate(TERM);
    for (const m of mandates) {
      const club = clubByMandate.get(m.pspId);
      if (club) clubByPerson.set(m.personPspId, club);
    }
  } catch (err) {
    console.warn("[moneyLoader] club resolution failed; continuing without clubs", err);
  }
  return clubByPerson;
}

/**
 * The whole-corpus read, for the two surfaces that genuinely need every tie: the
 * `/penize` ledger and the `/penize/kontrola` console.
 *
 * `cache()`-wrapped, so a request that touches the ledger and something derived from it
 * pays for the layer once (the same treatment `getProfileData`, `getLawData` and
 * `getLeaderboardData` already have). React's `cache` is a no-op outside a request scope,
 * so tests and scripts still see a fresh read per call.
 */
export const loadMoneyLayer = cache(async function loadMoneyLayer(): Promise<MoneyLayer | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company", "contract"]))) return null;

    // Three cheap kind/rel lists (632 rows on the live store) + ONE supplies scan.
    // The `contract` NODE scan that used to sit here is gone — see CompanyContracts.
    const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
    const persons = await store.listKgNodes({ kind: "person", limit: KG_READ_CAP });
    const linked = await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP });
    const supplies = await store.listKgEdges({ rel: "supplies", limit: KG_READ_CAP });
    if (linked.length === 0 || companies.length === 0) return null;

    const companyById = new Map(companies.map((c) => [c.id, c]));
    const personById = new Map(persons.map((p) => [p.id, p]));

    const contractsByCompany = new Map<string, CompanyContracts>();
    for (const e of supplies) {
      const cur = contractsByCompany.get(e.src) ?? { count: 0, czk: 0, amounts: [] };
      const amount = num(e.weight);
      cur.count += 1;
      cur.czk += amount;
      if (amount > 0) cur.amounts.push(amount);
      contractsByCompany.set(e.src, cur);
    }

    const clubByPerson = await loadClubs(store);
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
});

/** One MP's money, read through the INDEX only — never a whole-relation scan. */
export interface MpMoneySlice {
  person: KgNodeRow;
  club: string | null;
  /** the MP's `linked_to` edges, in `listKgEdges` order (see byListOrder). */
  ties: KgEdgeRow[];
  companyById: Map<string, KgNodeRow>;
  contractsByCompany: Map<string, CompanyContracts>;
  /** company id → its contract line items, amount desc, capped like the ledger's. */
  linesByCompany: Map<string, ContractLine[]>;
  pass: number;
}

/**
 * The `/penize/[pspId]` read. Two index scans per tie instead of five whole-relation
 * scans per request: `kg_edge_src_idx` for the MP's `linked_to` edges (median 2, max 14
 * on the live store), then `kg_edge_dst_idx`/`src_idx` per tied company for its
 * `supplies` — and `kgNeighbours` returns the far-end nodes with them, so the contract
 * labels and signature dates arrive without a 152 788-row node scan.
 *
 * ORDERING. `kgNeighbours` orders by `weight desc nulls last`, which is NOT a total
 * order — `linked_to` weights are all null and contract amounts repeat, so Postgres may
 * return equal-weight rows in any order, differing between runs of the same build. Every
 * edge set here is re-sorted into `listKgEdges`' `(src, rel, dst)` order before anything
 * reads it: that keeps the render reproducible AND byte-identical to the scan-based
 * version this replaced, down to the floating-point order of the CZK sum.
 */
export const loadMpMoneySlice = cache(async function loadMpMoneySlice(
  pspId: number,
): Promise<MpMoneySlice | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    if (!(await storeReady(store, ["person", "company", "contract"]))) return null;

    const personId = `psp:person:${pspId}`;
    const [person] = await store.getKgNodes([personId]);
    if (!person) return null;

    const tieRead = await store.kgNeighbours({ id: personId, rels: ["linked_to"], limit: KG_READ_CAP });
    // Only edges where this MP is the SOURCE are the MP's own ties; kgNeighbours'
    // second leg would also return an edge pointing AT the person node.
    const ties = tieRead.edges.filter((e) => e.src === personId).sort(byListOrder);
    if (ties.length === 0) return null;

    const companyById = new Map(
      tieRead.nodes.filter((n) => n.kind === "company").map((n) => [n.id, n] as const),
    );

    const contractsByCompany = new Map<string, CompanyContracts>();
    const linesByCompany = new Map<string, ContractLine[]>();
    for (const comp of companyById.values()) {
      const supplied = await store.kgNeighbours({ id: comp.id, rels: ["supplies"], limit: KG_READ_CAP });
      const edges = supplied.edges.filter((e) => e.src === comp.id).sort(byListOrder);
      const nodeById = new Map(supplied.nodes.map((n) => [n.id, n]));
      const agg: CompanyContracts = { count: 0, czk: 0, amounts: [] };
      const lines: ContractLine[] = [];
      for (const e of edges) {
        const ct = nodeById.get(e.dst);
        // Weight ONLY — the identical rule the ledger's aggregate uses, so the two
        // surfaces cannot report different money for the same company. The contract node
        // is read here for its label and signature date, not for a second amount source:
        // measured over all 153 731 `supplies` edges, every one of the 33 628 with no
        // weight points at a node with no `amount` either, so the old `|| props.amount`
        // fallback rescued nothing and only created a way for the two paths to drift.
        const amount = num(e.weight);
        agg.count += 1;
        agg.czk += amount;
        if (amount > 0) agg.amounts.push(amount);
        if (lines.length < CONTRACT_LINES_PER_COMPANY) {
          lines.push({
            id: e.dst,
            label: ct?.label ?? e.dst,
            amountCzk: amount > 0 ? amount : null,
            signedOn: (ct?.props?.signedOn as string | null | undefined) ?? null,
          });
        }
      }
      lines.sort((a, b) => (b.amountCzk ?? 0) - (a.amountCzk ?? 0));
      contractsByCompany.set(comp.id, agg);
      linesByCompany.set(comp.id, lines);
    }

    const clubByPerson = await loadClubs(store);
    const pass = num((ties[0]?.provenance as Record<string, unknown> | undefined)?.pass) || 0;

    return {
      person,
      club: clubByPerson.get(pspId) ?? null,
      ties,
      companyById,
      contractsByCompany,
      linesByCompany,
      pass,
    };
  } catch (err) {
    reportLoaderFailure("moneyLoader.loadMpMoneySlice", err);
    return null;
  }
});
