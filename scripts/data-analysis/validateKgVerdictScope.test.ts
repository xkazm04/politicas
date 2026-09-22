import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

describe("validate-kg-verdict: no store means no membership gate, not a reject-all (2026-09-06, error-handler)", () => {
  it("passes undefined knownIds when the store is unavailable and says so", () => {
    // `knownIds()` returned [] when getStore() gave null, and an EMPTY known set makes
    // every edge endpoint and every cited urn „a fabricated relationship endpoint" —
    // a store outage printed as a hallucinating subagent, with exit 1 telling the
    // operator to discard and re-run the model.
    const src = read("scripts/data-analysis/validate-kg-verdict.ts");
    expect(src).not.toMatch(/if \(!store\) return \[\];/);
    expect(src).toMatch(/knownIds: ids \?\? undefined/);
    expect(src).toMatch(/shape-only/);
  });
});
