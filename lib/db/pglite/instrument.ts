/**
 * Query-timing instrumentation for the ONE PGlite connection.
 *
 * WHY THIS FILE EXISTS
 * No monitoring agent watches an embedded store. Until this file, every
 * performance fact this repo held about its own database was a number a human
 * measured once by hand and typed into a comment — `lib/db/store.ts:42-111`
 * (whole-term ballot read 7 281–7 705 ms vs 29 ms for 4 000 rows through
 * `vote_ballot_vote_idx`; whole-term absence read 410/483/483 ms vs 14–20 ms per
 * mandate), `features/civicscore/getLeaderboardData.ts:510` (`listKgNodes`
 * small-limit 498/632/723 ms vs 2,4/2,9/41,7 ms at `KG_READ_CAP`),
 * `docs/db-architecture-guide.md` (the four engine cases). Those numbers are
 * real and this file does not contradict them — it calibrates against them. But
 * they are folklore in the precise sense: they describe the store as it was on
 * one afternoon, they cannot be re-asked, and nothing notices when the shape
 * they describe changes. This module measures the store continuously so the
 * next "the app feels slow" thread has something to interrogate.
 *
 * WHAT IT REFUSES TO DO
 *  • It refuses to key by statement text. Statements embed values (unbounded
 *    cardinality) and near-duplicate statements shatter one hot path across
 *    many keys. The key is `<table>/<family>`, the table resolved against the
 *    CLOSED VOCABULARY parsed out of `CORE_DDL` at module load — `ddl.ts` stays
 *    the sole schema authority, and anything unrecognised collapses into one
 *    `other` key rather than minting a new one.
 *  • It refuses to use the database. Metrics written to a metrics table turn
 *    every measured operation into two, contend for the very locks being
 *    measured, and recurse the instrument into its own signal. Fixed in-memory
 *    rings, exported on demand.
 *  • It refuses to maintain statistics on the write path. The ring holds raw
 *    records; p95s, slow counts and window spans are derived at READ time, by
 *    the one caller who asked, from a sorted copy of the window.
 *  • It refuses to invent a lock-wait counter — see LOCK/BUSY WAITS below.
 *  • It refuses to suppress silently. See THE WARN CHANNEL below.
 *
 * WHERE "SLOW" IS AND WHAT IT WAS CALIBRATED AGAINST
 * Thresholds calibrated for networked stores (100 ms, 1 s) are deaf here. Every
 * figure below is a measurement already recorded in this repo, not a guess:
 *
 *   healthy, measured on this substrate
 *     0,6 ms   kg hetero-join G3            docs/db-architecture-guide.md case #4
 *     2,2 ms   tsvector+GIN text lookup     ...                        case #3
 *     2,4 ms   listKgNodes at KG_READ_CAP   features/civicscore/getLeaderboardData.ts:511
 *     4,1 ms   kg 2-hop reach               docs/db-architecture-guide.md case #4
 *     7,1 ms   kg 3-hop reach               ...                        case #4
 *    14–20 ms  one mandate's absences       lib/db/store.ts:105
 *    29 ms     4 000 ballots via the index  lib/db/store.ts:88
 *    40,2 ms   pgvector kNN at 100k         docs/db-architecture-guide.md case #2
 *    41,7 ms   listKgNodes at the cap, worst of 3 rounds
 *                                           features/civicscore/getLeaderboardData.ts:511
 *   pathological, measured on this substrate
 *   101,7 ms   group-by over 406k ballots   docs/db-architecture-guide.md case #1
 *   115,2 ms   LIKE scan over 200k docs     ...                        case #3
 *   412,6 ms   triangle count               ...                        case #4
 *   410–483 ms whole-term absence read      lib/db/store.ts:105
 *   498–723 ms listKgNodes at limit 30      features/civicscore/getLeaderboardData.ts:510
 *     5 636 ms ballot self-join             docs/db-architecture-guide.md case #1
 *  7 281–7 705 ms whole-term ballot read    lib/db/store.ts:88
 *
 * The healthy band tops out at 41,7 ms and the cheapest measured pathology is
 * 101,7 ms. `SLOW_MS.read = 60` sits in that gap: above every healthy sample
 * this repo has ever recorded, below every pathology it has ever recorded. It
 * is not "an order of magnitude above the p95" mechanically applied (that would
 * put the line at ~25 ms and fire on the *healthy* 40,2/41,7 ms samples); it is
 * the observed gap, which is the same rule honestly applied to real data.
 *
 * `SLOW_MS.write = 50` is derived, not observed: the only measured bulk write
 * on this substrate is the 10 056-edge KG load at 86 ms (case #4) ⇒ ~8,5 µs per
 * row, so `upsertMany`'s ≤500-row chunk (internals.ts) should cost ~4,3 ms plus
 * per-statement overhead. 50 ms is an order of magnitude above that. It is the
 * weakest number in this file and the report labels it `derived`, not
 * `observed`, so nobody quotes it as if a chunk had been timed.
 *
 * `SLOW_MS.ddl = 2000` covers `exec(CORE_DDL)` at cold start and any index
 * build; measured index builds on this substrate are 577 ms (GIN, 200k docs)
 * and 4 154 ms (pgvector, 20k) — the line sits above the one CORE_DDL performs
 * and below the one it does not.
 *
 * `vote_ballot/read` at full width IS EXPECTED TO BREACH: reading the whole
 * 406k-row relation legitimately costs ~7,3 s during an ingest or analysis
 * pass. The breach is still worth emitting, because it carries rows-touched:
 * 406 000 rows in 7 300 ms is "the table is big" (a pruning finding); 4 000
 * rows in 7 300 ms is "the plan regressed" (an index finding). That
 * discrimination is the whole reason rows-touched is recorded.
 *
 * LOCK/BUSY WAITS — WHAT IS ACTUALLY MEASURABLE HERE
 * The technique names lock/busy waits as a fact worth its bytes, and the
 * general shape (pool-acquisition wait keyed separately from query time) does
 * not exist on this substrate: PGlite is ONE WASM connection memoised on
 * globalThis, there is no pool, and `connection-pooling` is `n/a` in the audit
 * for exactly that reason. A pool-wait counter here would read zero forever,
 * which is worse than no counter — it looks like evidence of no contention.
 *
 * What IS real: PGlite serializes every statement on that one connection, so an
 * operation issued while another is in flight waits for it. Server components
 * fan out concurrent loaders against this single connection routinely, so the
 * depth is not always zero. This file therefore records ISSUE DEPTH — how many
 * wrapped operations were already in flight when this one was issued — and
 * nothing else. It does NOT report a wait duration, because the queue lives
 * inside the WASM boundary and a wrapper cannot decompose an observed duration
 * into wait and engine work. `queued(depth>0)` says "this sample's duration
 * includes time behind another statement"; it never claims how much.
 *
 * THE WARN CHANNEL, AND WHY SUPPRESSION IS COUNTED
 * Instrumentation nobody reads decays into ballast, so breaches are pushed to
 * `console.warn` in the shape `warnIfTruncated` already established in
 * internals.ts. Push mode needs a rate limit (a retry storm's hundredth slow
 * query is noise) and a rate limit that drops events silently converts "a burst
 * happened" into "nothing happened" — the instrument lying in exactly the
 * moment it exists for. So the budget is per key per window, and a window that
 * rolls over having suppressed anything emits ONE summary line carrying the
 * suppressed count and the worst suppressed duration.
 *
 * That rollover is detected LAZILY — on the key's next breach, or when someone
 * calls `dbMetricsReport()`. This module owns no timer, on purpose: a timer is
 * a cost the process pays when nobody is asking, which is the one thing an
 * instrument at this position must never be. The consequence is stated rather
 * than hidden: a burst followed by permanent silence surfaces its summary at
 * the next report, not at wall-clock rollover.
 *
 * COST
 * Disabled (`POLITICAS_DB_METRICS=off`), `instrumentPglite` returns the SAME
 * OBJECT it was handed — no wrapper in the object graph, no indirection, not a
 * fast path but no path at all (asserted in instrument.test.ts). Enabled, the
 * per-operation cost is two `performance.now()` calls, one Map lookup on a
 * ≤256-char prefix, six typed-array stores and an integer compare. Measured, not
 * assumed: the budget test in instrument.test.ts runs the same 20 000 calls over
 * the same connection with the instrument off and on and subtracts, giving
 * +1,17 / +1,16 / +1,29 µs per operation across three runs — 0,2% of the
 * FASTEST healthy query this substrate has produced (0,6 ms) and 0,05% of a
 * typical 2,4 ms one. Nothing is formatted unless an operation has ALREADY been
 * established to have taken ≥50 ms, so the one allocation-heavy step on the
 * write path is bounded both by the rate limit and by being ~0,1% of the event
 * it describes.
 *
 * CONSUMERS
 * `dbMetricsReport()` is the diagnostic surface — a support-bundle section or a
 * debug view calls it and gets p95s, slow counts and window spans with every
 * figure naming its recomputation. Wiring it into a rendered surface lives in
 * `features/**` and is deliberately NOT done here; this file's job is to make
 * the numbers exist and be exportable.
 */

