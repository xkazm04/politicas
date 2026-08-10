// Memo discipline for the vote-ledger loaders. The three rules this pins are not
// stylistic: each of them, if broken, publishes a FALSE claim about the chamber for a
// whole TTL window — "no roll calls exist" (an empty read frozen), "the record cannot be
// read" (a transient PGlite failure frozen), or yesterday's numbers past their stated
// bound. Clock is injected, so nothing here sleeps.

import { describe, expect, it } from "vitest";

import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import { createLedgerMemo } from "./ledgerMemo";

interface Payload {
  rows: number[];
}

const memoOf = (ttlMs?: number) =>
  createLedgerMemo<Payload>({ usable: (v) => v.rows.length > 0, ttlMs });

describe("createLedgerMemo", () => {
  it("starts empty", () => {
    expect(memoOf().read(0)).toBeNull();
  });

  it("serves a usable value back inside the window", () => {
    const memo = memoOf();
    const value = { rows: [1, 2, 3] };
    memo.write(value, 1_000);
    expect(memo.read(1_000)).toBe(value);
    expect(memo.read(1_000 + MONEY_MEMO_TTL_MS - 1)).toBe(value);
  });

  it("never memoizes null — a failed read must not freeze an outage", () => {
    const memo = memoOf();
    memo.write(null, 0);
    expect(memo.read(0)).toBeNull();
  });

  it("never memoizes an empty result — indistinguishable from a store that came back without the ledger", () => {
    const memo = memoOf();
    memo.write({ rows: [] }, 0);
    expect(memo.read(0)).toBeNull();
  });

  it("a failure after a good write leaves the good value in place", () => {
    const memo = memoOf();
    const value = { rows: [7] };
    memo.write(value, 0);
    memo.write(null, 10);
    memo.write({ rows: [] }, 20);
    expect(memo.read(30)).toBe(value);
  });

  it("expires exactly at the TTL boundary, not after it", () => {
    const memo = memoOf();
    memo.write({ rows: [1] }, 0);
    expect(memo.read(MONEY_MEMO_TTL_MS - 1)).not.toBeNull();
    expect(memo.read(MONEY_MEMO_TTL_MS)).toBeNull();
  });

  it("an expired read drops the cell rather than serving it to a later, earlier-clocked caller", () => {
    const memo = memoOf();
    memo.write({ rows: [1] }, 0);
    expect(memo.read(MONEY_MEMO_TTL_MS)).toBeNull();
    // The cell is gone, not merely hidden: a clock that steps backwards (test seams,
    // container clock skew) must not resurrect a value already declared stale.
    expect(memo.read(0)).toBeNull();
  });

  it("reset() is the test seam and clears the cell", () => {
    const memo = memoOf();
    memo.write({ rows: [1] }, 0);
    memo.reset();
    expect(memo.read(0)).toBeNull();
  });

  it("defaults to the imported money-layer window, never a re-declared constant", () => {
    // Two memos over one graph on two clocks is how two surfaces print two vintages of
    // one number; /penize and /dashboard already declare this window.
    const memo = memoOf();
    memo.write({ rows: [1] }, 0);
    expect(memo.read(MONEY_MEMO_TTL_MS - 1)).not.toBeNull();
    expect(memo.read(MONEY_MEMO_TTL_MS)).toBeNull();
  });

  it("honours an explicit shorter window (the only override the app never uses)", () => {
    const memo = memoOf(100);
    memo.write({ rows: [1] }, 0);
    expect(memo.read(99)).not.toBeNull();
    expect(memo.read(100)).toBeNull();
  });
});
