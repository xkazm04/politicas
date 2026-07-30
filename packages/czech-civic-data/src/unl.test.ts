import { describe, expect, it } from "vitest";
import {
  col,
  colInt,
  czDateHourToIso,
  czDateTimeToIso,
  czDateToIso,
  decodeUnl,
  parseUnl,
  parseUnlLine,
} from "./unl";

describe("parseUnlLine", () => {
  it("splits on pipe and drops the trailing terminator column", () => {
    expect(parseUnlLine("1|Praha|2025|")).toEqual(["1", "Praha", "2025"]);
  });

  it("maps an empty column to null (SQL NULL semantics)", () => {
    expect(parseUnlLine("1||3|")).toEqual(["1", null, "3"]);
  });

  it("treats an escaped pipe as a literal, not a delimiter", () => {
    // A vote title legitimately contains a pipe: "Zákon § 12 | 2. čtení".
    expect(parseUnlLine("86327|Zákon \\| 2. čtení|A|")).toEqual([
      "86327",
      "Zákon | 2. čtení",
      "A",
    ]);
  });

  it("unescapes backslash and control escapes", () => {
    expect(parseUnlLine("a\\\\b|c\\nd|")).toEqual(["a\\b", "c\nd"]);
  });

  it("passes an undocumented escape through verbatim", () => {
    expect(parseUnlLine("a\\qb|")).toEqual(["aqb"]);
  });

  it("keeps a dangling backslash at end-of-line instead of dropping it", () => {
    expect(parseUnlLine("abc\\")).toEqual(["abc\\"]);
  });

  it("keeps a non-empty remainder when the terminating pipe is missing", () => {
    expect(parseUnlLine("1|no-terminator")).toEqual(["1", "no-terminator"]);
  });
});

describe("parseUnl", () => {
  it("splits physical newlines before unescaping so an escaped \\n survives", () => {
    const rows = parseUnl("1|line\\none|\n2|two|");
    expect(rows).toEqual([["1", "line\none"], ["2", "two"]]);
  });

  it("skips blank lines", () => {
    expect(parseUnl("1|a|\n\n2|b|\n")).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    expect(parseUnl("1|a|\r\n2|b|\r\n")).toEqual([["1", "a"], ["2", "b"]]);
  });
});

describe("decodeUnl", () => {
  it("decodes windows-1250 bytes to Czech text", () => {
    // 0x9E = ž, 0xF8 = ř, 0xE8 = č in cp1250.
    const bytes = new Uint8Array([0x9e, 0xf8, 0xe8]);
    expect(decodeUnl(bytes)).toBe("žřč");
  });

  it("maps cp1250 gap bytes to C1 controls, never to U+FFFD (documented behavior)", () => {
    // The WHATWG encoding index for windows-1250 fills the vendor-unassigned
    // positions (0x81, 0x83, 0x88, 0x90, 0x98) with the corresponding C1
    // control characters, so `fatal: true` can never fire for this encoding —
    // it is defense-in-depth only. This test PINS that: a corrupt byte comes
    // through as a detectable control char, not as a silent U+FFFD.
    expect(decodeUnl(new Uint8Array([0x41, 0x81]))).toBe("A\u0081");
    expect(decodeUnl(new Uint8Array([0x41, 0x81]))).not.toContain("�");
  });
});

describe("date parsing", () => {
  it("converts DD.MM.YYYY to ISO", () => {
    expect(czDateToIso("3.11.2025")).toBe("2025-11-03");
    expect(czDateToIso("03.11.2025")).toBe("2025-11-03");
  });
  it("rejects malformed dates rather than guessing", () => {
    expect(czDateToIso("2025-11-03")).toBeNull();
    expect(czDateToIso("31.13.2025")).toBeNull();
    expect(czDateToIso("")).toBeNull();
    expect(czDateToIso(null)).toBeNull();
  });
  it("parses datetime(year to hour) into a UTC instant", () => {
    expect(czDateHourToIso("2025-10-04 15")).toBe("2025-10-04T15:00:00.000Z");
    expect(czDateHourToIso("2025-10-04")).toBe("2025-10-04T00:00:00.000Z");
  });
  it("rejects a regex-shaped but semantically invalid year-to-hour value", () => {
    expect(czDateHourToIso("2025-13-01 10")).toBeNull();
    expect(czDateHourToIso("2025-10-04 27")).toBeNull();
    expect(czDateHourToIso(null)).toBeNull();
  });
  it("combines a Czech date and HH:MM time", () => {
    expect(czDateTimeToIso("03.11.2025", "15:10")).toBe("2025-11-03T15:10:00.000Z");
    expect(czDateTimeToIso("03.11.2025", null)).toBe("2025-11-03T00:00:00.000Z");
  });
  it("rejects an out-of-range HH:MM instead of emitting a fake instant", () => {
    expect(czDateTimeToIso("03.11.2025", "25:00")).toBeNull();
    expect(czDateTimeToIso("03.11.2025", "12:61")).toBeNull();
  });
});

describe("col / colInt", () => {
  it("returns null for a missing column (short rows happen)", () => {
    expect(col(["a"], 0)).toBe("a");
    expect(col(["a"], 3)).toBeNull();
  });
  it("parses an integer column or returns null", () => {
    expect(colInt(["7", ""], 0)).toBe(7);
    expect(colInt(["7", ""], 1)).toBeNull();
    expect(colInt(["7"], 5)).toBeNull();
  });
  it("accepts negative integers and surrounding whitespace", () => {
    expect(colInt([" -42 "], 0)).toBe(-42);
  });
  it("requires the FULL value to be digits — no prefix-parse coercion", () => {
    // Number.parseInt would silently accept "123abc" as 123, coercing a
    // malformed or mis-escaped field into a plausible-looking wrong id.
    expect(colInt(["123abc"], 0)).toBeNull();
    expect(colInt(["45|"], 0)).toBeNull();
    expect(colInt(["1.5"], 0)).toBeNull();
  });
});
