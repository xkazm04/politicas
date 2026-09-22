import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));

describe("every kg writer derives its default pass from the graph (2026-09-06, parity-auditor)", () => {
  it("kg-committee-routing no longer freezes the pass at the literal 12", () => {
    // Eight sibling writers derive `--pass` from nextPass(nodes); this one defaulted to
    // `|| 12`, so every re-run restamped its assigned_to edges as pass 12 forever —
    // a false vintage on a surface whose brand is that a number carries its source.
    const src = read("scripts/data-analysis/kg-committee-routing.ts");
    expect(src).not.toMatch(/\|\| 12\b/);
    expect(src).toMatch(/nextPass\(nodes\)/);
  });
});
