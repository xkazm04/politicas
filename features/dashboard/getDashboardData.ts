// Server-only loader for /dashboard — reads the REAL materialized knowledge
// graph (the same store as /zebricek, /penize and /zakony) for every headline
// figure the Velín stat strip renders.
//
// ── one aggregate, one owner ────────────────────────────────────────────────
// Each figure comes from the loader that already owns it, so the dashboard can
// never disagree with the module it links to:
//   ranking + chamber summary + attendance → getLeaderboardData()  (civicscore)
//   public money reachable through MPs      → getMoneyData()       (money)
//   bills → laws                            → getLawData()         (lawwatch)
// The dashboard picks the fields it shows and passes them through.
//
// ONE EXCEPTION, named rather than hidden: `attendance`. The header used to
// claim this loader "re-derives nothing" while `getDashboardData` folded 207 rows
// of `absenceRate` into a mean right below it. The mean is kept HERE on purpose —
// it is a figure only /dashboard renders (the civicscore payload publishes the
// per-MP rate, and pushing a dashboard-only aggregate into the chamber pass would
// make every other surface carry it) — but the input is the owner's, the fold is
// one line, and no other surface computes a second version of it. If a second
// surface ever prints chamber attendance, the mean moves to civicscore and this
// note goes with it.
// What the mean MEASURES is the omluvy register — `absence_rate` is
// `excusedDays / sessionDays` (lib/analysis/contribution.ts), the same input the
// index's docházka component scores — and the tile says so and cites psp.cz omluvy.
// It is NOT the roll-call participation rate, which is a different figure from a
// different dump and lives in `participationRate`.
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
import { buildStateSlice, type StateSlice } from "./stateSlice";
import {
  buildDatedFacts,
  FEED_ROWS,
  type ContractLayerRead,
  type DatedFactLedger,
  type FactContract,
} from "./datedFacts";

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

/**
 * CHAMBER ATTENDANCE, WITH ITS POPULATION.
 *
 * The tile used to print one number folded out of 207 rows through `num()`, so an MP
 * whose node carries no `absence_rate` entered the mean as `0` — a politician with
 * PERFECT attendance, invented by a coercion. `LeaderboardEntry.absenceRate` is now
 * nullable and this fold excludes nulls; what is left is a mean over a POPULATION, so
 * the population travels with it and the tile prints it whenever it is smaller than
 * the chamber. A missing figure is never read as a value in either direction.
 */
