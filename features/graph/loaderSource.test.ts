import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

const LOADER = read("features/graph/graphLoader.ts");

describe("graph loader reads whole relations through KG_READ_CAP (2026-09-06, parity-auditor)", () => {
  it("no listKgNodes / listKgEdges call carries a literal limit", () => {
    // readCap.ts names the ad-hoc `10_000` as the class of bug it exists to end;
    // buildTrails still listed companies with it while the graph carries ~16k
    // company nodes, so companies sorting late lost all their money in the
    // „Peníze kolem poslanců" trail. Five sibling loaders already use the cap.
    expect(LOADER).not.toMatch(/listKg(Nodes|Edges)\(\{[^}]*limit:\s*\d/);
    expect(LOADER.match(/limit: KG_READ_CAP/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});