import { CORE_DDL } from "./ddl";
import type { PgResult, PgTransaction, Pglite } from "./internals";

/* ── the closed vocabulary ─────────────────────────────────────────────────── */

/**
 * Table names parsed out of `CORE_DDL` once, at module load. Deriving them
 * (rather than hand-listing them here) keeps `ddl.ts` the single schema
 * authority: a table added there joins the metric vocabulary automatically, and
 * a typo'd table name in a query collapses to `other` instead of minting a key.
 */
export const KNOWN_TABLES: ReadonlySet<string> = (() => {
  const found = new Set<string>();
  const re = /create\s+table\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)/gi;
  for (let m = re.exec(CORE_DDL); m !== null; m = re.exec(CORE_DDL)) found.add(m[1]!.toLowerCase());
  return found;
})();

/** The bucket every unrecognised table collapses into. Never grows. */
export const OTHER_TABLE = "other";
/** The bucket `exec()` (schema application, index builds) records under. */
export const SCHEMA_TABLE = "schema";

export type OpFamily = "read" | "write" | "ddl" | "tx" | "other";

/**
 * The slow-operation line per family, in milliseconds. Calibration for every
 * number is in the file header; `THRESHOLD_BASIS` records whether the line came
 * from measurements ON this substrate or was derived from a proxy, because a
 * threshold whose provenance is lost is a threshold someone made up.
 */
