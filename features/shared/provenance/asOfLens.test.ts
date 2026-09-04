// Čočka „k tomu dni" — pravidlo, které /zdroj i /overeni sdílejí.
//
// Test drží tři věci, které se v praxi lámou jako první: že se datum NEOPRAVUJE
// (ani přetečený kalendářní den, ani „skoro ISO" tvar), že se den čte k jeho
// KONCI (čtenář citoval to, co jsme ten den zveřejnili naposledy), a že tři
// různá „nemáme to" mají tři různé stavy — protože jinak se v sazbě slijí do
// jedné věty a čtenář nepozná „tehdy to tam nebylo" od „tak daleko zpátky nic
// nevíme".

import { describe, expect, it } from "vitest";
import { asOfBannerKey, asOfInstant, parseAsOfDay, showsHistoricalVersion, type ReceiptAsOf } from "./asOfLens";

describe("parseAsOfDay", () => {
  it("bere přesně ISO den", () => {
    expect(parseAsOfDay("2026-09-04")).toBe("2026-09-04");
    expect(parseAsOfDay("  2026-09-04  ")).toBe("2026-09-04");
    expect(parseAsOfDay("2020-02-29")).toBe("2020-02-29"); // přestupný rok existuje
  });

  it("neopravuje: nekalendářní den je odmítnut, ne posunut", () => {
    // new Date("2026-02-31") by tiše vyrobilo 3. března — přesně ta oprava,
    // kterou adresa nesmí dostat.
    expect(parseAsOfDay("2026-02-31")).toBeNull();
    expect(parseAsOfDay("2026-13-01")).toBeNull();
    expect(parseAsOfDay("2021-02-29")).toBeNull();
  });

  it("odmítá všechno, co není ISO den", () => {
    for (const raw of [
      "2026-9-4", // bez vodicí nuly
      "04.09.2026", // český tvar
      "2026-09-04T12:00:00Z", // instant, ne den
      "včera",
      "",
      "   ",
      null,
      undefined,
    ]) {
      expect(parseAsOfDay(raw), String(raw)).toBeNull();
    }
  });
});

describe("asOfInstant", () => {
  it("den se čte k svému KONCI — poslední verze platná ten den", () => {
    expect(asOfInstant("2026-09-04")).toBe("2026-09-04T23:59:59.999Z");
    // a je to platný instant, ne řetězec, který by store zamítl
    expect(Number.isNaN(Date.parse(asOfInstant("2026-09-04")))).toBe(false);
  });
});

describe("stavy čočky", () => {
  const states: ReceiptAsOf[] = [
    { state: "live" },
    { state: "refused", raw: "včera" },
    { state: "beforeEpoch", day: "2020-01-01", epoch: "2026-08-01T00:00:00.000Z" },
    { state: "absentThen", day: "2026-08-05" },
    { state: "at", day: "2026-08-05" },
  ];

  it("historickou verzi sází JEN stav `at`", () => {
    for (const s of states) {
      expect(showsHistoricalVersion(s), s.state).toBe(s.state === "at");
    }
  });

  it("každý neživý stav má vlastní klíč — tři různá „nemáme to“ nesmí znít stejně", () => {
    const keys = states.map(asOfBannerKey);
    expect(keys[0]).toBeNull(); // live nesází banner vůbec
    const named = keys.slice(1) as string[];
    expect(new Set(named).size).toBe(named.length);
    expect(named.every((k) => k.startsWith("receipt.asOf."))).toBe(true);
  });
});
