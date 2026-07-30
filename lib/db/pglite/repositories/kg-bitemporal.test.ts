// Bitemporal kg claims (DB integration): supersede-not-overwrite write
// discipline, asOf() reads at exact boundary instants, migration backfill, and
// asOf(now) ≡ current-read equivalence. Uses an isolated PGlite data dir —
// NEVER the live ./.pglite (same discipline as ledger.test.ts).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { KgEdgeRow, KgNodeRow } from "../../types";

const dataDir = mkdtempSync(join(tmpdir(), "politicas-kg-bitemporal-"));
process.env.PGLITE_PATH = dataDir;

const { open, PGLITE_KEY } = await import("../internals");
type GlobalWithPglite = typeof globalThis & { [PGLITE_KEY]?: unknown };
const { CORE_DDL } = await import("../ddl");
const { makeKgRepo } = await import("./kg");
const { makeReviewRepo } = await import("./review");

const node = (id: string, label: string, props: Record<string, unknown> = {}): KgNodeRow => ({
  id, kind: "person", label, props, firstSeenPass: 1, provenance: { method: "deterministic" },
});
const edge = (src: string, dst: string, props: Record<string, unknown> = {}, rel = "linked_to"): KgEdgeRow => ({
  src, rel, dst, weight: null, props, provenance: { method: "deterministic" },
});

/** now() has finite precision — make sure consecutive transactions get distinct instants. */
const tick = () => new Promise((r) => setTimeout(r, 15));

/**
 * Boundary instants are read back from the DB AS TEXT (µs-exact), never
 * re-derived from JS Date (ms precision would shave microseconds and turn an
 * at-boundary read into a just-before read).
 */
async function tsText(sql: string, params: unknown[] = []): Promise<string> {
  const pg = await open();
  const { rows } = await pg.query<{ t: string }>(sql, params);
  expect(rows).toHaveLength(1);
  return String(rows[0].t);
}

