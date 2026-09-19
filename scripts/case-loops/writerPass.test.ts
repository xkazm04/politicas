// The case-loop WRITERS agree on what a pass number is. The scripts run main() on
// import, so their text is the instrument (the sharedRules.test.ts pattern).
//
// One rule: `--commit` needs `--pass=<n>` where n is a POSITIVE INTEGER — a real
// assigned pass, never a placeholder, never a guess. apply-batch.ts spelled it out
// on Opus audit #11; until 2026-09-08 persist-batch.ts accepted a fractional pass
// and two effort writers committed under a pass they had invented themselves.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(p, "utf8");

describe("every case-loop writer's --pass gate is `Number.isInteger(pass) && pass > 0`", () => {
  it("persist-batch.ts refuses a non-integer pass, like apply-batch.ts", () => {
    const s = src("scripts/case-loops/persist-batch.ts");
    expect(s).toMatch(/Number\.isInteger\(pass\) && pass > 0/);
    expect(s).not.toMatch(/Number\.isFinite\(pass\)/);
  });
});

describe("a live commit never runs under a pass the script invented (2026-09-08)", () => {
  it("rapporteur-load.ts refuses --commit without a positive-integer --pass, and no longer derives one from firstSeenPass", () => {
    const s = src("scripts/case-loops/effort/rapporteur-load.ts");
    expect(s).toMatch(/if \(commit && !\(Number\.isInteger\(pass\) && pass > 0\)\)/);
    expect(s).not.toMatch(/Math\.max\(0, \.\.\.persons\.map\(\(n\) => n\.firstSeenPass\)\) \+ 1/);
  });

  it("psp9-contribution.ts refuses --commit without a positive-integer --pass, and no longer stamps pass 0", () => {
    const s = src("scripts/case-loops/effort/psp9-contribution.ts");
    expect(s).toMatch(/if \(commit && !\(Number\.isInteger\(pass\) && pass > 0\)\)/);
    expect(s).not.toMatch(/Number\(arg\("pass"\)\) \|\| 0/);
  });
});
