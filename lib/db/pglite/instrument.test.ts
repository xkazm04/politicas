// Pure-function + fake-connection tests for the query-timing instrument. No
// PGlite here — the point of the wrapper is that it only needs the `Pglite`
// interface, so the fixture is a hand-built connection whose durations, row
// counts and failures are dictated by the test through the injected clock. That
// is also the only way to assert "a 7 300 ms whole-relation read breaches its
// line" without waiting 7 300 s worth of real queries.

import { beforeEach, describe, expect, it } from "vitest";
import { CORE_DDL } from "./ddl";
import {
  dbMetricsReport,
  dbMetricsSnapshot,
  instrumentPglite,
  KNOWN_TABLES,
  OTHER_TABLE,
  parseKey,
  resetDbMetrics,
  SLOW_MS,
  UNKNOWN_ROWS,
} from "./instrument";
import type { PgResult, PgTransaction, Pglite } from "./internals";

/* ── fixture: a connection whose timing the test controls ──────────────────── */

let clock = 0;
const tick = (ms: number) => {
  clock += ms;
};
const warned: string[] = [];

/** Per-statement script: how long the next call on that sql "takes" and what it
 *  returns. Anything unscripted costs 1 ms and returns one row. */
interface Plan {
  ms?: number;
  rows?: number;
  affectedRows?: number;
  fail?: boolean;
}
let plan: Plan = {};
let realQueries = 0;

const fakePg = (): Pglite => ({
  waitReady: Promise.resolve(),
  exec: async () => {
    realQueries++;
    tick(plan.ms ?? 1);
    return [];
  },
  query: async <T = Record<string, unknown>>(): Promise<PgResult<T>> => {
    realQueries++;
    tick(plan.ms ?? 1);
    if (plan.fail) throw new Error("boom");
    const rows = Array.from({ length: plan.rows ?? 1 }, () => ({}) as T);
    return { rows, ...(plan.affectedRows === undefined ? {} : { affectedRows: plan.affectedRows }) };
  },
  transaction: async <T>(cb: (tx: PgTransaction) => Promise<T>) =>
    cb({
      query: async <R = Record<string, unknown>>(): Promise<PgResult<R>> => {
        realQueries++;
        tick(plan.ms ?? 1);
        return { rows: [] as R[] };
      },
    }),
  close: async () => {},
});

const wrap = (pg: Pglite = fakePg()) =>
  instrumentPglite(pg, { enabled: true, now: () => clock, warn: (l) => warned.push(l) });

const statsFor = (key: string) => dbMetricsSnapshot().keys.find((k) => k.key === key);

beforeEach(() => {
  resetDbMetrics();
  clock = 0;
  warned.length = 0;
  plan = {};
  realQueries = 0;
});

/* ── the closed vocabulary ─────────────────────────────────────────────────── */

describe("the key vocabulary comes from CORE_DDL, not from a hand-list", () => {
  it("knows the tables ddl.ts declares", () => {
    expect(KNOWN_TABLES.has("vote_ballot")).toBe(true);
    expect(KNOWN_TABLES.has("kg_node")).toBe(true);
    expect(KNOWN_TABLES.has("kg_node_history")).toBe(true);
    expect(KNOWN_TABLES.has("lens_submission")).toBe(true);
    // Non-vacuity for the parse itself: the set is not "everything".
    expect(KNOWN_TABLES.has("pg_class")).toBe(false);
    expect(KNOWN_TABLES.size).toBeGreaterThan(15);
  });

  it("covers every `create table` in CORE_DDL — no table can silently miss a key", () => {
    const declared = [...CORE_DDL.matchAll(/create table if not exists ([a-z_]+)/g)].map((m) => m[1]!);
    expect(declared.length).toBe(KNOWN_TABLES.size);
    for (const t of declared) expect(KNOWN_TABLES.has(t)).toBe(true);
  });
});

