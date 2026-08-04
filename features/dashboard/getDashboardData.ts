// Server-only loader for /dashboard — reads the REAL materialized knowledge
// graph (the same store as /zebricek, /penize and /zakony) for every headline
// figure the Velín stat strip renders.
//
// ── one aggregate, one owner ────────────────────────────────────────────────
// This loader does NOT re-derive anything. Each figure comes from the loader
// that already owns it, so the dashboard can never disagree with the module it
// links to:
//   ranking + chamber summary + attendance → getLeaderboardData()  (civicscore)
//   public money reachable through MPs      → getMoneyData()       (money)
//   bills → laws                            → getLawData()         (lawwatch)
// The dashboard only picks the fields it shows and passes them through.
//
// ── why the money read is memoized, and why the memo EXPIRES ────────────────
// getMoneyData() walks the whole money layer (~153 k contracts + ~154 k supplies
// edges) and takes ~12 s cold. The graph is a BATCH artifact — it changes with
// `npm run da:kg-compute`, never at request time — so the result is memoized,
// like features/graph/graphLoader.ts does for the map/trail layouts. A failed or
// empty read is never memoized (a transient PGlite hiccup on cold start must not
// disable the tile until a restart).
// The memo is bounded by the page's own revalidation window (./freshness.ts):
// a process-lifetime memo under a declared `revalidate` would regenerate the
// page from the SAME remembered money and stamp it with a fresh build date —
// a freshness claim the code does not honour.
//
// Returns null only when the contribution index itself is unavailable; the money
// and law blocks degrade INDEPENDENTLY to null, and the page renders a labelled
// illustrative tile in place of each one that is missing. Every null path calls
// reportLoaderFailure() so a degradation leaves a trace.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { getLeaderboardData, type LeaderboardEntry } from "@/features/civicscore/getLeaderboardData";
import { MONEY_MEMO_TTL_MS } from "./freshness";
import { getLawData, type LawData } from "@/features/lawwatch/getLawData";
import { getMoneyData } from "@/features/money/getMoneyData";
import type { MoneyData } from "@/features/money/moneyTypes";
import { reviewSummary, type ReviewSummary } from "@/features/money/reviewSummary";
import { storedRefLabel } from "@/features/civicscore/provenance";
import { getRecomputeFact } from "@/features/schranka/getRecomputeFact";
import { buildStateSlice, type StateSlice } from "./stateSlice";
import { buildDatedFacts, type DatedFactLedger, type FactContract } from "./datedFacts";

/**
 * What the DATA says about the formula that authored the ranking — the chamber-wide
 * aggregate, never the first node the loader happened to iterate.
 *
 * The velín used to publish `lb.provenancePass` alone: one confident pass number. That
 * field is already null on a `mixed` store, so the header printed „průchod —" and said
 * nothing about WHY; and it could not say that the store's formula ref differs from the
 * one the code declares (the 2026-07-29 → 08-04 divergence). `LeaderboardData.provenance`
 * carries all of it (`features/civicscore/provenance.ts`) — the dashboard projects the
 * fields it renders and re-derives nothing.
 */
export interface DashboardProvenance {
  /** `uniform` — one `{pass, ref}` across the chamber · `mixed` — a partial recompute ·
   *  `absent` — no person node carries provenance at all. */
  state: "uniform" | "mixed" | "absent";
  /** The pass, when `uniform`; null otherwise — a mixed store HAS no single pass. */
  pass: number | null;
  /** `YYYY-MM-DD` of that pass's `computedAt`, or null when the chamber does not agree
   *  on one day (or carries none). Never invented, never back-dated to today. */
  computedAt: string | null;
  /** How many distinct `{pass, ref}` combinations the chamber carries. */
  distinctCount: number;
  /** Persons carrying a provenance object / persons read. */
  covered: number;
  total: number;
  /** False ⇒ the ranking was authored by a different formula than the code declares. */
  formulaMatch: boolean;
  /** The ref(s) the STORE carries, and the one `lib/analysis/contribution.ts` declares. */
  storedRef: string;
  declaredRef: string;
}

