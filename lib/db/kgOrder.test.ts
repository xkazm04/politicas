import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { byListOrder } from "./kgOrder";
import type { KgEdgeRow, KgNodeRow } from "./types";

const dataDir = mkdtempSync(join(tmpdir(), "politicas-kgorder-"));
process.env.PGLITE_PATH = dataDir;

const { getStore } = await import("./store");

const e = (src: string, rel: string, dst: string, weight: number): KgEdgeRow => ({
  src,
  rel,
  dst,
  weight,
  props: {},
  provenance: { ref: "test", pass: 1, method: "deterministic" },
});

describe("byListOrder", () => {
  it("reproduces `order by src, rel, dst`", () => {
    const rows = [
      e("psp:person:9", "rebels_against", "party:ods", 1),
      e("psp:person:10", "co_votes_with", "psp:person:2", 1),
      e("psp:person:10", "co_votes_with", "psp:person:11", 1),
      e("psp:person:1", "sponsors", "bill:tisk:5", 1),
      e("psp:person:10", "and_then_rel", "psp:person:2", 1),
    ];
    expect([...rows].sort(byListOrder).map((r) => `${r.src}|${r.rel}|${r.dst}`)).toEqual([
      "psp:person:1|sponsors|bill:tisk:5",
      "psp:person:10|and_then_rel|psp:person:2",
      "psp:person:10|co_votes_with|psp:person:11",
      "psp:person:10|co_votes_with|psp:person:2",
      "psp:person:9|rebels_against|party:ods",
    ]);
  });

  it("is a total order — equal keys compare 0, and it is antisymmetric", () => {
    const a = e("psp:person:1", "r", "psp:person:2", 0.5);
    const b = e("psp:person:1", "r", "psp:person:2", 0.9);
    expect(byListOrder(a, b)).toBe(0);
    const c = e("psp:person:1", "r", "psp:person:3", 0.5);
    expect(byListOrder(a, c)).toBeLessThan(0);
    expect(byListOrder(c, a)).toBeGreaterThan(0);
  });
});

/**
 * The neighbour-read path the MP profile loader now depends on: `kgNeighbours`
 * must return the SAME incident-edge set that filtering a whole-relation
 * `listKgEdges` down to one node id produced — including both directions and
 * the self-loop, and, once re-sorted with `byListOrder`, in the same order.
 * That equivalence is the whole basis of the profile loader's single-pass read.
 */
describe("kgNeighbours ≡ listKgEdges filtered to one node", () => {
  const self = "psp:person:100";
  const node = (id: string, kind: string): KgNodeRow => ({
    id,
    kind,
    label: id,
    props: {},
    firstSeenPass: 1,
    provenance: { ref: "test", pass: 1, method: "deterministic" },
  });

  // 30s: this file pays the PGlite WASM boot, which contends when several
  // PGlite test files run in parallel workers.
  it("returns both legs, the self-loop once, and the far-end nodes", { timeout: 30_000 }, async () => {
    const s = await getStore();
    expect(s).not.toBeNull();
    const store = s!;
    await store.clearKg();
    await store.upsertKgNodes([
        node(self, "person"),
        node("psp:person:2", "person"),
        node("psp:person:3", "person"),
        node("party:ods", "party"),
      node("bill:tisk:7", "bill"),
    ]);
    await store.upsertKgEdges([
      e(self, "co_votes_with", "psp:person:2", 0.9), // out-leg
      e("psp:person:3", "co_votes_with", self, 0.9), // in-leg, tied weight
      e(self, "co_votes_with", self, 0.9), // self-loop — must come back exactly once
      e(self, "rebels_against", "party:ods", 0.2),
      e(self, "sponsors", "bill:tisk:7", 1),
      e("psp:person:2", "co_votes_with", "psp:person:3", 0.5), // unrelated
    ]);

    const rels = ["co_votes_with", "rebels_against", "sponsors"];
    const scanned: KgEdgeRow[] = [];
    for (const rel of rels) {
      const rows = await store.listKgEdges({ rel, limit: 1_000_000 });
      scanned.push(...rows.filter((r) => r.src === self || r.dst === self));
    }
    const { edges, nodes } = await store.kgNeighbours({ id: self, rels, limit: 1_000_000 });
    edges.sort(byListOrder);
    scanned.sort(byListOrder);

    const key = (r: KgEdgeRow) => `${r.src}|${r.rel}|${r.dst}`;
    expect(edges.map(key)).toEqual(scanned.map(key));
    expect(edges).toHaveLength(5);
    // …and the far end is hydrated, so the loader needs no kind-scan for bills/parties.
    expect(nodes.map((n) => n.id).sort()).toEqual(["bill:tisk:7", "party:ods", "psp:person:2", "psp:person:3"]);
  });
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});