describe("parseKey — keyed by what a statement TOUCHES, never by its text", () => {
  it("reads name their driving table", () => {
    expect(parseKey("select * from person order by psp_id limit 10")).toEqual({ table: "person", family: "read" });
    expect(parseKey("select m.* from membership m where m.person_psp_id = $1")).toEqual({
      table: "membership",
      family: "read",
    });
    expect(parseKey("select count(*)::int as n from vote_ballot")).toEqual({
      table: "vote_ballot",
      family: "read",
    });
  });

  it("a CTE read is a read, keyed on the table it enters through", () => {
    expect(parseKey("with term as (select psp_id from organ where abbrev = $1)\nselect 1")).toEqual({
      table: "organ",
      family: "read",
    });
  });

  it("writes name their target explicitly", () => {
    expect(parseKey("insert into kg_edge (src,rel,dst) values ($1,$2,$3)")).toEqual({
      table: "kg_edge",
      family: "write",
    });
    expect(parseKey("update kg_node set label = $1 where id = $2")).toEqual({ table: "kg_node", family: "write" });
    expect(parseKey("delete from vote_tag where vote_psp_id = $1")).toEqual({
      table: "vote_tag",
      family: "write",
    });
  });

  it("`kg_node` does not swallow `kg_node_history` — whole-word only", () => {
    expect(parseKey("select 1 from kg_node_history where id = $1").table).toBe("kg_node_history");
  });

  it("DDL and transaction control get their own families", () => {
    expect(parseKey(CORE_DDL)).toEqual({ table: "schema", family: "ddl" });
    expect(parseKey("begin")).toEqual({ table: OTHER_TABLE, family: "tx" });
    expect(parseKey("commit")).toEqual({ table: OTHER_TABLE, family: "tx" });
  });

  it("an unrecognised table collapses into ONE `other` key instead of minting one", () => {
    expect(parseKey("select * from pg_stat_activity")).toEqual({ table: OTHER_TABLE, family: "read" });
    expect(parseKey("insert into not_a_table (id) values ($1)")).toEqual({
      table: OTHER_TABLE,
      family: "write",
    });
    expect(parseKey("select 1 as one")).toEqual({ table: OTHER_TABLE, family: "read" });
    expect(parseKey("vacuum analyze")).toEqual({ table: OTHER_TABLE, family: "other" });
  });
});

describe("statement text never shatters or explodes the key space", () => {
  it("100 reads with different embedded values are ONE key", async () => {
    const pg = wrap();
    for (let i = 0; i < 100; i++) {
      await pg.query(`select * from person where psp_id = ${i} and name_norm = 'osoba ${i}'`);
    }
    const keys = dbMetricsSnapshot().keys;
    expect(keys).toHaveLength(1);
    expect(keys[0]!.key).toBe("person/read");
    expect(keys[0]!.n).toBe(100);
  });

  it("upsertMany-shaped inserts of DIFFERENT widths are still ONE key", async () => {
    const pg = wrap();
    const cols = "id,vote_psp_id,mandate_psp_id,code,choice,source,source_url,fetched_at,ingest_run_id";
    for (const width of [500, 137, 500, 4]) {
      const tuples = Array.from({ length: width }, (_, t) =>
        `(${Array.from({ length: 9 }, (_, c) => `$${t * 9 + c + 1}`).join(",")})`,
      ).join(",");
      await pg.query(`insert into vote_ballot (${cols}) values ${tuples} on conflict (id) do update set code = excluded.code`);
    }
    const keys = dbMetricsSnapshot().keys;
    expect(keys).toHaveLength(1);
    expect(keys[0]!.key).toBe("vote_ballot/write");
    expect(keys[0]!.n).toBe(4);
    // …and the memo did not have to rotate to achieve it.
    expect(dbMetricsSnapshot().lifetime.memoClears).toBe(0);
  });
});

/* ── the database-specific facts ───────────────────────────────────────────── */

describe("rows touched — what separates a plan regression from a fat table", () => {
  it("records rows.length for reads", async () => {
    const pg = wrap();
    plan = { rows: 406_000, ms: 7300 };
    await pg.query("select * from vote_ballot");
    const s = statsFor("vote_ballot/read")!;
    expect(s.rowsMax).toBe(406_000);
    expect(s.rowsN).toBe(1);
  });

  it("falls back to affectedRows when a write returns no rows", async () => {
    const pg = wrap();
    plan = { rows: 0, affectedRows: 500 };
    await pg.query("insert into vote_ballot (id) values ($1)");
    expect(statsFor("vote_ballot/write")!.rowsMax).toBe(500);
  });

  it("a failed operation is still timed, but its rows are recorded as unobservable", async () => {
    const pg = wrap();
    plan = { ms: 12, fail: true };
    await expect(pg.query("select * from person")).rejects.toThrow("boom");
    const s = statsFor("person/read")!;
    expect(s.n).toBe(1);
    expect(s.failedCount).toBe(1);
    expect(s.maxMs).toBe(12);
    expect(s.rowsN).toBe(0); // UNKNOWN_ROWS is excluded from the rows stats, not counted as 0
    expect(UNKNOWN_ROWS).toBe(-1);
  });
});

