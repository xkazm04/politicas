// D-gap-1 (batch 004, Opus re-audit) regression: kg-promote.ts's header claims it
// "only lands the INTERPRETIVE layer (bloc/theme nodes, belongs_to/about edges)" but
// that was never enforced — its only gate was the shared KG_EDGE_RELS enum, which
// also lists `linked_to`/`supplies` (money's case-owned, human-gated rels) plus other
// case loops' rels. A verdict proposing a `linked_to`/`supplies` edge would pass that
// gate and, on --commit, wholesale-replace a human-gated tie's props via toRows()'s
// fresh-props-only object — a worse variant of the D1 bug this batch already fixed
// for the money ingest path, via a completely different script.
//
// This proves toRows() now refuses (drops + reports, never silently upserts) any
// edge whose rel is case-owned, while still promoting the interpretive rels it's
// actually meant for.
import { describe, expect, it } from "vitest";
import { CASE_OWNED_EDGE_RELS, toRows } from "./kg-promote";
import type { KgVerdict } from "@/lib/analysis/kg-verdict";

function verdict(overrides: Partial<KgVerdict>): KgVerdict {
  return {
    target: "test-target",
    summary: "test",
    nodes: [],
    edges: [],
    patterns: [],
    featureOpportunities: [],
    frontier: [],
    ...overrides,
  };
}

describe("kg-promote toRows — case-owned rel guard (D-gap-1, batch 004)", () => {
  it("CASE_OWNED_EDGE_RELS covers money's human-gated rels", () => {
    expect(CASE_OWNED_EDGE_RELS.has("linked_to")).toBe(true);
    expect(CASE_OWNED_EDGE_RELS.has("supplies")).toBe(true);
  });

  it("refuses a linked_to edge instead of building fresh (destructive) props for it", () => {
    const v = verdict({
      edges: [
        { src: "psp:person:6790", rel: "linked_to", dst: "company:ico:111", rationale: "an LLM claims a tie" },
      ],
    });
    const { edges, droppedRels } = toRows(v, 2, "2026-07-24T00:00:00.000Z");
    expect(edges).toHaveLength(0); // never built, never handed to upsertKgEdges
    expect(droppedRels).toEqual(["linked_to"]);
  });

  it("refuses a supplies edge the same way", () => {
    const v = verdict({
      edges: [{ src: "company:ico:111", rel: "supplies", dst: "contract:k1", rationale: "an LLM claims a supply" }],
    });
    const { edges, droppedRels } = toRows(v, 2, "2026-07-24T00:00:00.000Z");
    expect(edges).toHaveLength(0);
    expect(droppedRels).toEqual(["supplies"]);
  });

  it("still promotes the interpretive rels this script actually owns (belongs_to/about)", () => {
    const v = verdict({
      nodes: [{ id: "bloc:fiscal-hawks", kind: "bloc", label: "Fiscal Hawks", rationale: "co-voting cluster" }],
      edges: [
        { src: "psp:person:6790", rel: "belongs_to", dst: "bloc:fiscal-hawks", rationale: "clusters with the bloc" },
        { src: "bill:123", rel: "about", dst: "theme:tax", rationale: "tax-themed bill" },
      ],
    });
    const { nodes, edges, droppedRels } = toRows(v, 2, "2026-07-24T00:00:00.000Z");
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => e.rel).sort()).toEqual(["about", "belongs_to"]);
    expect(droppedRels).toEqual([]);
  });

  it("a mixed verdict drops only the case-owned edges, keeps the interpretive ones", () => {
    const v = verdict({
      edges: [
        { src: "psp:person:6790", rel: "belongs_to", dst: "bloc:fiscal-hawks", rationale: "ok" },
        { src: "psp:person:6790", rel: "linked_to", dst: "company:ico:111", rationale: "must be dropped" },
      ],
    });
    const { edges, droppedRels } = toRows(v, 2, "2026-07-24T00:00:00.000Z");
    expect(edges).toHaveLength(1);
    expect(edges[0].rel).toBe("belongs_to");
    expect(droppedRels).toEqual(["linked_to"]);
  });
});
