import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

const MAPA = read("features/graph/VariantMapa.tsx");

describe("the forensic hover card reads the same node list the stage draws (2026-09-06, state-coverage)", () => {
  it("hoverCardModel is fed stageNodes and the unfiltered edges incl. the overlay", () => {
    // The card looked a node up in `nodes` (the map) and counted over `edges`
    // (the map), so hovering a neighbourhood-overlay node — the layer the map
    // deliberately omits — gave no card at all, and an overlay edge never counted.
    expect(MAPA).toMatch(/stageNodes\.find\(\(x\) => x\.id === hoverId\)/);
    expect(MAPA).toMatch(/hoverCardModel\(n, allEdges\)/);
    expect(MAPA).not.toMatch(/hoverCardModel\(n, edges\)/);
  });
});
