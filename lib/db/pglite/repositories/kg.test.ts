// Pure-logic test only — does NOT open PGlite (real or temp). `neighbourIds`
// is the one bit of `kgNeighbours` that's plain logic rather than a query, and
// it's exactly where the self-loop edge case (called out in its own review)
// would silently regress.

import { describe, expect, it } from "vitest";
import type { KgEdgeRow } from "../../types";
import { neighbourIds } from "./kg";

function edge(src: string, dst: string, rel = "co_votes_with"): KgEdgeRow {
  return { src, rel, dst, weight: null, props: {}, provenance: {} };
}

describe("neighbourIds", () => {
  it("returns the far-end id whichever side the queried node is on", () => {
    const edges = [edge("a", "b"), edge("c", "a")];
    expect(neighbourIds(edges, "a")).toEqual(expect.arrayContaining(["b", "c"]));
    expect(neighbourIds(edges, "a")).toHaveLength(2);
  });

  it("drops a self-loop (src = dst = id) instead of returning the node itself", () => {
    const edges = [edge("a", "a"), edge("a", "b")];
    expect(neighbourIds(edges, "a")).toEqual(["b"]);
  });

  it("dedupes when the same neighbour is reached by more than one edge", () => {
    const edges = [edge("a", "b", "co_votes_with"), edge("b", "a", "rebels_against")];
    expect(neighbourIds(edges, "a")).toEqual(["b"]);
  });

  it("returns an empty array for no edges", () => {
    expect(neighbourIds([], "a")).toEqual([]);
  });
});