describe("issue depth — the only contention fact this substrate exposes", () => {
  it("is 0 for a serial caller and >0 for one queued behind another statement", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((r) => (release = r));
    const pg = wrap({
      ...fakePg(),
      query: async <T,>(): Promise<PgResult<T>> => {
        await gate;
        tick(1);
        return { rows: [] as T[] };
      },
    });
    const first = pg.query("select * from person");
    const second = pg.query("select * from organ");
    release!();
    await Promise.all([first, second]);
    expect(statsFor("person/read")!.queuedCount).toBe(0);
    expect(statsFor("organ/read")!.queuedCount).toBe(1);
  });
});

/* ── the warn channel ──────────────────────────────────────────────────────── */

describe("the slow line and its warn channel", () => {
  it("says nothing about an operation inside the healthy band", async () => {
    const pg = wrap();
    plan = { ms: 41.7 }; // the worst HEALTHY sample this repo has measured
    await pg.query("select * from kg_node where kind = $1");
    expect(warned).toHaveLength(0);
    expect(statsFor("kg_node/read")!.slowCount).toBe(0);
  });

  it("warns with key, duration, threshold and rows once the line is crossed", async () => {
    const pg = wrap();
    plan = { ms: 723, rows: 8 }; // the measured small-LIMIT pathology
    await pg.query("select * from kg_node where kind = $1 limit 30");
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain("kg_node/read");
    expect(warned[0]).toContain("723.0 ms");
    expect(warned[0]).toContain(`${SLOW_MS.read} ms`);
    expect(warned[0]).toContain("rows=8");
    expect(warned[0]).toContain("depth-at-issue=0");
  });

  it("the line sits between the measured healthy band and the measured pathologies", () => {
    expect(SLOW_MS.read).toBeGreaterThan(41.7); // worst healthy sample on this substrate
    expect(SLOW_MS.read).toBeLessThan(101.7); // cheapest pathology on this substrate
    expect(SLOW_MS.write).toBeLessThan(SLOW_MS.ddl);
  });

  it("suppresses a burst down to the budget AND reports what it suppressed", async () => {
    const pg = wrap();
    // Ten breaches on one key inside one window: 3 warned, 7 suppressed.
    for (let i = 0; i < 10; i++) {
      plan = { ms: 100 + i * 10, rows: i };
      await pg.query("select * from vote_ballot where vote_psp_id = $1");
    }
    expect(warned).toHaveLength(3);
    expect(warned.every((l) => l.includes("vote_ballot/read"))).toBe(true);

    // Roll the window over with one more breach: the summary must appear, and
    // it must carry BOTH the count and the worst suppressed duration.
    clock += 61_000;
    plan = { ms: 100 };
    await pg.query("select * from vote_ballot where vote_psp_id = $1");
    const summary = warned.find((l) => l.includes("SUPPRESSED"));
    expect(summary).toBeDefined();
    expect(summary).toContain("7 further operations");
    expect(summary).toContain("190.0 ms"); // the worst suppressed sample, not the last one
    expect(summary).toContain("rows=9");
    expect(warned).toHaveLength(5); // 3 + the summary + the first breach of the new window
  });

  it("a burst followed by silence still surfaces its summary — at report time", async () => {
    const pg = wrap();
    for (let i = 0; i < 6; i++) {
      plan = { ms: 200 };
      await pg.query("select * from absence where mandate_psp_id = $1");
    }
    expect(warned.filter((l) => l.includes("SUPPRESSED"))).toHaveLength(0);
    dbMetricsReport();
    const summary = warned.find((l) => l.includes("SUPPRESSED"));
    expect(summary).toContain("3 further operations");
    expect(summary).toContain("absence/read");
  });
});

/* ── read-time derivation ──────────────────────────────────────────────────── */