/** Money headline — the /penize attribution rule, not a dashboard-local one. */
export interface DashboardMoney {
  /** Σ contract CZK of firms MPs OWN or RUN — the only money attributable to a politician. */
  attributableCzk: number;
  /** Σ contract CZK of institutions where an MP merely sits on a board. Never folded in. */
  stewardCzk: number;
  mpsWithTies: number;
  companiesLinked: number;
  totalTies: number;
  /**
   * WHAT THE HUMAN GATE HAS ACTUALLY DECIDED — the same four-phase derivation /penize
   * publishes (`features/money/reviewSummary.ts`), not a dashboard-local re-count.
   *
   * The tile's citation used to read „všech {pending} z {total} vazeb čeká na lidskou
   * kontrolu" as a LITERAL. That was true only while the review console could not write;
   * since it can, the first confirmation makes the front door's sentence false, on a page
   * whose whole promise is that a claim never outruns its data. `verifiedTies` /
   * `rejectedTies` were computed by `getMoneyData` and read by nobody here.
   */
  review: ReviewSummary;
  pass: number;
  /**
   * True when the ingest hit a per-company contract ceiling, i.e. the CZK totals are
   * LOWER BOUNDS. /penize renders „nejméně" on exactly this flag; the velín printed the
   * same arithmetic bare, so the two surfaces stated the same number with different
   * confidence. Live today: false — the corpus is not capped.
   */
  isFloor: boolean;
  /** The ceiling and how many companies sit at it — the floor note's own evidence. */
  perCompanyCap: number | null;
  companiesAtCap: number;
}

/** Legislation headline — bill → law edges actually recorded in the graph. */
export interface DashboardLaws {
  bills: number;
  laws: number;
  amends: number;
  /** Body-amended statutes the title-citation `amends` edges are known to MISS. */
  censusUndercount: number;
  /**
   * THE FORENSIC LAYER — round 4's product, invisible on the front door until now.
   * All five numbers were already in `LawData`; the tile rendered bills/laws/amends
   * and nothing else, so the velín advertised the graph's PLUMBING and hid its
   * findings. No new store read: `getLawData()` computes every one of these on the
   * read the dashboard already performs.
   */
  /** Bills carrying a Case-① conflict flag (`flagged_conflict`). */
  flagged: number;
  /** Bills carrying a gated forensic verdict. */
  forensic: number;
  /** Of those, verdicts with ≥1 reader-facing string WITHHELD by the Czech-language
   *  gate — disclosed rather than hidden, like every other suppression here. */
  forensicWithheld: number;
  /** Bills carrying a real e-Sbírka §-diff artifact (not a fabricated before/after). */
  paragraphDiffs: number;
  /** Bills carrying a derived „co to mění" summary; the rest say so themselves. */
  summaries: number;
  pass: number | null;
}

/**
 * One ranked row as the velín's top-5 ledger ACTUALLY renders it.
 *
 * Still a narrow cut of `LeaderboardEntry` — the six component points, the seven raw
 * counters and the PSP9 trend stay out, because this widget renders none of them.
 * What CAME IN (2026-08-04) is the row's own qualifications, which /zebricek has
 * carried for months while the front door printed a bare number beside a name:
 *
 *   `tiedCount`   — a rank is a COMPETITION rank and 55 of 207 MPs share one. Printing
 *                   „1." over a tie, in the red top-3 colour, invents a winner.
 *   the three effort verdicts + `effortRecordedAt` — the low-score corrective exists on
 *                   34 of 207 nodes; without it the velín can print the chamber's
 *                   lowest number beside an MP who never took the oath. The workhorse
 *                   and rapporteur badges are the positive symmetry of the same pass.
 *   `speechTurns` — the figure the workhorse verdict rests on (`DuelFacts.speechTurns`,
 *                   nullable: an un-ingested counter must never render as 0).
 *
 * Every field is already on the `getLeaderboardData()` payload — this adds ZERO store
 * reads and ZERO recomputation, for five rows.
 */
