import { describe, expect, it } from "vitest";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import {
  buildSnapshot,
  bytesToMegabytes,
  snapshotFilename,
  snapshotPayload,
  SNAPSHOT_EDGE_CAP,
  SNAPSHOT_NODE_CAP,
  SNAPSHOT_SCHEMA,
} from "./snapshot";

const node = (id: string): KgNodeRow => ({
  id,
  kind: "person",
  label: `Uzel ${id}`,
  props: { note: "č" },
  firstSeenPass: 1,
  provenance: { method: "deterministic" },
});

const edge = (i: number): KgEdgeRow => ({
  src: `a-${i}`,
  rel: "linked_to",
  dst: `b-${i}`,
  weight: null,
  props: {},
  provenance: { method: "deterministic" },
});

const manifestMeta = {
  version: "2026.07.30",
  cutAt: "2026-07-30T09:00:00.000Z",
  degraded: false,
  manifestHash: "0abc1234",
  hashAlgorithm: "fnv-1a/32",
} as const;

describe("buildSnapshot", () => {
  it("tvar: schema, release z manifestu, limits, řádky beze změny", () => {
    const s = buildSnapshot({
      manifest: manifestMeta,
      nodes: [node("n1"), node("n2")],
      edges: [edge(1)],
      totalNodes: 2,
      totalEdges: 1,
    });
    expect(s.schema).toBe(SNAPSHOT_SCHEMA);
    expect(s.release).toEqual({
      version: "2026.07.30",
      cutAt: "2026-07-30T09:00:00.000Z",
      degraded: false,
      manifestHash: "0abc1234",
      hashAlgorithm: "fnv-1a/32",
    });
    expect(s.limits).toEqual({
      nodeCap: SNAPSHOT_NODE_CAP,
      edgeCap: SNAPSHOT_EDGE_CAP,
      nodesIncluded: 2,
      edgesIncluded: 1,
      nodesTotal: 2,
      edgesTotal: 1,
      truncated: false,
    });
    expect(s.nodes).toHaveLength(2);
    expect(s.edges[0]).toEqual(edge(1));
  });

  it("ořez je vynucený i přiznaný: víc řádků než strop → slice + truncated", () => {
    const many = Array.from({ length: SNAPSHOT_EDGE_CAP + 5 }, (_, i) => edge(i));
    const s = buildSnapshot({
      manifest: manifestMeta,
      nodes: [node("n1")],
      edges: many,
      totalNodes: 1,
      totalEdges: many.length,
    });
    expect(s.edges).toHaveLength(SNAPSHOT_EDGE_CAP);
    expect(s.limits.edgesIncluded).toBe(SNAPSHOT_EDGE_CAP);
    expect(s.limits.edgesTotal).toBe(SNAPSHOT_EDGE_CAP + 5);
    expect(s.limits.truncated).toBe(true);
  });

  it("store s víc řádky, než loader načetl (cap v loaderu) → truncated", () => {
    const s = buildSnapshot({
      manifest: manifestMeta,
      nodes: [node("n1")],
      edges: [edge(1)],
      totalNodes: 50_000,
      totalEdges: 1,
    });
    expect(s.limits.truncated).toBe(true);
  });
});

describe("snapshotPayload", () => {
  it("bytes = přesná UTF-8 délka JSON (diakritika počítá vícebajtově)", () => {
    const s = buildSnapshot({
      manifest: manifestMeta,
      nodes: [node("n1")],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
    });
    const { json, bytes } = snapshotPayload(s);
    expect(bytes).toBe(new TextEncoder().encode(json).byteLength);
    expect(bytes).toBeGreaterThan(json.length); // sanity: „č" v props je 2 B
    expect(JSON.parse(json)).toEqual(s);
  });
});

describe("snapshotFilename / bytesToMegabytes", () => {
  it("nese verzi; bez verze čestné nevydano", () => {
    expect(snapshotFilename("2026.07.30")).toBe("politicas-civic-graph-2026.07.30.json");
    expect(snapshotFilename(null)).toBe("politicas-civic-graph-nevydano.json");
  });
  it("převod na MB je binární (1024²)", () => {
    expect(bytesToMegabytes(1024 * 1024)).toBe(1);
  });
});
