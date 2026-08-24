import { afterEach, describe, expect, it } from "vitest";
import type { PgResult, PgTransaction, Pglite } from "./internals";
import {
  activityGauge,
  maintenanceReport,
  maintenanceSnapshot,
  resetMaintenance,
  runsNow,
  wantPass,
  withQuietWindowMaintenance,
} from "./maintenance";

/*
 * The whole gate is exercised against a FAKE connection: no WASM Postgres boots
 * in this file, so it stays in the unit lane. What the fake supplies is the two
 * measurements the ladder reads — the harm probe's answer and the moment — plus
 * the ability to hold an operation open so the activity gauge is genuinely
 * non-zero at a decision, rather than asserted through a setter.
 *
 * lib/db/pglite/maintenance-store.test.ts covers the half a fake cannot: that a
 * real CHECKPOINT moves the real harm figure.
 */

const MB = 1_048_576;
const flush = () => new Promise((r) => setImmediate(r));

interface Fake {
  pg: Pglite;
  /** Statements the scheduler issued directly on the raw connection. */
  execs: string[];
  /** Resolve the operation held open by `hold()`. */
  release: () => void;
  setWal: (bytes: number) => void;
  failCheckpoint: (message: string | null) => void;
}

function fakeConnection(walBytes = 0): Fake {
  let wal = walBytes;
  let failWith: string | null = null;
  const execs: string[] = [];
  let releaseHeld: () => void = () => {};

  const query = async <T>(sql: string): Promise<PgResult<T>> => {
    if (sql.includes("pg_wal_lsn_diff")) {
      // numeric comes back as a string on this driver — keep the fake honest.
      return { rows: [{ b: String(wal) }] as unknown as T[] };
    }
    if (sql.includes("HOLD")) {
      await new Promise<void>((resolve) => {
        releaseHeld = resolve;
      });
    }
    return { rows: [] };
  };

  const pg: Pglite = {
    waitReady: Promise.resolve(),
    exec: async (sql: string) => {
      execs.push(sql);
      if (sql === "CHECKPOINT") {
        if (failWith) throw new Error(failWith);
        wal = 208; // what a real CHECKPOINT leaves behind, measured on this substrate
      }
      return null;
    },
    query,
    transaction: async <T>(cb: (tx: PgTransaction) => Promise<T>) => cb({ query }),
    close: async () => {},
  };

  return {
    pg,
    execs,
    release: () => releaseHeld(),
    setWal: (b: number) => {
      wal = b;
    },
    failCheckpoint: (m: string | null) => {
      failWith = m;
    },
  };
}

afterEach(() => {
  resetMaintenance();
});

describe("the ladder", () => {
  it("wants nothing while the interval is unelapsed and the harm is low", () => {
    expect(wantPass(1_000, 1 * MB).trigger).toBeNull();
  });

  it("wants a quiet pass once the interval has elapsed", () => {
    expect(wantPass(300_000, 0)).toEqual({ trigger: "quiet", overridesGauge: false });
  });

  it("wants a pressure pass on harm alone, interval or not", () => {
    expect(wantPass(0, 64 * MB)).toEqual({ trigger: "pressure", overridesGauge: false });
  });

  it("forces a pass past the hard bound, and only then overrides the gauge", () => {
    expect(wantPass(0, 512 * MB)).toEqual({ trigger: "forced", overridesGauge: true });
    expect(runsNow(wantPass(0, 512 * MB), 3)).toBe(true);
    expect(runsNow(wantPass(0, 64 * MB), 3)).toBe(false);
    expect(runsNow(wantPass(0, 64 * MB), 0)).toBe(true);
    expect(runsNow(wantPass(1, 0), 0)).toBe(false);
  });
});

