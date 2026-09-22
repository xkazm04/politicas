import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

describe("kg-legislation-ingest read-merges bill and law nodes (2026-09-06, bounty-hunter)", () => {
  it("no node is built with a fresh props object or a restamped firstSeenPass", () => {
    // kg-bill-roles-ingest's own header says a full re-run of this writer „would
    // wholesale-erase" summary_cz / forensic_* / amends_* off every bill node. The
    // hazard was documented in a sibling and left in place here.
    const src = read("scripts/data-analysis/kg-legislation-ingest.ts");
    expect(src).not.toMatch(/firstSeenPass: pass\b/);
    expect(src.match(/mergeComputedNodeProps\(/g)?.length ?? 0).toBe(2);
    expect(src.match(/firstSeenPass: prev\?\.firstSeenPass \?\? pass/g)?.length ?? 0).toBe(2);
  });
});