describe("statistics are derived at read time, from the raw window", () => {
  it("p95 is nearest-rank: an OBSERVED sample, never interpolated", async () => {
    const pg = wrap();
    for (let i = 1; i <= 20; i++) {
      plan = { ms: i };
      await pg.query("select * from organ");
    }
    const s = statsFor("organ/read")!;
    expect(s.n).toBe(20);
    expect(s.p50Ms).toBe(10); // ceil(0.5*20) = 10th sample
    expect(s.p95Ms).toBe(19); // ceil(0.95*20) = 19th sample — an observed value
    expect(s.maxMs).toBe(20);
  });

  it("before the ring fills, n is the real sample count and a p95 over 3 is the 3rd sample", async () => {
    const pg = wrap();
    for (const d of [5, 1, 3]) {
      plan = { ms: d };
      await pg.query("select * from mandate");
    }
    const s = statsFor("mandate/read")!;
    expect(s.n).toBe(3);
    expect(s.p95Ms).toBe(5);
  });

  it("the window is bounded and the eviction is counted as a LIFETIME fact", async () => {
    const pg = wrap();
    for (let i = 0; i < 600; i++) await pg.query("select * from person");
    const snap = dbMetricsSnapshot();
    expect(snap.windowRecords).toBe(512);
    expect(snap.ringCapacity).toBe(512);
    expect(snap.keys[0]!.n).toBe(512); // a WINDOW claim
    expect(snap.lifetime.ops).toBe(600); // a LIFETIME claim — survives eviction
    expect(snap.lifetime.evicted).toBe(88);
  });

  it("the report carries the window predicate, the thresholds and the recomputation", async () => {
    const pg = wrap();
    plan = { ms: 500, rows: 8 };
    await pg.query("select * from kg_node where kind = $1 limit 30");
    const report = dbMetricsReport();
    expect(report).toContain("the last 1 of 512 records");
    expect(report).toContain("kg_node/read");
    expect(report).toContain("nearest-rank");
    expect(report).toContain(`read ≥ ${SLOW_MS.read} ms`);
    expect(report).toContain("no pool here");
    expect(report).toContain("lifetime (NOT the window");
  });

  it("an empty ring reports emptiness rather than zeros that look like data", () => {
    expect(dbMetricsReport()).toContain("no operations recorded yet");
    expect(dbMetricsSnapshot().keys).toHaveLength(0);
  });
});

/* ── the two refusals that are load-bearing ────────────────────────────────── */

describe("the instrument never touches the database", () => {
  it("adds no statements of its own — measured, reported or reset", async () => {
    const pg = wrap();
    await pg.query("select * from person");
    await pg.query("insert into person (id) values ($1)");
    expect(realQueries).toBe(2);
    dbMetricsReport();
    dbMetricsSnapshot();
    expect(realQueries).toBe(2);
  });

  it("measures statements inside a transaction without keying the span itself", async () => {
    const pg = wrap();
    await pg.transaction(async (tx) => {
      await tx.query("insert into vote_ballot (id) values ($1)");
      await tx.query("insert into vote_ballot (id) values ($1)");
    });
    const keys = dbMetricsSnapshot().keys;
    expect(keys.map((k) => k.key)).toEqual(["vote_ballot/write"]);
    expect(keys[0]!.n).toBe(2);
  });
});

describe("off-budget when nobody asks", () => {
  it("disabled is IDENTITY — there is no wrapper object in the graph at all", () => {
    const pg = fakePg();
    expect(instrumentPglite(pg, { enabled: false })).toBe(pg);
  });

  it("disabled records nothing", async () => {
    const pg = instrumentPglite(fakePg(), { enabled: false });
    await pg.query("select * from person");
    expect(dbMetricsSnapshot().windowRecords).toBe(0);
    expect(dbMetricsSnapshot().lifetime.ops).toBe(0);
  });

  it("the enabled write path adds a small fraction of this store's FASTEST healthy query", async () => {
    // The header claims a cost, so the cost is MEASURED here rather than hoped
    // at: the same 20 000 calls over the same fake connection, once with the
    // instrument off (identity) and once with it on. The difference is the
    // instrument's own share — intern + memo lookup + six typed-array stores +
    // one integer compare — with the fixture's promise machinery cancelled out
    // on both sides. The yardstick is 0,6 ms, the FASTEST healthy query
    // measured on this substrate (docs/db-architecture-guide.md case #4, G3).
    const N = 20_000;
    const run = async (pg: Pglite) => {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) await pg.query(`select * from person where psp_id = ${i % 97}`);
      return (performance.now() - t0) / N;
    };
    await run(wrap()); // warm both paths' JIT before either is timed
    resetDbMetrics();
    const bare = await run(instrumentPglite(fakePg(), { enabled: false }));
    const instrumented = await run(wrap());
    const addedMs = instrumented - bare;
    // Measured on this box, three runs: +1,17 / +1,16 / +1,29 µs per operation
    // (1,08–1,30 µs bare vs 2,25–2,46 µs instrumented) — 0,2% of a 0,6 ms query
    // and 0,05% of a 2,4 ms one. The ceiling below is ~8x that, so this is a
    // budget guard against a regression in kind (a sort, an allocation, a
    // format on the write path), not a benchmark that fails on a busy CI box.
    expect(addedMs).toBeLessThan(0.01);
    expect(dbMetricsSnapshot().lifetime.ops).toBe(N);
  });
});
