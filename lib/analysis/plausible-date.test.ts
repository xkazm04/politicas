import { describe, expect, it } from "vitest";
import { PLAUSIBLE_FROM, isPlausibleIsoDate, plausibleIsoDateOrNull } from "./plausible-date";

const TODAY = "2026-07-28";

describe("isPlausibleIsoDate", () => {
  it("accepts a date inside <vznik ČR, dnes>", () => {
    expect(isPlausibleIsoDate("2016-09-23", TODAY)).toBe(true);
    expect(isPlausibleIsoDate(PLAUSIBLE_FROM, TODAY)).toBe(true);
    expect(isPlausibleIsoDate(TODAY, TODAY)).toBe(true);
  });

  // The real garbage measured in the tied-contract corpus (19/97 887 rows).
  it.each(["0002-02-25", "0016-08-18", "0018-02-21", "0024-12-20", "1970-01-01", "2027-06-30", "2029-09-29", "3062-07-16"])(
    "rejects the impossible signature date %s",
    (bad) => {
      expect(isPlausibleIsoDate(bad, TODAY)).toBe(false);
    },
  );

  it("rejects a signature dated after today rather than back-dating it", () => {
    expect(isPlausibleIsoDate("2026-12-19", TODAY)).toBe(false);
  });

  it("rejects absent and malformed input instead of guessing", () => {
    expect(isPlausibleIsoDate(null, TODAY)).toBe(false);
    expect(isPlausibleIsoDate(undefined, TODAY)).toBe(false);
    expect(isPlausibleIsoDate("", TODAY)).toBe(false);
    expect(isPlausibleIsoDate("2016-9-3", TODAY)).toBe(false);
    expect(isPlausibleIsoDate("nedatováno", TODAY)).toBe(false);
  });

  it("tolerates a full ISO timestamp, reading only its day", () => {
    expect(isPlausibleIsoDate("2016-09-23T10:11:12.000Z", TODAY)).toBe(true);
  });
});

describe("plausibleIsoDateOrNull", () => {
  it("returns the day part, never a corrected value", () => {
    expect(plausibleIsoDateOrNull("2016-09-23T00:00:00Z", TODAY)).toBe("2016-09-23");
    expect(plausibleIsoDateOrNull("3062-07-16", TODAY)).toBeNull();
  });
});