describe("bitemporal kg claims (DB integration)", () => {
  afterAll(async () => {
    const pg = await open();
    await pg.close();
    delete (globalThis as GlobalWithPglite)[PGLITE_KEY];
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("BACKFILL: re-running the DDL restores the temporal columns with defaults on pre-existing rows", async () => {
    const pg = await open();
    const kg = makeKgRepo(pg);
    await kg.upsertKgNodes([node("bt:pre", "Předchůdce")]);

    // Simulate a pre-bitemporal data dir: drop the four columns, then run the
    // idempotent DDL exactly as open() does on every start.
    for (const col of ["valid_from", "valid_to", "recorded_at", "superseded_at"]) {
      await pg.exec(`alter table kg_node drop column if exists ${col}`);
    }
    await pg.exec(CORE_DDL);

    const { rows } = await pg.query<Record<string, unknown>>(
      `select valid_from, valid_to, recorded_at, superseded_at from kg_node where id = 'bt:pre'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].valid_from).toBeNull();
    expect(rows[0].valid_to).toBeNull();
    expect(rows[0].recorded_at).not.toBeNull(); // backfilled to the migration instant
    expect(rows[0].superseded_at).toBeNull(); // serving row = current version
    await kg.deleteKgNodes(["bt:pre"]);
  });

  it("SUPERSEDE (nodes): changed content archives the old version; identical content is a full no-op", async () => {
    const pg = await open();
    const kg = makeKgRepo(pg);
    await kg.upsertKgNodes([node("bt:n1", "Verze A", { score: 1 })]);
    const recordedV1 = await tsText(`select recorded_at::text as t from kg_node where id = 'bt:n1'`);
    await tick();

    await kg.upsertKgNodes([node("bt:n1", "Verze B", { score: 2 })]);
    const { rows: hist } = await pg.query<Record<string, unknown>>(
      `select label, recorded_at::text as recorded_at, superseded_at::text as superseded_at
       from kg_node_history where id = 'bt:n1'`,
    );
    expect(hist).toHaveLength(1);
    expect(hist[0].label).toBe("Verze A");
    expect(hist[0].recorded_at).toBe(recordedV1); // span start carried over intact
    // old span closes at EXACTLY the instant the new one opens
    const recordedV2 = await tsText(`select recorded_at::text as t from kg_node where id = 'bt:n1'`);
    expect(hist[0].superseded_at).toBe(recordedV2);
    expect(recordedV2).not.toBe(recordedV1);

    // identical re-upsert: no history churn, recorded_at untouched (the
    // changed-content guard is load-bearing — data-layer.md M2)
    await tick();
    await kg.upsertKgNodes([node("bt:n1", "Verze B", { score: 2 })]);
    const { rows: hist2 } = await pg.query(`select 1 from kg_node_history where id = 'bt:n1'`);
    expect(hist2).toHaveLength(1);
    expect(await tsText(`select recorded_at::text as t from kg_node where id = 'bt:n1'`)).toBe(recordedV2);
  });

  it("ASOF boundaries (nodes): half-open [recorded_at, superseded_at) at exact instants", async () => {
    const pg = await open();
    const kg = makeKgRepo(pg);
    const t1 = await tsText(`select recorded_at::text as t from kg_node_history where id = 'bt:n1'`);
    const t2 = await tsText(`select recorded_at::text as t from kg_node where id = 'bt:n1'`);
    const justBefore = (t: string) => tsText(`select ($1::timestamptz - interval '1 microsecond')::text as t`, [t]);

    // before the claim ever existed → absent
    expect(await kg.asOf(await justBefore(t1)).getKgNodes(["bt:n1"])).toEqual([]);
    // at its first recorded instant → v1 visible
    expect((await kg.asOf(t1).getKgNodes(["bt:n1"]))[0]?.label).toBe("Verze A");
    // one microsecond before the supersede → still v1
    expect((await kg.asOf(await justBefore(t2)).getKgNodes(["bt:n1"]))[0]?.label).toBe("Verze A");
    // at the exact supersede instant → the NEW version, never both, never neither
    const atT2 = await kg.asOf(t2).getKgNodes(["bt:n1"]);
    expect(atT2).toHaveLength(1);
    expect(atT2[0].label).toBe("Verze B");
  });

  it("SUPERSEDE (edges) via the review flip: the pre-decision version stays queryable", async () => {
    const pg = await open();
    const kg = makeKgRepo(pg);
    const review = makeReviewRepo(pg);
    await kg.upsertKgEdges([edge("bt:mp", "bt:firma", { role: "jednatel", review_state: "pending_review" })]);
    await tick();

    const beforeFlip = await tsText(`select now()::text as t`);
    await tick();
    const res = await review.setTieReviewState("bt:mp", "bt:firma", "confirm", "tester", null);
    expect(res.ok).toBe(true);

    // current read: verified
    const current = await kg.listKgEdges({ rel: "linked_to" });
    const cur = current.find((e) => e.src === "bt:mp");
    expect(cur?.props.review_state).toBe("verified");
    // history holds the pending version; asOf before the flip replays it
    const { rows: hist } = await pg.query<Record<string, unknown>>(
      `select props from kg_edge_history where src = 'bt:mp' and dst = 'bt:firma'`,
    );
    expect(hist).toHaveLength(1);
    const past = await kg.asOf(beforeFlip).listKgEdges({ rel: "linked_to" });
    expect(past.find((e) => e.src === "bt:mp")?.props.review_state).toBe("pending_review");
  });

  it("DELETE supersedes: the row leaves the serving table but its final version stays replayable", async () => {
    const pg = await open();
    const kg = makeKgRepo(pg);
    await kg.upsertKgNodes([node("bt:gone", "Smazaný"), node("bt:stays", "Zůstává")]);
    await kg.upsertKgEdges([edge("bt:gone", "bt:stays", { k: 1 }, "supplies")]);
    await tick();
    const beforeDelete = await tsText(`select now()::text as t`);
    await tick();

    expect(await kg.deleteKgEdges([{ src: "bt:gone", rel: "supplies", dst: "bt:stays" }])).toBe(1);
    expect(await kg.deleteKgNodes(["bt:gone"])).toBe(1);
    // absent now; missing keys stay a non-error no-op (0 deleted, no phantom history)
    expect(await kg.getKgNodes(["bt:gone"])).toEqual([]);
    expect(await kg.deleteKgNodes(["bt:gone"])).toBe(0);

    const then = kg.asOf(beforeDelete);
    expect((await then.getKgNodes(["bt:gone"]))[0]?.label).toBe("Smazaný");
    const thenEdges = await then.listKgEdges({ rel: "supplies" });
    expect(thenEdges.some((e) => e.src === "bt:gone" && e.dst === "bt:stays")).toBe(true);
    // and asOf(now) agrees the deletion happened
    expect(await kg.asOf(new Date()).getKgNodes(["bt:gone"])).toEqual([]);
  });

  it("ASOF(now) ≡ current reads: lists, neighbours and counts are row-identical", async () => {
    const pg = await open();
    const kg = makeKgRepo(pg);
    await kg.upsertKgNodes([node("bt:a", "A"), node("bt:b", "B"), node("bt:c", "C")]);
    await kg.upsertKgEdges([
      edge("bt:a", "bt:b", { w: 1 }, "co_votes_with"),
      edge("bt:c", "bt:a", { w: 2 }, "co_votes_with"),
      edge("bt:a", "bt:a", {}, "self"), // self-loop: both APIs must drop it from neighbours
    ]);
    await tick();
    const now = kg.asOf(new Date());

    expect(await now.listKgNodes()).toEqual(await kg.listKgNodes());
    expect(await now.listKgNodes({ kind: "person", limit: 2 })).toEqual(await kg.listKgNodes({ kind: "person", limit: 2 }));
    expect(await now.listKgEdges()).toEqual(await kg.listKgEdges());
    expect(await now.listKgEdges({ rel: "co_votes_with" })).toEqual(await kg.listKgEdges({ rel: "co_votes_with" }));
    // current getKgNodes carries no ORDER BY (order is documented as not
    // significant) — compare as sets, not sequences
    const byId = (a: KgNodeRow, b: KgNodeRow) => a.id.localeCompare(b.id);
    expect([...(await now.getKgNodes(["bt:a", "bt:b"]))].sort(byId)).toEqual(
      [...(await kg.getKgNodes(["bt:a", "bt:b"]))].sort(byId),
    );
    expect(await now.countKgNodes()).toBe(await kg.countKgNodes());
    expect(await now.countKgEdges()).toBe(await kg.countKgEdges());

    const cur = await kg.kgNeighbours({ id: "bt:a", rels: ["co_votes_with", "self"] });
    const past = await now.kgNeighbours({ id: "bt:a", rels: ["co_votes_with", "self"] });
    const key = (e: KgEdgeRow) => `${e.src} ${e.rel} ${e.dst}`;
    expect(past.edges.map(key).sort()).toEqual(cur.edges.map(key).sort());
    expect(past.nodes.map((n) => n.id).sort()).toEqual(cur.nodes.map((n) => n.id).sort());
    expect(cur.nodes.map((n) => n.id).sort()).toEqual(["bt:b", "bt:c"]);
  });

  it("CLEAR archives: after clearKg the graph is empty NOW but intact at every earlier instant", async () => {
    const pg = await open();
    const kg = makeKgRepo(pg);
    const nodesBefore = await kg.countKgNodes();
    const edgesBefore = await kg.countKgEdges();
    expect(nodesBefore).toBeGreaterThan(0);
    await tick();
    const beforeClear = await tsText(`select now()::text as t`);
    await tick();

    await kg.clearKg();
    expect(await kg.countKgNodes()).toBe(0);
    expect(await kg.countKgEdges()).toBe(0);
    const then = kg.asOf(beforeClear);
    expect(await then.countKgNodes()).toBe(nodesBefore);
    expect(await then.countKgEdges()).toBe(edgesBefore);
    // and the record honestly shows the wipe itself
    expect(await kg.asOf(new Date()).countKgNodes()).toBe(0);
  });
});