export const SLOW_MS: Readonly<Record<OpFamily, number>> = {
  read: 60,
  write: 50,
  ddl: 2000,
  tx: 50,
  other: 60,
};

export const THRESHOLD_BASIS: Readonly<Record<OpFamily, string>> = {
  read: "observed: above the worst healthy sample (41,7 ms), below the cheapest pathology (101,7 ms)",
  write: "derived: 10x the ~4,3 ms a 500-row chunk implies from the 86 ms / 10 056-edge KG load",
  ddl: "observed: above the measured 577 ms GIN build, below the 4 154 ms pgvector build",
  tx: "borrowed from write; no explicit BEGIN/COMMIT is issued above this wrapper today",
  other: "borrowed from read; an unrecognised statement gets the strictest useful line",
};

/* ── ring geometry and budgets ─────────────────────────────────────────────── */

/**
 * ONE SHARED RING, grouped by key at read time — the second shape in
 * ring-buffer-metrics. Memory is bounded by construction no matter what the
 * keys do (one allocation, one bound, no per-key bookkeeping), which is the
 * right trade for a store with one connection and ~20 tables. The cost of the
 * shape is stated wherever it matters: the window is SHARED, so a chatty key
 * evicts a quiet key's history and per-key sample counts vary wildly. Every
 * derived figure therefore carries its own `n`.
 *
 * 512 records × 6 slots is ~14 KB, allocated once, on first use.
 */
