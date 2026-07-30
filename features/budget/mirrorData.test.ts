import { describe, expect, it } from "vitest";

import {
  coverageStats,
  foldCzech,
  getBudgetSeries,
  getMunicipality,
  getRegistry,
  latestMetrics,
  packRegistry,
  parseRegistry,
  parseSnapshots,
  searchMunicipalities,
  type Municipality,
} from "./mirrorData";
import { SNAPSHOT_YEARS } from "./data/budgetSnapshots.generated";

describe("registry codec", () => {
  const rows: Municipality[] = [
    { ic: "00233129", name: "Beroun", county: "Beroun", krajIndex: 1, krajName: "Středočeský kraj", population: 21744 },
    { ic: "00064581", name: "Hlavní město Praha", county: "Hlavní město Praha", krajIndex: 0, krajName: "Hlavní město Praha", population: 1397880 },
  ];

  it("round-trips pack → parse", () => {
    expect(parseRegistry(packRegistry(rows))).toEqual(rows);
  });

  it("pack refuses unsafe rows; parse refuses malformed lines (fail-loud)", () => {
    expect(() => packRegistry([{ ...rows[0], ic: "123" }])).toThrow(/IČO/);
    expect(() => packRegistry([{ ...rows[0], name: "a|b" }])).toThrow(/znak/);
    expect(() => parseRegistry("only|three|cells")).toThrow(/vadný řádek/);
    expect(() => parseRegistry("00233129|X|Y|99|100")).toThrow(/vadný řádek/); // kraj index out of range
  });
});

describe("generated dataset (the real 2026-07-30 MONITOR harvest)", () => {
  it("registry holds all 6,254 municipalities of the ČR", () => {
    // The number the coverage line on-page cites — 14 kraje summed exactly to
    // the national municipality count when harvested (verified live).
    expect(getRegistry()).toHaveLength(6254);
  });

  it("looks up a known town by IČO", () => {
    const beroun = getMunicipality("00233129");
    expect(beroun?.name).toBe("Beroun");
    expect(beroun?.krajName).toBe("Středočeský kraj");
    expect(getMunicipality("99999999")).toBeNull();
  });

  it("budget series cover every snapshot town with per-capita derivations", () => {
    const series = getBudgetSeries();
    expect(series.size).toBeGreaterThanOrEqual(100);
    const beroun = series.get("00233129");
    expect(beroun?.years).toEqual(SNAPSHOT_YEARS);
    // Real value cross-checked against MONITOR by hand: dluh 88 719 159 Kč /
    // 21 521 obyvatel (2025) = 4 122,45 → 4 122 Kč na obyvatele.
    expect(beroun?.debtPerCapita[SNAPSHOT_YEARS.length - 1]).toBe(4122);
    expect(beroun?.capexRatio[SNAPSHOT_YEARS.length - 1]).toBe(37.3);
  });

  it("coverage stats disclose the honest gap (covered ≪ registry)", () => {
    const c = coverageStats();
    expect(c.registryTotal).toBe(6254);
    expect(c.covered).toBeGreaterThanOrEqual(100);
    expect(c.covered).toBeLessThan(c.registryTotal);
  });
});

describe("parseSnapshots", () => {
  it("parses year cells and maps empty cells to null — never 0", () => {
    const m = parseSnapshots("00000001|1;2;3;4;5|;;;;|1;2;3;-4;0||10;20;30;40;50");
    const years = m.get("00000001")!;
    expect(years).toHaveLength(5);
    expect(years[0]).toEqual({ debtCzk: 1, expenditureCzk: 2, capexCzk: 3, saldoCzk: 4, population: 5 });
    expect(years[1].debtCzk).toBeNull();
    expect(years[3]).toEqual({ debtCzk: null, expenditureCzk: null, capexCzk: null, saldoCzk: null, population: null });
  });

  it("fails loud on a malformed row", () => {
    expect(() => parseSnapshots("00000001|1;2")).toThrow(/vadný/);
  });
});

describe("latestMetrics", () => {
  it("walks back to the last year with any reported value", () => {
    const m = latestMetrics({
      ic: "x",
      years: [2023, 2024, 2025],
      debtPerCapita: [100, 200, null],
      capexRatio: [10, null, null],
      saldoPerCapita: [1, 2, null],
    });
    expect(m?.year).toBe(2024);
    expect(m?.debtPerCapita).toBe(200);
  });

  it("returns null for a town with no reported year at all", () => {
    expect(latestMetrics(undefined)).toBeNull();
    expect(
      latestMetrics({ ic: "x", years: [2025], debtPerCapita: [null], capexRatio: [null], saldoPerCapita: [null] }),
    ).toBeNull();
  });
});

describe("searchMunicipalities", () => {
  const all = getRegistry();

  it("empty query returns the largest towns (picker default)", () => {
    const top = searchMunicipalities(all, "", 3);
    expect(top.map((m) => m.name)).toEqual(["Hlavní město Praha", "Brno", "Ostrava"]);
  });

  it("is diacritics- and case-insensitive", () => {
    expect(foldCzech("Řevničov")).toBe("revnicov");
    const hits = searchMunicipalities(all, "trebic", 5);
    expect(hits[0]?.name).toBe("Třebíč");
  });

  it("ranks exact match over prefix over substring", () => {
    const hits = searchMunicipalities(all, "Brno", 10);
    expect(hits[0].name).toBe("Brno");
    const prefix = searchMunicipalities(all, "Ber", 10);
    expect(prefix.some((m) => m.name === "Beroun")).toBe(true);
  });

  it("respects the limit at 6k scale", () => {
    expect(searchMunicipalities(all, "l", 12)).toHaveLength(12);
  });
});
