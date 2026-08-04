import { describe, expect, it } from "vitest";
import { looksEnglish } from "./language-gate";
import {
  formatCzechDate,
  isTenureClass,
  isTrendTooEarly,
  mandateNoteCopy,
  tenureClassLabel,
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
  it("renders a replacement note with the mandate-arose date", () => {
    const c = mandateNoteCopy("replacement", "2025-11-12", null);
    expect(c).not.toBeNull();
    expect(c!.detail).toContain("12. 11. 2025");
    expect(c!.detail).toContain("náhradník/nice");
  });

  it("renders a departed note with start and end dates when both are present", () => {
    const c = mandateNoteCopy("departed", "2025-10-04", "2026-02-01");
    expect(c).not.toBeNull();
    expect(c!.detail).toContain("4. 10. 2025");
    expect(c!.detail).toContain("1. 2. 2026");
  });

  it("renders a departed note without an end date gracefully", () => {
    const c = mandateNoteCopy("departed", "2025-10-04", undefined);
    expect(c).not.toBeNull();
    expect(c!.detail).toContain("4. 10. 2025");
    expect(c!.detail).not.toContain("zanikl");
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
});

describe("tenureClassLabel", () => {
  it("labels all FOUR classes — unlike mandateNoteCopy, which stays silent on two", () => {
    for (const c of ["full_term", "replacement", "departed", "never_seated"] as const) {
      const l = tenureClassLabel(c)!;
      expect(l, c).not.toBeNull();
      expect(l.label.length, c).toBeGreaterThan(0);
      expect(l.detail.length, c).toBeGreaterThan(0);
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

  it("is Czech — it renders verbatim to readers (language gate)", () => {
    for (const c of ["full_term", "replacement", "departed", "never_seated"] as const) {
      expect(looksEnglish(tenureClassLabel(c)!.label), c).toBe(false);
      expect(looksEnglish(tenureClassLabel(c)!.detail), c).toBe(false);
    }
  });
});
