import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { pgliteFixtureDir } from "../../testing/pglite-fixture";

// Isolated data dir — NEVER the live ./.pglite.
const dataDir = pgliteFixtureDir("politicas-maintenance-");

const { open } = await import("./internals");
const { maintenanceSnapshot, resetMaintenance, unckeckpointedBytes, withQuietWindowMaintenance } = await import(
  "./maintenance"
);

/*
 * The half a fake connection cannot carry: that the harm signal the ladder is
 * keyed to is REAL on this engine — that writes move it and that a CHECKPOINT
 * resets it. If PGlite ever stopped answering `pg_control_checkpoint()`, the
 * scheduler would silently never fire, and only a test against the real engine
 * would notice.
 */

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("the harm probe on a real store", () => {
  it("rises with writes and is reset by a CHECKPOINT", async () => {
    const pg = await open();
    await pg.query(
      `insert into lens_submission (id, vahy, submitted_at)
       select 'wal:' || g, '1-1-1-1-1', now() from generate_series(1, 2000) g`,
    );
    const after = await unckeckpointedBytes(pg);
    expect(after).toBeGreaterThan(50_000);

    await pg.exec("CHECKPOINT");
    const reset = await unckeckpointedBytes(pg);
    expect(reset).toBeLessThan(after);
    expect(reset).toBeLessThan(10_000);
  });

  it("drives a real pass through the wrapper and records what it did", async () => {
    resetMaintenance();
    const pg = await open();
    // Wrap the already-open connection a second time, with the harm bound set to
    // zero so the very next completed operation opens a quiet window. The real
    // connection underneath is the same one; only the scheduler is fresh.
    const conn = withQuietWindowMaintenance(pg, {
      enabled: true,
      warn: () => {},
      softBytes: 0,
      considerThrottleMs: 0,
    });
    await conn.query("select 1 from lens_submission limit 1");
    // The pass is fire-and-forget by design; give it the ticks it needs.
    for (let i = 0; i < 20 && maintenanceSnapshot().ran === 0; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }

    const s = maintenanceSnapshot();
    expect(s.ran).toBeGreaterThanOrEqual(1);
    const pass = s.records.find((r) => r.outcome === "ran")!;
    expect(pass.trigger).toBe("pressure");
    expect(pass.gauge).toBe(0);
    expect(pass.durMs).toBeGreaterThanOrEqual(0);
    // A real checkpoint leaves the store with almost nothing unckeckpointed.
    expect(pass.walBytesAfter).toBeGreaterThanOrEqual(0);
    expect(pass.walBytesAfter).toBeLessThan(10_000);
    resetMaintenance();
  });
});
