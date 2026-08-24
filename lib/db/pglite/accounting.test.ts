import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { pgliteFixtureDir } from "../../testing/pglite-fixture";

// Isolated data dir — NEVER the live ./.pglite. Set before the import that opens.
const dataDir = pgliteFixtureDir("politicas-accounting-");

const { open } = await import("./internals");
const { RETENTION, accountingReport, orphanPolicies, retentionFor, storeAccounting, unpolicedTables } = await import(
  "./accounting"
);
const { KNOWN_TABLES } = await import("./instrument");

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("retention declarations", () => {
  it("covers every table CORE_DDL creates", () => {
    // creation-names-reaper at table granularity: a new table with no declared
    // policy fails HERE, naming itself, rather than being discovered as growth.
    expect(unpolicedTables()).toEqual([]);
  });

  it("declares no table CORE_DDL does not create", () => {
    expect(orphanPolicies()).toEqual([]);
  });

  it("reports an undeclared table — the guard's own red state", () => {
    // Proves the check can fail. Without this, "0 unpoliced tables" is
    // indistinguishable from a filter that matches nothing.
    expect(unpolicedTables([...KNOWN_TABLES, "some_new_table"])).toEqual(["some_new_table"]);
  });

  it("names the six accumulating tables, and only those", () => {
    const kept = Object.entries(RETENTION)
      .filter(([, p]) => p.class === "accumulating")
      .map(([t]) => t)
      .sort();
    expect(kept).toEqual([
      "change_event",
      "ingest_run",
      "kg_edge_history",
      "kg_node_history",
      "lens_submission",
      "review_audit",
    ]);
    // The kept-forever policy is a DATED decision, not a default.
    for (const t of kept) expect(retentionFor(t)?.decidedAt).toBe("2026-08-24");
  });
});

describe("storeAccounting", () => {
  it("counts rows exactly and attributes bytes per table", async () => {
    const pg = await open();
    await pg.query(
      `insert into lens_submission (id, vahy, submitted_at)
       select 'lens:' || g, '1-1-1-1-1', now() from generate_series(1, 250) g`,
    );
    await pg.query(
      `insert into change_event (id, event_type, recorded_at, source)
       select 'chev:t:' || g, 'test', now(), 'test' from generate_series(1, 40) g`,
    );

    const a = await storeAccounting(pg, dataDir);
    const byName = new Map(a.tables.map((t) => [t.table, t]));

    // Exact counts, not estimates — pg_stat_user_tables reads zero on this substrate.
    expect(byName.get("lens_submission")?.rows).toBe(250);
    expect(byName.get("change_event")?.rows).toBe(40);
    expect(byName.get("vote_ballot")?.rows).toBe(0);

    // Every reported table is one CORE_DDL declares, and carries its policy.
    for (const t of a.tables) {
      expect(KNOWN_TABLES.has(t.table)).toBe(true);
      expect(t.retention).not.toBeNull();
    }

    // Pages allocated are decomposed, and the shares are shares of the total.
    const lens = byName.get("lens_submission")!;
    expect(lens.totalBytes).toBeGreaterThan(0);
    expect(lens.totalBytes).toBeGreaterThanOrEqual(lens.heapBytes + lens.indexBytes);
    expect(a.totalTableBytes).toBe(a.tables.reduce((s, t) => s + t.totalBytes, 0));
    expect(a.tables.reduce((s, t) => s + t.sharePct, 0)).toBeCloseTo(100, 5);

    // Largest first — the report's whole point is naming the big table.
    for (let i = 1; i < a.tables.length; i++) {
      expect(a.tables[i - 1]!.totalBytes).toBeGreaterThanOrEqual(a.tables[i]!.totalBytes);
    }

    expect(a.databaseBytes).toBeGreaterThan(0);
    expect(a.unpoliced).toEqual([]);
    expect(a.unobservable.length).toBeGreaterThan(0);
  });

  it("sees the filesystem, including the pg_wal the database size excludes", async () => {
    const pg = await open();
    const a = await storeAccounting(pg, dataDir);
    expect(a.dir).not.toBeNull();
    expect(a.dir!.entries.some((e) => e.name === "pg_wal/")).toBe(true);
    expect(a.dir!.totalBytes).toBeGreaterThan(a.databaseBytes);
  });

  it("reports no filesystem view rather than zero bytes for an unreadable path", async () => {
    const pg = await open();
    const a = await storeAccounting(pg, `${dataDir}-does-not-exist`);
    expect(a.dir).toBeNull();
    expect(accountingReport(a)).toContain("no filesystem view");
  });

  it("renders every figure with the measurement that produced it", async () => {
    const pg = await open();
    const text = accountingReport(await storeAccounting(pg, dataDir));
    expect(text).toContain("exact count(*)");
    expect(text).toContain("PAGES ALLOCATED");
    expect(text).toContain("does NOT include pg_wal");
    expect(text).toContain("NOT MEASURED — reclaimable space per table");
    expect(text).toContain("kept FOREVER by decision");
    expect(text).toContain("lens_submission");
  });
});
