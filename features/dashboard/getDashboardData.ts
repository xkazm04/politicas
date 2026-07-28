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
// ── why the money read is memoized ──────────────────────────────────────────
// getMoneyData() walks the whole money layer (~153 k contracts + ~154 k supplies
// edges) and takes ~12 s cold. The graph is a BATCH artifact — it changes with
// `npm run da:kg-compute`, never at request time — so the result is memoized for
// the process lifetime, exactly like features/graph/graphLoader.ts does for the
// map/trail layouts. A failed or empty read is never memoized (a transient
// PGlite hiccup on cold start must not disable the tile until a restart).
//
// Returns null only when the contribution index itself is unavailable; the money
// and law blocks degrade INDEPENDENTLY to null, and the page renders a labelled
// illustrative tile in place of each one that is missing. Every null path calls
// reportLoaderFailure() so a degradation leaves a trace.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { getLeaderboardData, type LeaderboardEntry } from "@/features/civicscore/getLeaderboardData";
import { getLawData, type LawData } from "@/features/lawwatch/getLawData";
import { getMoneyData } from "@/features/money/getMoneyData";
import type { MoneyData } from "@/features/money/moneyTypes";
import { buildStateSlice, type StateSlice } from "./stateSlice";

/** Which kg pass authored the contribution index, and when it ran. */
export interface DashboardProvenance {
  pass: number | null;
  /** `YYYY-MM-DD` of that pass's `computedAt`, or null when the node carries none. */
  computedAt: string | null;
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
  /** Ties still awaiting the human gate — the whole population today. */
  pendingTies: number;
  pass: number;
}

/** Legislation headline — bill → law edges actually recorded in the graph. */
export interface DashboardLaws {
  bills: number;
  laws: number;
  amends: number;
  /** Body-amended statutes the title-citation `amends` edges are known to MISS. */
  censusUndercount: number;
  pass: number | null;
}

export interface DashboardData {
  /** Top-N real MPs by contribution_score, for the ranking section. */
  top: LeaderboardEntry[];
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
}

const TOP_N = 5;

// ── memoized money headline (see header) ────────────────────────────────────

let moneyPromise: Promise<MoneyData | null> | null = null;

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
  moneyPromise ??= readMoneyLayer()
    .then((value) => {
      if (value === null) moneyPromise = null; // don't memoize an absent layer
      return value;
    })
    .catch((err) => {
      moneyPromise = null; // don't memoize a transient failure
      reportLoaderFailure("getDashboardData.money", err);
      return null;
    });
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
    pendingTies: s.pendingTies,
    pass: money.pass,
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
    pass: law.pass,
  };
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

/**
 * The date the contribution index was last computed, read from the person nodes'
 * own `contribution_provenance.computedAt`. The header used to print a hardcoded
 * literal; a recompute date that is not the recompute date is a fabricated number
 * like any other.
 */
async function contributionComputedAt(): Promise<string | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
    for (const p of persons) {
      const prov = p.props?.contribution_provenance as { computedAt?: unknown } | undefined;
      const at = prov?.computedAt;
      // ISO timestamp → date only; lib/format's date formatters take `YYYY-MM-DD`.
      if (typeof at === "string" && /^\d{4}-\d{2}-\d{2}/.test(at)) return at.slice(0, 10);
    }
    return null;
  } catch (err) {
    reportLoaderFailure("getDashboardData.provenance", err);
    return null;
  }
}

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

  const [money, law, computedAt, partyIds] = await Promise.all([
    moneyLayer(),
    lawLayer(),
    contributionComputedAt(),
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

  return {
    top: lb.entries.slice(0, TOP_N),
    summary: lb.summary,
    histogram: lb.histogram,
    attendanceAvgPct,
    provenance: { pass: lb.provenancePass, computedAt },
    money: money ? moneyHeadline(money) : null,
    laws: law ? lawHeadline(law) : null,
    slice,
  };
}
