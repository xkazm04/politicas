import { describe, expect, it } from "vitest";
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
