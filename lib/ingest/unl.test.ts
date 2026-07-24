import { describe, expect, it } from "vitest";
import {
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
});

describe("parseUnl", () => {
  it("splits physical newlines before unescaping so an escaped \\n survives", () => {
    const rows = parseUnl("1|line\\none|\n2|two|");
    expect(rows).toEqual([["1", "line\none"], ["2", "two"]]);
  });

  it("skips blank lines", () => {
    expect(parseUnl("1|a|\n\n2|b|\n")).toHaveLength(2);
  });
});

describe("decodeUnl", () => {
  it("decodes windows-1250 bytes to Czech text", () => {
    // 0x9E = ž, 0xF8 = ř, 0xE8 = č in cp1250.
    const bytes = new Uint8Array([0x9e, 0xf8, 0xe8]);
    expect(decodeUnl(bytes)).toBe("žřč");
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
  it("combines a Czech date and HH:MM time", () => {
    expect(czDateTimeToIso("03.11.2025", "15:10")).toBe("2025-11-03T15:10:00.000Z");
    expect(czDateTimeToIso("03.11.2025", null)).toBe("2025-11-03T00:00:00.000Z");
  });
});

describe("colInt", () => {
  it("parses an integer column or returns null", () => {
    expect(colInt(["7", ""], 0)).toBe(7);
    expect(colInt(["7", ""], 1)).toBeNull();
    expect(colInt(["7"], 5)).toBeNull();
  });
});
