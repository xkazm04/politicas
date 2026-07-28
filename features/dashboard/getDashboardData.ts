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
import { buildStateSlice, type StateSlice } from "./stateSlice";
import { buildDatedFacts, type DatedFactLedger, type FactContract } from "./datedFacts";

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

/**
 * One ranked row as the velín's top-5 ledger ACTUALLY renders it: rank, name,
 * club chip, region, score. The full `LeaderboardEntry` additionally carries the
 * six component points, seven raw counters, the PSP9 trend and four effort-loop
 * enrichment fields — real data, none of which this widget reads, and all of
 * which would be serialized into the client payload for five rows. Same
 * reasoning as `LeaderboardListEntry` (/zebricek); the dashboard needs a
 * narrower cut still, because it renders neither components nor badges.
 */
export type DashboardTopEntry = Pick<
  LeaderboardEntry,
  "pspId" | "rank" | "name" | "clubName" | "clubColor" | "region" | "score"
>;

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
    provenance: { pass: lb.provenancePass, computedAt },
    money: money ? moneyHeadline(money) : null,
    laws: law ? lawHeadline(law) : null,
    slice,
    feed,
    builtOn,
  };
}
