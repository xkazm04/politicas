import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(p, "utf8"));
import { globSync } from "node:fs";

describe("no kg writer lists graph rows under a literal cap (2026-09-06, parity-auditor)", () => {
  it("kg-contribution-recompute reads person nodes through KG_READ_CAP, not `limit: 1000`", () => {
    // readCap.ts names the ad-hoc literal as the class of bug it ends; 207 MPs fit today,
    // and „fits today" is the sentence every truncated read once started with.
    const files = globSync("scripts/data-analysis/kg-*.ts").map((f) => f.replaceAll("\\", "/")).filter((f) => !f.endsWith(".test.ts"));
    const offenders = files.filter((f) => /listKg(Nodes|Edges)\(\{[^}]*limit:\s*\d/.test(read(f)));
    expect(offenders).toEqual([]);
    expect(read("scripts/data-analysis/kg-contribution-recompute.ts")).toMatch(/limit: KG_READ_CAP/);
  });
});