const RING_CAP = 512;
/** Per-key warn budget inside one window. */
const WARN_BUDGET = 3;
const WARN_WINDOW_MS = 60_000;
/**
 * How much of a statement is looked at, and memoised under. The parse window
 * and the memo key are THE SAME 256 chars on purpose: two statements sharing
 * that prefix would parse identically, so a memo hit cannot be wrong. The cost
 * is that a `select` whose `from` lies past char 256 resolves to `other` — no
 * such statement exists in this repo (reads are `select *` or short column
 * lists; the only long statements are `upsertMany`'s inserts, whose table sits
 * at char 12 and whose placeholders always start at `$1`, making the prefix
 * byte-identical across every chunk).
 */
const WINDOW_CHARS = 256;
/** Memo cardinality cap. Statements are literal templates so this is never hit
 *  in practice; the guard exists because a silently rotating key space would
 *  change what "the metrics" cover, and `memoClears` counts it if it ever does. */
const MEMO_CAP = 256;

/** Rows touched is not observable for this record (a failed op, or `exec`). */
export const UNKNOWN_ROWS = -1;

/* ── module state (one connection ⇒ one ring) ──────────────────────────────── */

interface Ring {
  key: Int32Array;
  at: Float64Array;
  dur: Float64Array;
  rows: Int32Array;
  depth: Int32Array;
  ok: Uint8Array;
  head: number;
  filled: number;
}

interface WarnBudget {
  windowStart: number;
  used: number;
  suppressed: number;
  worstMs: number;
  worstRows: number;
}

let ring: Ring | null = null;
const keyNames: string[] = [];
const keyFamily: OpFamily[] = [];
const keyTable: string[] = [];
const keyIndex = new Map<string, number>();
const sqlMemo = new Map<string, number>();
const budgets: (WarnBudget | undefined)[] = [];

let inFlight = 0;
/** Lifetime, monotonic, NOT window claims — these must survive eviction. */
let lifetimeOps = 0;
let lifetimeEvicted = 0;
let lifetimeBreaches = 0;
let lifetimeMemoClears = 0;

let now: () => number = () => performance.now();
let emit: (line: string) => void = (line) => console.warn(line);

function ensureRing(): Ring {
  if (ring) return ring;
  ring = {
    key: new Int32Array(RING_CAP),
    at: new Float64Array(RING_CAP),
    dur: new Float64Array(RING_CAP),
    rows: new Int32Array(RING_CAP),
    depth: new Int32Array(RING_CAP),
    ok: new Uint8Array(RING_CAP),
    head: 0,
    filled: 0,
  };
  return ring;
}

/* ── key derivation ────────────────────────────────────────────────────────── */