describe("the gate", () => {
  const opts = (now: () => number, extra: Record<string, unknown> = {}) => ({
    enabled: true,
    now,
    warn: () => {},
    minIntervalMs: 1_000,
    softBytes: 64 * MB,
    hardBytes: 512 * MB,
    considerThrottleMs: 0,
    ...extra,
  });

  it("is identity when disabled — no wrapper in the object graph", () => {
    const f = fakeConnection();
    expect(withQuietWindowMaintenance(f.pg, { enabled: false })).toBe(f.pg);
  });

  it("counts operations in flight", async () => {
    const f = fakeConnection();
    const t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t));
    expect(activityGauge()).toBe(0);
    const held = conn.query("select 1 -- HOLD");
    await flush();
    expect(activityGauge()).toBe(1);
    f.release();
    await held;
    expect(activityGauge()).toBe(0);
  });

  it("runs a quiet pass when the gauge is zero and the interval has elapsed", async () => {
    const f = fakeConnection(1 * MB);
    let t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t));
    t = 2_000;
    await conn.query("select 1");
    await flush();
    expect(f.execs).toEqual(["CHECKPOINT"]);
    const s = maintenanceSnapshot();
    expect(s.ran).toBe(1);
    expect(s.records[0]!.outcome).toBe("ran");
    expect(s.records[0]!.trigger).toBe("quiet");
    expect(s.records[0]!.walBytesBefore).toBe(1 * MB);
    expect(s.records[0]!.walBytesAfter).toBe(208);
  });

  it("defers a wanted pass while another operation is in flight, and RECORDS the deferral", async () => {
    const f = fakeConnection(70 * MB); // over the soft bound: a pass is wanted
    const t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t));
    const held = conn.query("select 1 -- HOLD");
    await flush();
    await conn.query("select 2");
    await flush();

    expect(f.execs).toEqual([]); // busy ⇒ no checkpoint
    const s = maintenanceSnapshot();
    expect(s.deferredBusy).toBe(1);
    expect(s.records[0]).toMatchObject({ outcome: "deferred-busy", trigger: "pressure", gauge: 1, durMs: -1 });

    // ...and it runs the moment the window opens.
    f.release();
    await held;
    await flush();
    expect(f.execs).toEqual(["CHECKPOINT"]);
    expect(maintenanceSnapshot().ran).toBe(1);
  });

  it("forces a pass past the hard bound and says so on the warn channel", async () => {
    const f = fakeConnection(600 * MB);
    const warnings: string[] = [];
    const t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t, { warn: (l: string) => warnings.push(l) }));
    const held = conn.query("select 1 -- HOLD");
    await flush();
    await conn.query("select 2");
    await flush();

    expect(f.execs).toEqual(["CHECKPOINT"]);
    const s = maintenanceSnapshot();
    expect(s.records[0]).toMatchObject({ outcome: "ran", trigger: "forced", gauge: 1 });
    expect(warnings.join("\n")).toContain("maintenance FORCED a CHECKPOINT");
    expect(warnings.join("\n")).toContain("max_wal_size");
    f.release();
    await held;
  });

  it("records a failed pass as failed, distinct from a deferral, and warns", async () => {
    const f = fakeConnection(1 * MB);
    f.failCheckpoint("disk full");
    const warnings: string[] = [];
    let t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t, { warn: (l: string) => warnings.push(l) }));
    t = 2_000;
    await conn.query("select 1");
    await flush();

    const s = maintenanceSnapshot();
    expect(s.failed).toBe(1);
    expect(s.ran).toBe(0);
    expect(s.deferredBusy).toBe(0);
    expect(s.records[0]).toMatchObject({ outcome: "failed", error: "disk full" });
    expect(warnings.join("\n")).toContain("CHECKPOINT failed");
  });

  it("does not let a maintenance failure surface as the caller's failure", async () => {
    const f = fakeConnection(1 * MB);
    f.failCheckpoint("disk full");
    let t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t));
    t = 2_000;
    await expect(conn.query("select 1")).resolves.toEqual({ rows: [] });
  });

  it("counts a consideration that wanted nothing without ringing it", async () => {
    const f = fakeConnection(1 * MB);
    let t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t));
    // The first consideration in a process has no previous pass to measure from,
    // so it takes one (see the file header). Everything after it is the case
    // under test: interval unelapsed, harm low, nothing wanted.
    await conn.query("select 1");
    await flush();
    expect(maintenanceSnapshot().records).toHaveLength(1);

    t = 500; // < the 1 000 ms interval these options declare
    await conn.query("select 2");
    await flush();
    const s = maintenanceSnapshot();
    expect(s.considered).toBe(2);
    expect(s.records).toHaveLength(1);
    expect(f.execs).toEqual(["CHECKPOINT"]);
  });

  it("throttles considerations to one per window", async () => {
    const f = fakeConnection(1 * MB);
    let t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t, { considerThrottleMs: 15_000 }));
    for (let i = 0; i < 5; i++) {
      await conn.query("select 1");
      await flush();
      t += 1_000;
    }
    expect(maintenanceSnapshot().considered).toBe(1);
  });

  it("reports the ledger with the predicate its numbers are under", async () => {
    const f = fakeConnection(1 * MB);
    let t = 0;
    const conn = withQuietWindowMaintenance(f.pg, opts(() => t));
    expect(maintenanceReport()).toContain("ledger empty");
    t = 2_000;
    await conn.query("select 1");
    await flush();
    const text = maintenanceReport();
    expect(text).toContain("1 passes run");
    expect(text).toContain("ran");
    expect(text).toContain("bytes written since the last checkpoint's redo point");
    expect(text).toContain("NOT the size of pg_wal");
  });
});
