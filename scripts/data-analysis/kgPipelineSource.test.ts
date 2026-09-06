// Source pins over the kg writers (2026-09-08, scan-sweep kg-pipeline). The scripts
// run main() on import, so the instrument is the text: what a writer defaults to and
// where it takes a vocabulary from is decidable by reading it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

describe("kg-compute derives its default pass from the graph, like its eight siblings (2026-09-08, parity-auditor)", () => {
  it("no longer defaults --pass to the literal 1", () => {
    // Every bare re-run restamped ~250 nodes' and ~20 000 edges' provenance as pass 1 —
    // the false vintage the writer's own header warns about.
    const src = read("scripts/data-analysis/kg-compute.ts");
    expect(src).not.toMatch(/arg\("pass", "1"\)/);
    expect(src).toMatch(/nextPass\(await store\.listKgNodes\(\)\)/);
  });
});
