// apply-amends-regen.ts runs main() on import, so the instrument is the text
// (2026-09-09, scan-sweep law-amends-analysis, parity-auditor).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("apply-amends-regen refuses --commit without a POSITIVE INTEGER --pass", () => {
  it("gates on Number.isInteger(pass) && pass > 0, like persist-batch.ts (3035dfb)", () => {
    // Until 2026-09-09 the gate was `Number.isFinite`, which let `--pass=0` — the
    // payload's own placeholder — a negative or a fraction through to every
    // provenance stamp the run writes.
    const src = readFileSync("scripts/case-loops/law/apply-amends-regen.ts", "utf8");
    expect(src).toMatch(/Number\.isInteger\(pass\) && pass > 0/);
    expect(src).not.toMatch(/!Number\.isFinite\(pass\)/);
  });
});