export type DashboardTopEntry = Pick<
  LeaderboardEntry,
  | "pspId"
  | "rank"
  | "name"
  | "clubName"
  | "clubColor"
  | "region"
  | "score"
  | "tiedCount"
  | "effortLowScoreReason"
  | "effortRecordedAt"
  | "effortWorkhorse"
  | "effortWorkhorseFlavour"
  | "effortRapporteurLoad"
> & {
  /** `DuelFacts.speechTurns` — null means the graph carries no counter, never 0. */
  speechTurns: number | null;
};

export interface DashboardData {
  /** Top-N real MPs by contribution_score, for the ranking section. */
  top: DashboardTopEntry[];
  summary: { avg: number; median: number; sigma: number; count: number };
  histogram: { from: number; label: string; count: number }[];
  /** Average attendance across all real MPs, as a 0–100 percentage. */
  attendanceAvgPct: number;
  provenance: DashboardProvenance;
  /** null ⇒ money layer unavailable; the strip shows a labelled illustrative tile. */
  money: DashboardMoney | null;
  /** null ⇒ legislation layer unavailable; the strip shows a labelled illustrative tile. */
  laws: DashboardLaws | null;
  /** The REAL knowledge-graph slice for the state graph, plus the selection rule
   *  the surface prints under it. null ⇒ the canvas falls back to the labelled
   *  `buildStateGraph()` sample. */
  slice: StateSlice | null;
  /** Chronological ledger of REAL dated facts about the slice's entities.
   *  null ⇒ no slice, so the panel keeps the labelled sample feed. */
  feed: DatedFactLedger | null;
  /** `YYYY-MM-DD` on which THIS rendering was produced. The page is statically
   *  generated and revalidated (see ./freshness.ts), so without it a reader
   *  cannot tell whether what they are looking at is hours or months old. */
  builtOn: string;
}

const TOP_N = 5;

const toTopEntry = (e: LeaderboardEntry): DashboardTopEntry => ({
  pspId: e.pspId,
  rank: e.rank,
  name: e.name,
  clubName: e.clubName,
  clubColor: e.clubColor,
  region: e.region,
  score: e.score,
  tiedCount: e.tiedCount,
  effortLowScoreReason: e.effortLowScoreReason,
  effortRecordedAt: e.effortRecordedAt,
  effortWorkhorse: e.effortWorkhorse,
  effortWorkhorseFlavour: e.effortWorkhorseFlavour,
  effortRapporteurLoad: e.effortRapporteurLoad,
  speechTurns: e.duelFacts.speechTurns,
});

// ── memoized money headline (see header) ────────────────────────────────────

let moneyPromise: Promise<MoneyData | null> | null = null;
let moneyMemoAt = 0;

async function readMoneyLayer(): Promise<MoneyData | null> {
  const money = await getMoneyData();
  if (!money) {
    reportLoaderFailure(
      "getDashboardData.money",
      new Error("money layer unavailable — the money tile degrades to the labelled sample"),
    );
    return null;
  }
  return money;
}

/** The whole /penize projection, memoized — the money tile AND the graph slice
 *  both read it, so it must be fetched exactly once per process. */
function moneyLayer(): Promise<MoneyData | null> {
  if (moneyPromise !== null && Date.now() - moneyMemoAt >= MONEY_MEMO_TTL_MS) moneyPromise = null;
  if (moneyPromise === null) {
    moneyMemoAt = Date.now();
    moneyPromise = readMoneyLayer()
      .then((value) => {
        if (value === null) moneyPromise = null; // don't memoize an absent layer
        return value;
      })
      .catch((err) => {
        moneyPromise = null; // don't memoize a transient failure
        reportLoaderFailure("getDashboardData.money", err);
        return null;
      });
  }
  return moneyPromise;
}