const isIdentChar = (c: string) => (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "_";

/** `indexOf` restricted to whole-word hits, so `kg_node` never matches inside
 *  `kg_node_history` (they are different tables with different sizes). */
function indexOfWord(haystack: string, word: string): number {
  for (let i = haystack.indexOf(word); i >= 0; i = haystack.indexOf(word, i + 1)) {
    const before = i === 0 ? "" : haystack[i - 1]!;
    const after = haystack[i + word.length] ?? "";
    if (!isIdentChar(before) && !isIdentChar(after)) return i;
  }
  return -1;
}

const captureAfter = (window: string, re: RegExp): string | null => re.exec(window)?.[1] ?? null;

const resolveTable = (name: string | null): string =>
  name !== null && KNOWN_TABLES.has(name) ? name : OTHER_TABLE;

/**
 * Table + family from a statement, keyed by what it TOUCHES, never by its text.
 *
 * Writes name their table explicitly and early (`insert into X`, `update X`,
 * `delete from X`) so the capture is exact. Reads may join several tables, so
 * the driving table is taken as the first known table by POSITION in the
 * window — for `with term as (select … from organ) … select … from membership`
 * that is `organ`, which is the table the read actually enters through.
 */
export function parseKey(sql: string): { table: string; family: OpFamily } {
  const window = sql.slice(0, WINDOW_CHARS).toLowerCase();
  const verb = /[a-z]+/.exec(window)?.[0] ?? "";
  switch (verb) {
    case "insert":
      return { table: resolveTable(captureAfter(window, /insert\s+into\s+([a-z_][a-z0-9_]*)/)), family: "write" };
    case "update":
      return {
        table: resolveTable(captureAfter(window, /update\s+(?:only\s+)?([a-z_][a-z0-9_]*)/)),
        family: "write",
      };
    case "delete":
      return { table: resolveTable(captureAfter(window, /delete\s+from\s+([a-z_][a-z0-9_]*)/)), family: "write" };
    case "create":
    case "alter":
    case "drop":
    case "truncate":
      return { table: SCHEMA_TABLE, family: "ddl" };
    case "begin":
    case "start":
    case "commit":
    case "rollback":
      return { table: OTHER_TABLE, family: "tx" };
    case "select":
    case "with":
    case "table":
    case "values": {
      let best = -1;
      let bestTable = OTHER_TABLE;
      for (const t of KNOWN_TABLES) {
        const i = indexOfWord(window, t);
        if (i >= 0 && (best < 0 || i < best)) {
          best = i;
          bestTable = t;
        }
      }
      return { table: bestTable, family: "read" };
    }
    default:
      return { table: OTHER_TABLE, family: "other" };
  }
}

/** `<table>/<family>` — the only key shape this module ever mints. */
export const metricKey = (table: string, family: OpFamily) => `${table}/${family}`;

function internKey(table: string, family: OpFamily): number {
  const name = metricKey(table, family);
  const hit = keyIndex.get(name);
  if (hit !== undefined) return hit;
  const idx = keyNames.length;
  keyNames.push(name);
  keyFamily.push(family);
  keyTable.push(table);
  keyIndex.set(name, idx);
  return idx;
}

/** Statement → interned key index, memoised on the same 256-char window the
 *  parse reads, so a hit is exact by construction. */
function keyIndexForSql(sql: string): number {
  const memoKey = sql.length <= WINDOW_CHARS ? sql : sql.slice(0, WINDOW_CHARS);
  const hit = sqlMemo.get(memoKey);
  if (hit !== undefined) return hit;
  if (sqlMemo.size >= MEMO_CAP) {
    sqlMemo.clear();
    lifetimeMemoClears++;
  }
  const { table, family } = parseKey(sql);
  const idx = internKey(table, family);
  sqlMemo.set(memoKey, idx);
  return idx;
}

/* ── the write path ────────────────────────────────────────────────────────── */

function record(keyIdx: number, atMs: number, durMs: number, rows: number, depth: number, ok: boolean): void {
  const r = ensureRing();
  const i = r.head;
  r.key[i] = keyIdx;
  r.at[i] = atMs;
  r.dur[i] = durMs;
  r.rows[i] = rows;
  r.depth[i] = depth;
  r.ok[i] = ok ? 1 : 0;
  r.head = i + 1 === RING_CAP ? 0 : i + 1;
  if (r.filled < RING_CAP) r.filled++;
  else lifetimeEvicted++;
  lifetimeOps++;
  if (durMs >= SLOW_MS[keyFamily[keyIdx]!]) {
    lifetimeBreaches++;
    onBreach(keyIdx, atMs, durMs, rows, depth);
  }
}

const rowsPhrase = (rows: number) => (rows === UNKNOWN_ROWS ? "rows=n/a" : `rows=${rows}`);

/** Every count travels with its predicate: the key, the threshold it crossed,
 *  the rows it touched and whether it was issued behind another statement. */
function onBreach(keyIdx: number, atMs: number, durMs: number, rows: number, depth: number): void {
  const key = keyNames[keyIdx]!;
  const limit = SLOW_MS[keyFamily[keyIdx]!];
  let b = budgets[keyIdx];
  if (!b) {
    b = { windowStart: atMs, used: 0, suppressed: 0, worstMs: 0, worstRows: UNKNOWN_ROWS };
    budgets[keyIdx] = b;
  }
  if (atMs - b.windowStart >= WARN_WINDOW_MS) {
    flushBudget(keyIdx, b);
    b.windowStart = atMs;
  }
  if (b.used < WARN_BUDGET) {
    b.used++;
    emit(
      `[db] slow ${key}: ${durMs.toFixed(1)} ms over the ${limit} ms line for this family ` +
        `(${rowsPhrase(rows)}, depth-at-issue=${depth}). ` +
        `Rows high + duration high ⇒ prune or narrow the predicate; rows low + duration high ⇒ the plan regressed.`,
    );
  } else {
    b.suppressed++;
    if (durMs > b.worstMs) {
      b.worstMs = durMs;
      b.worstRows = rows;
    }
  }
}

/** ONE summary line for a window that suppressed anything. Silence here would
 *  turn "a burst happened" into "nothing happened". */
function flushBudget(keyIdx: number, b: WarnBudget): void {
  if (b.suppressed > 0) {
    emit(
      `[db] slow ${keyNames[keyIdx]!}: ${b.suppressed} further operations over the ` +
        `${SLOW_MS[keyFamily[keyIdx]!]} ms line were SUPPRESSED in a ${WARN_WINDOW_MS / 1000} s window ` +
        `(budget ${WARN_BUDGET}/window); worst suppressed ${b.worstMs.toFixed(1)} ms, ${rowsPhrase(b.worstRows)}.`,
    );
  }
  b.used = 0;
  b.suppressed = 0;
  b.worstMs = 0;
  b.worstRows = UNKNOWN_ROWS;
}

/** Emits every pending suppression summary. Called by the report so a burst
 *  followed by silence is never lost, and callable directly by a shutdown hook. */
export function flushSuppressed(): void {
  for (let i = 0; i < budgets.length; i++) {
    const b = budgets[i];
    if (b) flushBudget(i, b);
  }
}

function rowsOf(result: unknown): number {
  if (result === null || typeof result !== "object") return UNKNOWN_ROWS;
  const r = result as { rows?: unknown; affectedRows?: unknown };
  if (Array.isArray(r.rows)) {
    if (r.rows.length > 0) return r.rows.length;
    return typeof r.affectedRows === "number" ? r.affectedRows : 0;
  }
  return typeof r.affectedRows === "number" ? r.affectedRows : UNKNOWN_ROWS;
}

async function measure<T>(sql: string, run: () => Promise<T>): Promise<T> {
  const depth = inFlight;
  inFlight++;
  const t0 = now();
  try {
    const result = await run();
    const t1 = now();
    record(keyIndexForSql(sql), t1, t1 - t0, rowsOf(result), depth, true);
    return result;
  } catch (err) {
    const t1 = now();
    record(keyIndexForSql(sql), t1, t1 - t0, UNKNOWN_ROWS, depth, false);
    throw err;
  } finally {
    inFlight--;
  }
}

/* ── the wrapper ───────────────────────────────────────────────────────────── */

export interface InstrumentOptions {
  /** Default: on unless `POLITICAS_DB_METRICS` is `0`/`off`/`false`. */
  enabled?: boolean;
  /** Injectable monotonic clock — the seam the tests drive durations through. */
  now?: () => number;
  /** Injectable warn sink; defaults to `console.warn`, matching `warnIfTruncated`. */
  warn?: (line: string) => void;
}

export function dbMetricsEnabled(): boolean {
  const v = process.env.POLITICAS_DB_METRICS?.toLowerCase();
  return v !== "0" && v !== "off" && v !== "false";
}

/**
 * Wraps the one connection's three statement entry points. `transaction()` is
 * wrapped only to instrument the statements INSIDE it — the transaction span
 * itself is deliberately not a key, because every statement in it is already
 * measured and a span key would double-count the same milliseconds under a
 * second name, which is "one hot path shattered across keys" in reverse.
 *
 * When disabled this returns the argument itself, identity-equal: there is no
 * wrapper object in the graph at all.
 */
export function instrumentPglite(pg: Pglite, opts: InstrumentOptions = {}): Pglite {
  if (!(opts.enabled ?? dbMetricsEnabled())) return pg;
  if (opts.now) now = opts.now;
  if (opts.warn) emit = opts.warn;
  ensureRing();
  return {
    get waitReady() {
      return pg.waitReady;
    },
    exec: (sql: string) => measure(sql, () => pg.exec(sql)),
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
      measure<PgResult<T>>(sql, () => pg.query<T>(sql, params)),
    transaction: <T>(callback: (tx: PgTransaction) => Promise<T>) =>
      pg.transaction((tx) =>
        callback({
          query: <R = Record<string, unknown>>(sql: string, params?: unknown[]) =>
            measure<PgResult<R>>(sql, () => tx.query<R>(sql, params)),
        }),
      ),
    close: () => pg.close(),
  };
}

/* ── read-time derivation ──────────────────────────────────────────────────── */

export interface KeyStats {
  key: string;
  table: string;
  family: OpFamily;
  /** Samples for THIS key in the shared window — not a lifetime count. */
  n: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  /** Rows-touched stats over the `rowsN` samples where rows were observable. */
  rowsN: number;
  rowsP95: number;
  rowsMax: number;
  slowMs: number;
  /** Samples in this window whose duration was ≥ `slowMs`. */
  slowCount: number;
  /** Samples issued while ≥1 other statement was in flight on the one connection. */
  queuedCount: number;
  failedCount: number;
}

export interface DbMetricsSnapshot {
  /** Records currently in the shared ring — the predicate every stat below is under. */
  windowRecords: number;
  ringCapacity: number;
  /** Monotonic-clock span from the oldest to the newest record in the window. */
  windowSpanMs: number;
  lifetime: { ops: number; evicted: number; breaches: number; memoClears: number };
  keys: KeyStats[];
}

/** Nearest-rank on the sorted window: returns an OBSERVED value, never an
 *  interpolated fiction between two samples. Stated once, used everywhere. */
function nearestRank(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(q * sortedAsc.length) - 1));
  return sortedAsc[i]!;
}

