// Deník republiky — pražský den. Testy hlídají PRAVIDLO (den je pražský,
// posun se čte ze zóny, letní čas se neodhaduje), ne dnešní hodiny.

import { describe, expect, it } from "vitest";
import {
  formatOffset,
  pragueDay,
  pragueDayRfc3339,
  pragueDayStart,
  pragueOffsetMinutes,
} from "./pragueDay";

describe("pragueDay — den je pražský, ne UTC", () => {
  it("mezi půlnocí a druhou hodinou letního času je pražský den o den napřed", () => {
    const instant = new Date("2026-08-04T22:30:00.000Z"); // 5. 8. 00:30 v Praze
    expect(instant.toISOString().slice(0, 10)).toBe("2026-08-04"); // co počítal loader
    expect(pragueDay(instant)).toBe("2026-08-05"); // co je v Praze skutečně
  });

  it("v zimě se den láme o hodinu později (SEČ), a pravidlo se nemění", () => {
    expect(pragueDay(new Date("2026-01-04T22:30:00.000Z"))).toBe("2026-01-04");
    expect(pragueDay(new Date("2026-01-04T23:30:00.000Z"))).toBe("2026-01-05");
  });

  it("v poledne UTC se oba dny shodují (oprava nic neposouvá zbytečně)", () => {
    expect(pragueDay(new Date("2026-08-04T12:00:00.000Z"))).toBe("2026-08-04");
    expect(pragueDay(new Date("2026-01-04T12:00:00.000Z"))).toBe("2026-01-04");
  });
});

describe("posun se čte ze zóny — letní čas není konstanta", () => {
  it("SELČ je +120, SEČ +60", () => {
    expect(pragueOffsetMinutes(new Date("2026-08-04T12:00:00.000Z"))).toBe(120);
    expect(pragueOffsetMinutes(new Date("2026-01-04T12:00:00.000Z"))).toBe(60);
  });

  it("formatOffset dává RFC 3339 tvar", () => {
    expect(formatOffset(120)).toBe("+02:00");
    expect(formatOffset(60)).toBe("+01:00");
    expect(formatOffset(0)).toBe("+00:00");
    expect(formatOffset(-330)).toBe("-05:30");
  });
});

describe("pražská půlnoc dne", () => {
  it("den přechodu na letní čas dostane posun platný O PŮLNOCI, ne po přechodu", () => {
    // 2026-03-29: přechod ve 02:00 SEČ → 03:00 SELČ. Půlnoc toho dne je ještě +01:00.
    const start = pragueDayStart("2026-03-29");
    expect(start).not.toBeNull();
    expect(start!.offsetMinutes).toBe(60);
    expect(new Date(start!.ms).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(pragueDayRfc3339("2026-03-29")).toBe("2026-03-29T00:00:00+01:00");
  });

  it("den přechodu zpět na SEČ má o půlnoci ještě +02:00", () => {
    // 2026-10-25: přechod ve 03:00 SELČ → 02:00 SEČ.
    expect(pragueDayRfc3339("2026-10-25")).toBe("2026-10-25T00:00:00+02:00");
  });

  it("běžný letní i zimní den", () => {
    expect(pragueDayRfc3339("2026-08-04")).toBe("2026-08-04T00:00:00+02:00");
    expect(pragueDayRfc3339("2026-01-04")).toBe("2026-01-04T00:00:00+01:00");
  });

  it("nevalidní den se neodhaduje — null", () => {
    expect(pragueDayRfc3339("2026-8-4")).toBeNull();
    expect(pragueDayRfc3339("")).toBeNull();
    expect(pragueDayStart("nesmysl")).toBeNull();
  });

  it("razítko se dá zpětně přečíst na týž den (round-trip)", () => {
    for (const day of ["2026-01-01", "2026-03-29", "2026-06-15", "2026-10-25", "2026-12-31"]) {
      const stamp = pragueDayRfc3339(day)!;
      expect(pragueDay(new Date(stamp))).toBe(day);
    }
  });
});