function moneyHeadline(money: MoneyData): DashboardMoney {
  const s = money.stats;
  return {
    attributableCzk: s.contractCzkAttributable,
    stewardCzk: s.contractCzkSteward,
    mpsWithTies: s.mpsWithTies,
    companiesLinked: s.companiesLinked,
    totalTies: s.totalTies,
    // The population is deliberately NOT `totalTies` — see reviewSummary.ts's header.
    review: reviewSummary({
      verified: s.verifiedTies,
      pending: s.pendingTies,
      rejected: s.rejectedTies,
    }),
    pass: money.pass,
    isFloor: s.contractCoverage.isFloor,
    perCompanyCap: s.contractCoverage.perCompanyCap,
    companiesAtCap: s.contractCoverage.companiesAtCap,
  };
}

// ── legislation headline ────────────────────────────────────────────────────

async function lawLayer(): Promise<LawData | null> {
  try {
    const law = await getLawData();
    if (!law) {
      reportLoaderFailure(
        "getDashboardData.laws",
        new Error("legislation layer unavailable — the laws tile degrades to the labelled sample"),
      );
      return null;
    }
    return law;
  } catch (err) {
    reportLoaderFailure("getDashboardData.laws", err);
    return null;
  }
}

function lawHeadline(law: LawData): DashboardLaws {
  return {
    bills: law.totalBills,
    laws: law.totalLaws,
    amends: law.totalAmends,
    censusUndercount: law.censusUndercountTotal,
    flagged: law.flaggedCount,
    forensic: law.forensicCount,
    forensicWithheld: law.forensicWithheldCount,
    paragraphDiffs: law.paragraphDiffCount,
    summaries: law.summaryCount,
    pass: law.pass,
  };
}

/**
 * Contracts of the slice's attributable firms, read through the INDEXED
 * neighbourhood primitive (`kgNeighbours`) — one point read per drawn company,
 * never a scan of the 153 k-row `supplies` relation. Only companies the slice
 * actually drew are asked for, so the ledger cannot contain a row whose
 * crosshair points off-canvas.
 */
async function sliceContracts(
  companies: { kgId: string; company: string; refs: string[]; subjectRef: string; pending: boolean }[],
): Promise<FactContract[]> {
  if (companies.length === 0) return [];
  try {
    const store = await getStore();
    if (!store) return [];
    const out: FactContract[] = [];
    for (const c of companies) {
      const { edges, nodes } = await store.kgNeighbours({ id: c.kgId, rels: ["supplies"], limit: 500 });
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const e of edges) {
        const node = byId.get(e.dst);
        if (!node) continue;
        const signedOn = node.props?.signedOn;
        const amount = typeof e.weight === "number" ? e.weight : node.props?.amount;
        out.push({
          id: node.id,
          title: node.label,
          signedOn: typeof signedOn === "string" ? signedOn : null,
          amountCzk: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
          company: c.company,
          refs: c.refs,
          subjectRef: c.subjectRef,
          pending: c.pending,
        });
      }
    }
    return out;
  } catch (err) {
    reportLoaderFailure("getDashboardData.sliceContracts", err);
    return [];
  }
}

/** Party abbrev → its kg node id, so the slice's party node carries a real id
 *  rather than a bare string. Cheap read (8 rows); absence is not fatal. */
async function partyNodeIds(): Promise<Record<string, string>> {
  try {
    const store = await getStore();
    if (!store) return {};
    const parties = await store.listKgNodes({ kind: "party", limit: 50 });
    return Object.fromEntries(parties.map((p) => [p.label, p.id]));
  } catch (err) {
    reportLoaderFailure("getDashboardData.parties", err);
    return {};
  }
}

