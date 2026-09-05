import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* provenance-probe.ts carries the ledgered state as a literal (`EXPECT`) and STATE.md prints
 * the same figures in its table ("run at every batch start/end"). Two hand copies of one
 * expectation; this test pins them to each other so a batch that updates one and not the other
 * fails here instead of the probe quietly asserting a stale chamber. */

const probe = readFileSync("scripts/case-loops/law/provenance-probe.ts", "utf8");
const state = readFileSync("docs/data-analysis/case-law/STATE.md", "utf8");

const code = probe.match(/const EXPECT = \{ withF: (\d+), laws: (\d+), amends: (\d+), passes: \[([\d,\s]+)\] \}/);
const doc = state.match(/`provenance-probe\.ts` EXPECT \| `\{withF: (\d+), laws: (\d+), amends: (\d+), passes: (\d+)[–-](\d+)\}`/);

describe("provenance-probe EXPECT matches the STATE.md table", () => {
  it("both sides were found", () => {
    expect(code, "EXPECT literal in provenance-probe.ts").not.toBeNull();
    expect(doc, "EXPECT row in STATE.md").not.toBeNull();
  });

  it("withF / laws / amends agree", () => {
    expect([code![1], code![2], code![3]]).toEqual([doc![1], doc![2], doc![3]]);
  });

  it("the pass list's ends are the documented range", () => {
    const passes = code![4].split(",").map((s) => Number(s.trim()));
    expect(String(passes[0])).toBe(doc![4]);
    expect(String(passes[passes.length - 1])).toBe(doc![5]);
  });
});
