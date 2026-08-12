import { describe, expect, it } from "vitest";
import {
  formatCzechDate,
  isTenureClass,
  isTrendTooEarly,
  mandateNoteCopy,
  tenureClassLabel,
  tenureDetailKey,
  tenureLabelKey,
  TENURE_COPY_KEYS,
  TREND_MIN_TENURE_DAYS,
} from "./tenure-copy";

describe("isTenureClass", () => {
  it("accepts every vocabulary value", () => {
    for (const c of ["full_term", "replacement", "departed", "never_seated"]) {
      expect(isTenureClass(c)).toBe(true);
    }
  });

  it("rejects unknown strings, non-strings, null and undefined", () => {
    expect(isTenureClass("mid_term")).toBe(false);
    expect(isTenureClass("")).toBe(false);
    expect(isTenureClass(42)).toBe(false);
    expect(isTenureClass(null)).toBe(false);
    expect(isTenureClass(undefined)).toBe(false);
  });
});

describe("formatCzechDate", () => {
  it("formats an ISO date day-first without leading zeros", () => {
    expect(formatCzechDate("2025-11-12")).toBe("12. 11. 2025");
    expect(formatCzechDate("2026-03-01")).toBe("1. 3. 2026");
  });

  it("returns null for malformed input", () => {
    expect(formatCzechDate("not-a-date")).toBeNull();
    expect(formatCzechDate("")).toBeNull();
  });
});

describe("isTrendTooEarly", () => {
  it("is true below the threshold and false at/above it", () => {
    expect(isTrendTooEarly(0)).toBe(true);
    expect(isTrendTooEarly(TREND_MIN_TENURE_DAYS - 1)).toBe(true);
    expect(isTrendTooEarly(TREND_MIN_TENURE_DAYS)).toBe(false);
    expect(isTrendTooEarly(400)).toBe(false);
  });

  it("fails closed (suppresses the comparison) for missing/malformed tenure", () => {
    // An unknown tenure length must never be read as "long enough" — that
    // would show the exact noisy rate comparison this gate exists to prevent
    // for the population whose tenure genuinely can't be measured.
    expect(isTrendTooEarly(null)).toBe(true);
    expect(isTrendTooEarly(undefined)).toBe(true);
    expect(isTrendTooEarly("90")).toBe(true);
  });
});

describe("mandateNoteCopy", () => {
  it("selects the replacement sentence and hands back the ISO mandate-arose date", () => {
    const c = mandateNoteCopy("replacement", "2025-11-12", null);
    expect(c).not.toBeNull();
    expect(c!.detailKey).toBe("mandateNoteReplacement");
    // ISO, not a formatted Czech date: the consumer formats through lib/format.ts,
    // so an English reader gets an English-locale date instead of „12. 11. 2025"
    // sitting inside an English sentence.
    expect(c!.start).toBe("2025-11-12");
    expect(c!.end).toBeNull();
  });

  it("selects the two-date sentence when the mandate also ended", () => {
    const c = mandateNoteCopy("departed", "2025-10-04", "2026-02-01");
    expect(c).not.toBeNull();
    expect(c!.detailKey).toBe("mandateNoteDeparted");
    expect(c!.start).toBe("2025-10-04");
    expect(c!.end).toBe("2026-02-01");
  });

  it("selects a DIFFERENT sentence when there is no end date — never an empty slot", () => {
    const c = mandateNoteCopy("departed", "2025-10-04", undefined);
    expect(c).not.toBeNull();
    expect(c!.detailKey).toBe("mandateNoteDepartedNoEnd");
    expect(c!.end).toBeNull();
  });

  it("treats a malformed end date as no end date, and never passes it on", () => {
    // A note that interpolated „not-a-date" would print it to a reader; the
    // sentence without an end is the honest one.
    const c = mandateNoteCopy("departed", "2025-10-04", "not-a-date");
    expect(c!.detailKey).toBe("mandateNoteDepartedNoEnd");
    expect(c!.end).toBeNull();
  });

  it("degrades to null for full_term and never_seated — no note needed", () => {
    expect(mandateNoteCopy("full_term", "2025-10-04")).toBeNull();
    expect(mandateNoteCopy("never_seated", "2025-10-04")).toBeNull();
  });

  it("degrades to null for missing/unrecognized class or missing start date", () => {
    expect(mandateNoteCopy(undefined, "2025-10-04")).toBeNull();
    expect(mandateNoteCopy("unknown_class", "2025-10-04")).toBeNull();
    expect(mandateNoteCopy("replacement", undefined)).toBeNull();
    expect(mandateNoteCopy("replacement", 12345)).toBeNull();
  });

  // All THREE branches are named, because a branch that only ever gets its happy path
  // read is exactly how a sentence survives a review pointing at a key nobody wrote.
  // The Czech language gate over these three sentences MOVED with the copy into
  // features/civicscore/messages.test.ts, which also holds both catalogs to
  // `TENURE_COPY_KEYS`.
  it("can emit exactly three note sentences, all of them published", () => {
    const branches = [
      mandateNoteCopy("replacement", "2025-11-12", null)!,
      mandateNoteCopy("departed", "2025-10-04", "2026-02-01")!,
      mandateNoteCopy("departed", "2025-10-04", undefined)!,
    ];
    const keys = branches.map((c) => c.detailKey);
    expect(new Set(keys).size, "three branches, three sentences").toBe(3);
    for (const k of keys) expect(TENURE_COPY_KEYS, k).toContain(k);
  });
});

describe("tenureClassLabel", () => {
  it("labels all FOUR classes — unlike mandateNoteCopy, which stays silent on two", () => {
    const seen = new Set<string>();
    for (const c of ["full_term", "replacement", "departed", "never_seated"] as const) {
      const l = tenureClassLabel(c)!;
      expect(l, c).not.toBeNull();
      expect(l.labelKey, c).toBe(tenureLabelKey(c));
      expect(l.detailKey, c).toBe(tenureDetailKey(c));
      expect(seen.has(l.labelKey), `${c} reuses a label key`).toBe(false);
      seen.add(l.labelKey);
      seen.add(l.detailKey);
    }
  });

  it("derives the key stem from the class value, and publishes every key it emits", () => {
    expect(tenureLabelKey("never_seated")).toBe("tenureNeverSeatedLabel");
    expect(tenureDetailKey("full_term")).toBe("tenureFullTermDetail");
    for (const c of ["full_term", "replacement", "departed", "never_seated"] as const) {
      expect(TENURE_COPY_KEYS).toContain(tenureLabelKey(c));
      expect(TENURE_COPY_KEYS).toContain(tenureDetailKey(c));
    }
  });

  it("marks the three classes that structurally explain the counts beside them", () => {
    expect(tenureClassLabel("full_term")!.structural).toBe(false);
    expect(tenureClassLabel("replacement")!.structural).toBe(true);
    expect(tenureClassLabel("departed")!.structural).toBe(true);
    // The one the head-to-head exists to mark: an empty record is not a low score.
    expect(tenureClassLabel("never_seated")!.structural).toBe(true);
  });

  it("degrades to null for an unknown or missing class — never a fabricated label", () => {
    expect(tenureClassLabel("mid_term")).toBeNull();
    expect(tenureClassLabel(null)).toBeNull();
    expect(tenureClassLabel(undefined)).toBeNull();
    expect(tenureClassLabel(42)).toBeNull();
  });

});
