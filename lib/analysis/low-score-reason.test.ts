import { describe, expect, it } from "vitest";
import {
  isLowScoreReason,
  lowScoreReasonCopy,
  lowScoreBadgeKey,
  lowScoreDetailKey,
  LOW_SCORE_COPY_KEYS,
  LOW_SCORE_REASONS,
} from "./low-score-reason";

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
  it("returns a distinct message key pair for every vocabulary value", () => {
    const seen = new Set<string>();
    for (const r of LOW_SCORE_REASONS) {
      const c = lowScoreReasonCopy(r);
      expect(c).not.toBeNull();
      expect(c!.badgeKey, r).toBe(lowScoreBadgeKey(r));
      expect(c!.detailKey, r).toBe(lowScoreDetailKey(r));
      expect(["neutral", "positive"]).toContain(c!.tone);
      // Two reasons sharing one key would silently render one sentence for both.
      expect(seen.has(c!.badgeKey), `${r} reuses a badge key`).toBe(false);
      expect(seen.has(c!.detailKey), `${r} reuses a detail key`).toBe(false);
      seen.add(c!.badgeKey);
      seen.add(c!.detailKey);
    }
  });

  it("publishes exactly the keys it can emit, and no others", () => {
    // The /overeni contract: a pure module that returns keys publishes the closed
    // set, so the messages test can hold BOTH catalogs to it. A key emitted but not
    // published would render its own name to a reader and no test would see it.
    const emitted = LOW_SCORE_REASONS.flatMap((r) => {
      const c = lowScoreReasonCopy(r)!;
      return [c.badgeKey, c.detailKey];
    }).sort();
    expect([...LOW_SCORE_COPY_KEYS].sort()).toEqual(emitted);
  });

  it("derives the key stem from the vocabulary value itself", () => {
    // Hand-typed keys are how a new reason ships pointing at a catalog entry that
    // does not exist; the stem is computed, so the two cannot drift apart.
    expect(lowScoreBadgeKey("declined_mandate")).toBe("lowScoreDeclinedMandateBadge");
    expect(lowScoreDetailKey("low_legislative_output")).toBe("lowScoreLowLegislativeOutputDetail");
    expect(lowScoreBadgeKey("unknown")).toBe("lowScoreUnknownBadge");
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
    // The SENTENCE that says so now lives in the catalogs and is pinned there
    // (features/civicscore/messages.test.ts — „NENÍ korektiv" / „NOT a correction"),
    // together with the Czech language gate this module used to carry itself.
    expect(lowScoreReasonCopy("genuine_absentee")!.tone).toBe("neutral");
    expect(lowScoreReasonCopy("genuine_absentee")!.detailKey).toBe("lowScoreGenuineAbsenteeDetail");
  });
});