export function dbMetricsSnapshot(): DbMetricsSnapshot {
  const r = ring;
  const lifetime = {
    ops: lifetimeOps,
    evicted: lifetimeEvicted,
    breaches: lifetimeBreaches,
    memoClears: lifetimeMemoClears,
  };
  if (!r || r.filled === 0) {
    return { windowRecords: 0, ringCapacity: RING_CAP, windowSpanMs: 0, lifetime, keys: [] };
  }
  const durs = new Map<number, number[]>();
  const rowsBy = new Map<number, number[]>();
  const slow = new Map<number, number>();
  const queued = new Map<number, number>();
  const failed = new Map<number, number>();
  let minAt = Infinity;
  let maxAt = -Infinity;
  for (let i = 0; i < r.filled; i++) {
    const k = r.key[i]!;
    const d = r.dur[i]!;
    (durs.get(k) ?? durs.set(k, []).get(k)!).push(d);
    const rows = r.rows[i]!;
    if (rows !== UNKNOWN_ROWS) (rowsBy.get(k) ?? rowsBy.set(k, []).get(k)!).push(rows);
    if (d >= SLOW_MS[keyFamily[k]!]) slow.set(k, (slow.get(k) ?? 0) + 1);
    if (r.depth[i]! > 0) queued.set(k, (queued.get(k) ?? 0) + 1);
    if (r.ok[i] === 0) failed.set(k, (failed.get(k) ?? 0) + 1);
    if (r.at[i]! < minAt) minAt = r.at[i]!;
    if (r.at[i]! > maxAt) maxAt = r.at[i]!;
  }
  const keys: KeyStats[] = [];
  for (const [k, list] of durs) {
    list.sort((a, b) => a - b);
    const rows = (rowsBy.get(k) ?? []).sort((a, b) => a - b);
    keys.push({
      key: keyNames[k]!,
      table: keyTable[k]!,
      family: keyFamily[k]!,
      n: list.length,
      p50Ms: nearestRank(list, 0.5),
      p95Ms: nearestRank(list, 0.95),
      maxMs: list[list.length - 1]!,
      rowsN: rows.length,
      rowsP95: nearestRank(rows, 0.95),
      rowsMax: rows.length === 0 ? 0 : rows[rows.length - 1]!,
      slowMs: SLOW_MS[keyFamily[k]!],
      slowCount: slow.get(k) ?? 0,
      queuedCount: queued.get(k) ?? 0,
      failedCount: failed.get(k) ?? 0,
    });
  }
  keys.sort((a, b) => b.p95Ms - a.p95Ms || a.key.localeCompare(b.key));
  return { windowRecords: r.filled, ringCapacity: RING_CAP, windowSpanMs: maxAt - minAt, lifetime, keys };
}