export interface DashboardAttendance {
  /** Mean share of session days with NO excuse filed, 0–100 %. `null` ⇒ not one MP
   *  carries the figure, so no mean exists — the tile says that rather than print 0. */
  avgPct: number | null;
  /** How many MPs entered the mean (those carrying `absence_rate`). */
  counted: number;
  /** How many MPs the chamber pass read — the denominator `counted` is read against. */
  total: number;
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
  /** Chamber attendance derived from the omluvy register, WITH the population it
   *  was averaged over — see `DashboardAttendance`. */
  attendance: DashboardAttendance;
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
  /** How the ledger's contract layer was read — see `ContractLayerRead`.
   *  null ⇒ there is no slice, so no contract read was attempted at all (which is a
   *  different thing from a read that failed, and the page keeps them apart). */
  factContracts: ContractLayerRead | null;
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
 * Strop hran na firmu. `kgNeighbours` defaultuje na **500**, což je pod
 * průměrem ~784 `supplies` hran na firmu — a tenhle loader ten default psal
 * doslova. Cena mlčení je změřená jinde v repu: /denik takhle ztratil
 * **4 872 smluv** (5 z 35 čtených firem vrátilo přesně 500), než si detektor
 * dopsal ručně. Pět tisíc je JEHO číslo (`MAX_CONTRACT_EDGES`,
 * features/denik/getDenikData.ts) a jeho měření: živý graf měl v maximu 2 387
 * hran na firmu, 0 firem useknutých. Výřez velína čte PODMNOŽINU týchž firem
 * týmž `rel`, takže na tomtéž korpusu neseká nic — konstanta se tu deklaruje
 * znovu jen proto, že tamta není exportovaná; obě popisují jeden strop.
 */
const MAX_SLICE_CONTRACT_EDGES = 5_000;

/**
 * Contracts of the slice's attributable firms, read through the INDEXED
 * neighbourhood primitive (`kgNeighbours`) — one point read per drawn company,
 * never a scan of the 153 k-row `supplies` relation. Only companies the slice
 * actually drew are asked for, so the ledger cannot contain a row whose
 * crosshair points off-canvas.
 *
 * Useknutí se HLÁSÍ (`reportLoaderFailure`), nikdy neprojde tiše: dotaz je
 * řazený podle váhy sestupně, takže co zmizí, nezmizí náhodně — jsou to
 * vždycky nejlevnější smlouvy té nejzaměstnanější firmy, a kniha faktů by o
 * nich mlčky tvrdila, že neexistují. Táž heuristika jako `warnIfTruncated`
 * v lib/db (délka výsledku přesně na stropu = pravděpodobně useknuto), který
 * od téhle změny hlídá i samotný `kgNeighbours`.
 *
 * A OD 2026-08-12 SE STAV VRACÍ VOLAJÍCÍMU, ne jen do logu. Prázdné pole je
 * legitimní odpověď („výřez nemá přisouditelnou smlouvu") i odpověď na výpadek,
 * a mezi těmihle dvěma větami je celý rozdíl mezi zdravou plochou a mlčky
 * neúplnou. Stav proto doputuje až na plochu (`ContractLayerRead`).
 */
async function sliceContracts(
  companies: { kgId: string; company: string; refs: string[]; subjectRef: string; pending: boolean }[],
): Promise<{ contracts: FactContract[]; read: ContractLayerRead }> {
  const base = {
    companies: companies.length,
    truncatedCompanies: 0,
    edgeCap: MAX_SLICE_CONTRACT_EDGES,
  };
  // Žádná firma ke čtení není poctivé „ok" — nic se nečetlo, takže se nic
  // neztratilo. Prázdná kniha smluv to pak říká vlastní větou.
  if (companies.length === 0) return { contracts: [], read: { ...base, state: "ok" } };
  try {
    const store = await getStore();
    if (!store) {
      reportLoaderFailure(
        "getDashboardData.sliceContracts",
        new Error("store unavailable — smluvní vrstva knihy faktů se nepřečetla"),
      );
      return { contracts: [], read: { ...base, state: "failed" } };
    }
    const out: FactContract[] = [];
    let truncatedCompanies = 0;
    for (const c of companies) {
      const { edges, nodes } = await store.kgNeighbours({
        id: c.kgId,
        rels: ["supplies"],
        limit: MAX_SLICE_CONTRACT_EDGES,
      });
      if (edges.length >= MAX_SLICE_CONTRACT_EDGES) {
        truncatedCompanies += 1;
        reportLoaderFailure(
          "getDashboardData.sliceContracts",
          new Error(
            `firma ${c.kgId} vrátila přesně strop ${MAX_SLICE_CONTRACT_EDGES} hran supplies — ` +
              `nejlevnější smlouvy se do knihy faktů nedostaly`,
          ),
        );
      }
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
    if (truncatedCompanies > 0) {
      reportLoaderFailure(
        "getDashboardData.sliceContracts",
        new Error(
          `${truncatedCompanies} z ${companies.length} firem výřezu narazilo na strop ` +
            `${MAX_SLICE_CONTRACT_EDGES} hran supplies — kniha faktů je neúplná`,
        ),
      );
    }
    return {
      contracts: out,
      read: {
        ...base,
        truncatedCompanies,
        state: truncatedCompanies > 0 ? "truncated" : "ok",
      },
    };
  } catch (err) {
    reportLoaderFailure("getDashboardData.sliceContracts", err);
    // Prázdné pole SE ZDE VRACÍ TAKY, ale už ne mlčky: `failed` řekne ploše, že
    // absence smluv v knize není zjištění o výřezu, ale výpadek čtení.
    return { contracts: [], read: { ...base, state: "failed" } };
  }
}

// ── party node ids, and the recompute date: TWO READS THIS LOADER NO LONGER DOES ──
//
// Party abbrev → kg node id used to be its own `listKgNodes({kind:"party", limit:50})`.
// A small limit is not a small read: it makes PGlite walk the `kg_node` primary key and
// filter by kind instead of using `kg_node_kind_idx`, so it scans the whole ~154 k-row
// table until it has collected N matches — measured in this repo at 498/632/723 ms for
// 8 party rows, against 2,4/2,9/41,7 ms for the same read at `KG_READ_CAP`
// (getLeaderboardData.ts, `readChamber`). The chamber pass this loader already awaits
// performs exactly that read at the cap and simply discarded the ids; it now publishes
// them as `LeaderboardData.partyNodeIdByLabel`, so the map costs ZERO here and rides the
// cross-request chamber memo. Absent ⇒ `{}`, and the slice's party node falls back to
// its label (its existing honest fallback), never an invented id.
//
// The recompute DATE went the same way. It was once read off the FIRST person node this
// loader iterated — the exact mistake `features/civicscore/provenance.ts` exists to
// remove — then delegated to `getRecomputeFact()`, which is correct but is a SECOND full
// `kind:"person"` read per request for one field, on a page that awaits the chamber
// aggregate anyway. `ContributionProvenance.computedAt` now carries it under the same
// uniformity bar (one `{pass, ref}`, one day, no scored person without a stamp), so a
// half-recomputed store still yields null and the header says so rather than dating the
// ranking by a pass that may not have reached every MP. /schranka keeps calling
// `getRecomputeFact()` — its badge asks from every route and must not build a chamber.

/**
 * JEDINÝ ŠEV, KTERÝ TENHLE LOADER NABÍZÍ — a existuje kvůli citaci.
 *
 * Rubrika velína je okno: `buildDatedFacts` vrací `FEED_ROWS` nejnovějších řádků.
 * Exponát (/dashboard/exponat/…) a přes něj i brána /overeni se ale ptají na
 * JEDEN KONKRÉTNÍ fakt — a dokud tahle cesta četla totéž okno, každá citace faktu
 * umřela dvanáctým novějším faktem: stránka odpověděla „gone" a brána
 * „zaznam-nenalezen" o řádku, který týž průchod pořád odvozuje.
 *
 * `factLedger: "full"` proto vypne SEŘÍZNUTÍ (a nic jiného: tytéž reads, tytéž
 * vrstvy, totéž pořadí — okno je prefix plné knihy). Titulní strana volá loader
 * bez parametru, takže na drát jde dál přesně `FEED_ROWS` řádků; plnou knihu
 * nikdy neopouští server (pinuje publicWire.test.ts).
 */
export interface DashboardDataOptions {
  /** `"page"` (výchozí) = kniha seříznutá na `FEED_ROWS`; `"full"` = bez seříznutí. */
  factLedger?: "page" | "full";
}

export async function getDashboardData(
  options: DashboardDataOptions = {},
): Promise<DashboardData | null> {
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
  // The one derivation this loader performs — declared in the header, not hidden.
  // NULLS ARE EXCLUDED, NOT COERCED: an MP whose node carries no `absence_rate` used
  // to arrive as 0 and entered this mean as 100 % attendance. What is left is a mean
  // over a population, so the population is published with it.
  const rates = lb.entries
    .map((e) => e.absenceRate)
    .filter((r): r is number => r !== null);
  const attendance: DashboardAttendance = {
    avgPct:
      rates.length === 0
        ? null
        : Math.round((rates.reduce((s, r) => s + (1 - r), 0) / rates.length) * 1000) / 10,
    counted: rates.length,
    total: lb.entries.length,
  };
  // Chybějící sazba NENÍ výpadek loaderu (nic nespadlo, graf ten údaj prostě
  // nenese), takže se nehlásí `reportLoaderFailure` — přiznává se na ploše,
  // kde se to čtenáře týká: dlaždice vytiskne populaci průměru.

  const [money, law] = await Promise.all([moneyLayer(), lawLayer()]);
  const partyIds = lb.partyNodeIdByLabel ?? {};

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
  let factContracts: ContractLayerRead | null = null;
  if (slice) {
    const read = await sliceContracts(slice.sources.contractCompanies);
    factContracts = read.read;
    feed = buildDatedFacts(
      {
        contracts: read.contracts,
        ties: slice.sources.ties,
        bills: slice.sources.bills,
        today: builtOn,
      },
      // `null` = bez seříznutí (viz DashboardDataOptions). Okno je prefix plné
      // knihy, takže obě cesty čtou tytéž řádky v tomtéž pořadí.
      { limit: options.factLedger === "full" ? null : FEED_ROWS },
    );
  }

  return {
    // Trimmed to what the ledger renders — see DashboardTopEntry.
    top: lb.entries.slice(0, TOP_N).map(toTopEntry),
    summary: lb.summary,
    histogram: lb.histogram,
    attendance,
    provenance: {
      state: lb.provenance.state,
      pass: lb.provenance.pass,
      // Only a uniform chamber has ONE recompute date; the aggregate enforces that.
      computedAt: lb.provenance.computedAt,
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
    factContracts,
    builtOn,
  };
}
