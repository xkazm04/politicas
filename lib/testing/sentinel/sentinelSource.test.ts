import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkMoneyRankCache } from "./invariants";
import type { MoneyTieFact, SentinelFacts } from "./facts";

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

describe("money-rank-cache names a tie_class outside the vocabulary instead of casting it", () => {
  const tie = (over: Partial<MoneyTieFact>): MoneyTieFact => ({
    key: "psp:person:1 -linked_to-> company:ico:00000001",
    tieClass: "owner-operator",
    corroboration: "registry-confirmed",
    storedTier: 0,
    storedRank: null,
    contractCzk: 0,
    subsidiesCzk: 0,
    ...over,
  });
  const facts = (moneyTies: MoneyTieFact[]): SentinelFacts => ({ moneyTies }) as unknown as SentinelFacts;

  it("a known class that matches its stored tier passes", () => {
    expect(checkMoneyRankCache(facts([tie({})])).status).toBe("ok");
  });
  it("an unknown class is a violation that names the class - reviewTier would have scored it as steward", () => {
    // Before 2026-09-07 the string was cast to TieClass and fell through reviewTier's
    // final branch (2 = steward), so a stored tier of 2 on garbage PASSED.
    const r = checkMoneyRankCache(facts([tie({ tieClass: "shareholder", storedTier: 2 })]));
    expect(r.status).toBe("violation");
    expect(r.detail).toMatch(/shareholder/);
    expect(r.detail).toMatch(/outside the TIE_CLASSES vocabulary/);
  });
});
