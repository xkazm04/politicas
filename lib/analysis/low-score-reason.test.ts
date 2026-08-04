import { describe, expect, it } from "vitest";
import { looksEnglish } from "./language-gate";
import { isLowScoreReason, lowScoreReasonCopy, LOW_SCORE_REASONS } from "./low-score-reason";

describe("isLowScoreReason", () => {
  it("accepts every vocabulary value", () => {
    for (const r of LOW_SCORE_REASONS) expect(isLowScoreReason(r)).toBe(true);
  });

  it("rejects unknown strings, non-strings, null and undefined", () => {
    expect(isLowScoreReason("phantom_mandate")).toBe(false);
    expect(isLowScoreReason("")).toBe(false);
    expect(isLowScoreReason(42)).toBe(false);
    expect(isLowScoreReason(null)).toBe(false);
    expect(isLowScoreReason(undefined)).toBe(false);
    expect(isLowScoreReason({})).toBe(false);
  });
});

describe("lowScoreReasonCopy", () => {
  it("returns copy for every vocabulary value with non-empty badge and detail", () => {
    for (const r of LOW_SCORE_REASONS) {
      const c = lowScoreReasonCopy(r);
      expect(c).not.toBeNull();
      expect(c!.badge.length).toBeGreaterThan(0);
      expect(c!.detail.length).toBeGreaterThan(0);
      expect(["neutral", "positive"]).toContain(c!.tone);
    }
  });

  it("degrades to null for missing or unrecognized reasons — never fabricates a label", () => {
    expect(lowScoreReasonCopy(undefined)).toBeNull();
    expect(lowScoreReasonCopy(null)).toBeNull();
    expect(lowScoreReasonCopy("some_new_reason_not_in_vocab")).toBeNull();
  });

  it("marks declined_mandate and replacement as positive corrections (the batch-001/002 headline cases)", () => {
    expect(lowScoreReasonCopy("declined_mandate")!.tone).toBe("positive");
    expect(lowScoreReasonCopy("replacement")!.tone).toBe("positive");
  });

  it("marks genuine_absentee as the one reason that is NOT a score correction", () => {
    expect(lowScoreReasonCopy("genuine_absentee")!.detail).toMatch(/NENÍ korektiv/);
  });
});

// This vocabulary renders VERBATIM to Czech readers — on /poslanec since batch 002 and
// on the /zebricek row since 2026-08-04. Analyst prose has reached three surfaces in
// English before (memory/reader-facing-loaders-need-the-language-gate.md), so the copy
// is pinned to the gate here rather than trusted.
describe("lowScoreReasonCopy — Czech language gate", () => {
  it("no badge or detail reads as English", () => {
    for (const r of LOW_SCORE_REASONS) {
      const c = lowScoreReasonCopy(r)!;
      expect(looksEnglish(c.badge), `${r}.badge`).toBe(false);
      expect(looksEnglish(c.detail), `${r}.detail`).toBe(false);
    }
  });
});