const ms = (v: number) => `${v.toFixed(1)}`;

/**
 * The on-demand diagnostic. Every figure names the window it is a claim about
 * and the recomputation that produced it — this is what turns "it feels slow"
 * into "vote_ballot/read p95 is 40x its calibrated line over 12 samples".
 */
export function dbMetricsReport(): string {
  flushSuppressed();
  const s = dbMetricsSnapshot();
  const lines: string[] = [];
  lines.push(
    `[db] query metrics — window: the last ${s.windowRecords} of ${s.ringCapacity} records ` +
      `in one shared ring, spanning ${ms(s.windowSpanMs)} ms of monotonic clock. ` +
      `Every per-key figure below is a WINDOW claim over that key's own n, never a since-startup claim.`,
  );
  if (s.windowRecords === 0) {
    lines.push(`[db] no operations recorded yet (the ring is empty).`);
  } else {
    lines.push(
      `  key                              n    p50ms    p95ms    maxms   rowsN   rowsP95  slow  queued  failed`,
    );
    for (const k of s.keys) {
      lines.push(
        `  ${k.key.padEnd(30)} ${String(k.n).padStart(4)} ` +
          `${ms(k.p50Ms).padStart(8)} ${ms(k.p95Ms).padStart(8)} ${ms(k.maxMs).padStart(8)} ` +
          `${String(k.rowsN).padStart(7)} ${String(k.rowsP95).padStart(9)} ` +
          `${String(k.slowCount).padStart(5)} ${String(k.queuedCount).padStart(7)} ${String(k.failedCount).padStart(7)}`,
      );
    }
    lines.push(
      `  slow = operations at or over the family line within this window: ` +
        Object.entries(SLOW_MS)
          .map(([f, v]) => `${f} ≥ ${v} ms`)
          .join(", ") +
        `. Each line's basis: ` +
        Object.entries(THRESHOLD_BASIS)
          .map(([f, b]) => `${f} — ${b}`)
          .join("; ") +
        `.`,
    );
    lines.push(
      `  queued = operations issued while at least one other statement was already in flight on the ONE ` +
        `PGlite connection. Their duration INCLUDES time behind that statement; this wrapper cannot say how much ` +
        `(the queue is inside the WASM boundary). There is no pool here, so there is no pool-wait counter.`,
    );
    lines.push(
      `  recomputation: p50/p95 = nearest-rank over a sorted copy of this key's durations in the current window ` +
        `(an observed sample, never interpolated); rowsP95 likewise over the rowsN samples where rows were ` +
        `observable (a failed operation and exec() have none); maxms = the largest sample in the window.`,
    );
    lines.push(
      `  the ring is SHARED across keys, so a chatty key evicts a quiet key's history — read every p95 with ` +
        `its own n beside it, not as if all keys had the same window.`,
    );
  }
  lines.push(
    `  lifetime (NOT the window, monotonic since process start): ${s.lifetime.ops} operations, ` +
      `${s.lifetime.evicted} records overwritten, ${s.lifetime.breaches} threshold breaches, ` +
      `${s.lifetime.memoClears} statement-memo clears.`,
  );
  return lines.join("\n");
}

/** Test seam: drops the ring, the interned keys, the memo and every counter. */
export function resetDbMetrics(): void {
  ring = null;
  keyNames.length = 0;
  keyFamily.length = 0;
  keyTable.length = 0;
  keyIndex.clear();
  sqlMemo.clear();
  budgets.length = 0;
  inFlight = 0;
  lifetimeOps = 0;
  lifetimeEvicted = 0;
  lifetimeBreaches = 0;
  lifetimeMemoClears = 0;
  now = () => performance.now();
  emit = (line) => console.warn(line);
}