// ── provenance date ─────────────────────────────────────────────────────────
//
// The recompute date is NOT read here any more. This loader used to run its OWN
// `listKgNodes({kind:"person", limit:1000})` and return the FIRST `computedAt` it
// happened to iterate — two defects in one read:
//
//   1. a small limit makes PGlite walk the `kg_node` primary key and filter by kind
//      instead of using `kg_node_kind_idx`, so it scans the whole ~154 k-row table
//      (measured elsewhere in this repo at 419–723 ms for a handful of rows);
//   2. „the first node's date" is the exact mistake `features/civicscore/provenance.ts`
//      exists to remove — a half-recomputed chamber would be dated by whichever node
//      the iteration reached first.
//
// `getRecomputeFact()` (features/schranka) already owns this fact: ONE indexed read at
// `KG_READ_CAP`, `react.cache()`-wrapped, and it returns a date ONLY when the whole
// chamber agrees on one `{pass, ref, computedAt}` — the same uniformity rule the
// provenance aggregate applies. A non-uniform store yields null and the header says so
// rather than dating the ranking by a pass that may not have recomputed every MP.

export async function getDashboardData(): Promise<DashboardData | null> {
  const lb = await getLeaderboardData();
  if (!lb || lb.entries.length === 0) {
    // buildLeaderboard() reports its own exceptions, but a null store or an
    // empty graph reaches here without a trace otherwise.
    reportLoaderFailure(
      "getDashboardData",
      new Error("contribution index unavailable — /dashboard degrades to the labelled sample"),
    );
    return null;
  }
  const attendanceAvgPct =
    Math.round(
      (lb.entries.reduce((s, e) => s + (1 - e.absenceRate), 0) / lb.entries.length) * 1000,
    ) / 10;

  const [money, law, recompute, partyIds] = await Promise.all([
    moneyLayer(),
    lawLayer(),
    getRecomputeFact(),
    partyNodeIds(),
  ]);

  // The slice needs BOTH layers — a graph slice missing its money or its
  // legislation band could not span the six node kinds it promises, so it is
  // all-or-nothing and falls back to the labelled sample rather than half-drawn.
  let slice: StateSlice | null = null;
  if (money && law) {
    slice = buildStateSlice({
      mps: money.mps,
      bills: law.bills,
      chamberTotal: lb.summary.count,
      clubColorByPspId: Object.fromEntries(lb.entries.map((e) => [e.pspId, e.clubColor])),
      partyNodeIdByLabel: partyIds,
    });
    if (!slice) {
      reportLoaderFailure(
        "getDashboardData.slice",
        new Error("no person carries both a company tie and an amending bill — slice degrades to the sample"),
      );
    }
  }

  // The ledger is built from the slice's own entities, so it exists only when
  // the slice does. `today` comes from the server ONCE and is passed into the
  // pure builder — a fact dated in the future is a data defect, not news, and
  // the builder must stay deterministic for its tests.
  const builtOn = new Date().toISOString().slice(0, 10);
  let feed: DatedFactLedger | null = null;
  if (slice) {
    const contracts = await sliceContracts(slice.sources.contractCompanies);
    feed = buildDatedFacts({
      contracts,
      ties: slice.sources.ties,
      bills: slice.sources.bills,
      today: builtOn,
    });
  }

  return {
    // Trimmed to what the ledger renders — see DashboardTopEntry.
    top: lb.entries.slice(0, TOP_N).map(toTopEntry),
    summary: lb.summary,
    histogram: lb.histogram,
    attendanceAvgPct,
    provenance: {
      state: lb.provenance.state,
      pass: lb.provenance.pass,
      // Only a uniform chamber has ONE recompute date; `getRecomputeFact` enforces that.
      computedAt: recompute?.computedAt ?? null,
      distinctCount: lb.provenance.distinctCount,
      covered: lb.provenance.covered,
      total: lb.provenance.total,
      formulaMatch: lb.provenance.formulaMatch,
      storedRef: storedRefLabel(lb.provenance),
      declaredRef: lb.provenance.declaredRef,
    },
    money: money ? moneyHeadline(money) : null,
    laws: law ? lawHeadline(law) : null,
    slice,
    feed,
    builtOn,
  };
}
