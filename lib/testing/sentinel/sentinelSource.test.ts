import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Guards for the live-graph sentinel (scan-sweep 2026-09-07, testing-sentinel): the
 * sentinel judges the store against the repo's OWN definitions, so where it mirrors one
 * by hand the mirror is checked here. */

const src = (p: string) => readFileSync(p, "utf8");

describe("facts.ts tallies verdict rungs through tallyVerdictRungs, not a second loop", () => {
  it("imports the tally and types the buckets by VerdictRung", () => {
    const s = src("lib/testing/sentinel/facts.ts");
    expect(s).toMatch(/tallyVerdictRungs/);
    expect(s).toMatch(/byRung: Record<VerdictRung \| "unrecorded", number>/);
    expect(s).not.toMatch(/byRung\[v\.rung\]\+\+/);
  });
});
