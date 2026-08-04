// Pravidlo procházení grafu klávesnicí. Fixture je záměrně ruční sazba výřezu
// (osoby vlevo, peněžní pruh vpravo nahoře, legislativní vpravo dole), ne dnešní
// obsah grafu: test hlídá PRAVIDLO, ne data.

import { describe, expect, it } from "vitest";
import {
  adjacency,
  firstNodeId,
  isArrowKey,
  lastNodeId,
  neighbourStep,
  rovingNodeId,
  type TraversalEdge,
  type TraversalNode,
} from "./graphTraversal";

//   c(42,40) ── m(74,40)      peněžní pruh
//   │
//   p(13,50)
//   │
//   b(42,70) ── l(74,70)      legislativní pruh
const nodes: TraversalNode[] = [
  { id: "p:100", x: 13, y: 50 },
  { id: "c:00000100", x: 42, y: 40 },
  { id: "m:00000100", x: 74, y: 40 },
  { id: "b:50", x: 42, y: 70 },
  { id: "l:586-1992", x: 74, y: 70 },
];
const edges: TraversalEdge[] = [
  { from: "p:100", to: "c:00000100" },
  { from: "c:00000100", to: "m:00000100" },
  { from: "p:100", to: "b:50" },
  { from: "b:50", to: "l:586-1992" },
];

describe("adjacency", () => {
  it("is undirected and de-duplicated", () => {
    const a = adjacency(edges);
    expect(a.get("p:100")).toEqual(["c:00000100", "b:50"]);
    expect(a.get("m:00000100")).toEqual(["c:00000100"]);
  });

  it("ignores a self-loop — it is not a step", () => {
    expect(adjacency([{ from: "a", to: "a" }]).get("a")).toBeUndefined();
  });
});

describe("neighbourStep", () => {
  it("moves to the neighbour the arrow points at", () => {
    expect(neighbourStep("p:100", "ArrowRight", nodes, edges)).toBe("c:00000100");
    expect(neighbourStep("c:00000100", "ArrowRight", nodes, edges)).toBe("m:00000100");
    expect(neighbourStep("m:00000100", "ArrowLeft", nodes, edges)).toBe("c:00000100");
  });

  it("separates the two bands with up and down", () => {
    expect(neighbourStep("p:100", "ArrowUp", nodes, edges)).toBe("c:00000100");
    expect(neighbourStep("p:100", "ArrowDown", nodes, edges)).toBe("b:50");
  });

  it("does NOT wrap — a direction with no neighbour is a no-op", () => {
    expect(neighbourStep("p:100", "ArrowLeft", nodes, edges)).toBeNull();
    expect(neighbourStep("m:00000100", "ArrowRight", nodes, edges)).toBeNull();
    expect(neighbourStep("l:586-1992", "ArrowDown", nodes, edges)).toBeNull();
  });

  it("never leaves the edge list — an unconnected node is unreachable", () => {
    const withOrphan = [...nodes, { id: "y:KDU", x: 74, y: 55 }];
    expect(neighbourStep("p:100", "ArrowRight", withOrphan, edges)).toBe("c:00000100");
    expect(neighbourStep("y:KDU", "ArrowLeft", withOrphan, edges)).toBeNull();
  });

  it("ignores an edge whose other end the canvas does not draw", () => {
    const dangling: TraversalEdge[] = [...edges, { from: "p:100", to: "ghost" }];
    expect(neighbourStep("p:100", "ArrowRight", nodes, dangling)).toBe("c:00000100");
  });

  it("breaks a tie by id ascending, not by edge order", () => {
    const tied: TraversalNode[] = [
      { id: "o", x: 0, y: 0 },
      { id: "z", x: 10, y: 0 },
      { id: "a", x: 10, y: 0 },
    ];
    const tiedEdges: TraversalEdge[] = [
      { from: "o", to: "z" },
      { from: "o", to: "a" },
    ];
    expect(neighbourStep("o", "ArrowRight", tied, tiedEdges)).toBe("a");
    // Otočené pořadí hran nesmí změnit odpověď.
    expect(neighbourStep("o", "ArrowRight", tied, [...tiedEdges].reverse())).toBe("a");
  });

  it("answers null for a node outside the graph", () => {
    expect(neighbourStep("nic", "ArrowRight", nodes, edges)).toBeNull();
  });
});

describe("Home / End", () => {
  it("jump to the first and last node in the canvas's own order", () => {
    expect(firstNodeId(nodes)).toBe("p:100");
    expect(lastNodeId(nodes)).toBe("l:586-1992");
    expect(firstNodeId([])).toBeNull();
    expect(lastNodeId([])).toBeNull();
  });
});

describe("rovingNodeId", () => {
  it("prefers where the keyboard is, then the selection, then the first node", () => {
    expect(rovingNodeId("b:50", "c:00000100", nodes)).toBe("b:50");
    expect(rovingNodeId(null, "c:00000100", nodes)).toBe("c:00000100");
    expect(rovingNodeId(null, null, nodes)).toBe("p:100");
  });

  it("ignores an id the canvas does not draw", () => {
    expect(rovingNodeId("ghost", "c:00000100", nodes)).toBe("c:00000100");
    expect(rovingNodeId("ghost", "ghost", nodes)).toBe("p:100");
    expect(rovingNodeId(null, null, [])).toBeNull();
  });
});

describe("isArrowKey", () => {
  it("accepts only the four arrows", () => {
    expect(isArrowKey("ArrowRight")).toBe(true);
    expect(isArrowKey("Enter")).toBe(false);
    expect(isArrowKey("Home")).toBe(false);
  });
});
