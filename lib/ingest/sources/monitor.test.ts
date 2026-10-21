import { describe, expect, it } from "vitest";

import {
  BUDGET_INDICATORS,
  capexRatioPct,
  extractBudgetYear,
  latestFinMPeriod,
  MonitorClient,
  parseMunicipalities,
  parseMunicipality,
  parsePeriods,
  perCapita,
} from "./monitor";

// Fixtures are trimmed captures of the LIVE API (2026-07-30) — real field names,
// real value shapes (floats in Kč, scientific-notation magnitudes), not invented.

const PERIODS_FIXTURE = [
  { year: 2026, loadID: 2612, month: "prosinec", isQuarter: true, isYear: true, active: true, finM: false },
  { year: 2026, loadID: 2606, month: "červen", isQuarter: true, finM: true },
  { year: 2025, loadID: 2512, month: "prosinec", isQuarter: true, finM: true },
  { year: 2025, loadID: 2511, month: "listopad", finM: false },
];

const MUNICIPALITY_FIXTURE = {
  ic: "00233129",
  name: "Město Beroun",
  shortName: "Beroun",
  population: 21744,
  region: { name: "Středočeský", fullname: "Středočeský kraj", nuts: "CZ020" },
  county: "Beroun",
  cofog: "Kód nebyl přidělen",
  type: { id: 4, label: "Obec", area: "LOCAL" },
};

// Live /api/ukazatele shape: named entries keyed by indicator name, value in Kč.
const INDICATORS_FIXTURE = {
  dluh: { name: "dluh", label: "Debt", source: "rozvaha", value: 88719159.04 },
  vydaje: { name: "vydaje", label: "Expenditures", value: 1.85250284087e9 },
  vydaje_kons: { name: "vydaje_kons", label: "Expenditures", value: 794524420.96 },
  kapitalove_vydaje_kons: { name: "kapitalove_vydaje_kons", label: "Capital expenditures", value: 2.9597421256e8 },
  saldo_kons: { name: "saldo_kons", label: "Balance", value: -8.713161298e7 },
  obyvatele: { name: "obyvatele", label: "Population", value: 21521 },
};

describe("parsePeriods / latestFinMPeriod", () => {
  it("parses period rows and keeps the finM flag", () => {
    const periods = parsePeriods(PERIODS_FIXTURE);
    expect(periods).toHaveLength(4);
    expect(periods[0]).toEqual({ loadID: 2612, year: 2026, month: "prosinec", finM: false });
  });

  it("drops malformed entries instead of guessing", () => {
    expect(parsePeriods([{ loadID: "x" }, null, 42, { year: 2025 }])).toEqual([]);
    expect(parsePeriods("nonsense")).toEqual([]);
  });

  it("latestFinMPeriod picks the highest loadID that actually has FIN-M data", () => {
    const periods = parsePeriods(PERIODS_FIXTURE);
    // 2612 is newer but finM=false — the mirror must not point at an empty period.
    expect(latestFinMPeriod(periods)?.loadID).toBe(2606);
    expect(latestFinMPeriod([])).toBeNull();
  });
});

describe("parseMunicipality", () => {
  it("parses the live row shape", () => {
    expect(parseMunicipality(MUNICIPALITY_FIXTURE)).toEqual({
      ic: "00233129",
      name: "Město Beroun",
      shortName: "Beroun",
      population: 21744,
      krajNuts: "CZ020",
      krajName: "Středočeský kraj",
      county: "Beroun",
    });
  });

  it("drops rows with a non-8-digit IČO or missing load-bearing fields", () => {
    expect(parseMunicipality({ ...MUNICIPALITY_FIXTURE, ic: "1234" })).toBeNull();
    expect(parseMunicipality({ ...MUNICIPALITY_FIXTURE, population: null })).toBeNull();
    expect(parseMunicipality({ ...MUNICIPALITY_FIXTURE, region: undefined })).toBeNull();
    expect(parseMunicipality(null)).toBeNull();
  });

  it("falls back to the full name when shortName is absent", () => {
    const row = parseMunicipality({ ...MUNICIPALITY_FIXTURE, shortName: undefined });
    expect(row?.shortName).toBe("Město Beroun");
  });

  it("parseMunicipalities counts dropped rows instead of hiding them", () => {
    const { rows, dropped } = parseMunicipalities([MUNICIPALITY_FIXTURE, { ic: "bad" }, null]);
    expect(rows).toHaveLength(1);
    expect(dropped).toBe(2);
  });
});

// Live /api/ukazatele capture 2026-10-22 (IČO 00236021, 12/2025), with the per-indicator
// `source` and `consolidated` fields the API returns. A town whose příspěvkové
// organizace carry debt: `dluh_celkem` = `dluh` + `dluh_po`, and gross `vydaje` is
// 2.17× `vydaje_kons`.
const VARIANTS_FIXTURE = {
  dluh: { name: "dluh", source: "rozvaha", consolidated: null, value: 3508510 },
  dluh_po: { name: "dluh_po", source: "rozvaha", consolidated: null, value: 35773844.72 },
  dluh_celkem: { name: "dluh_celkem", source: "rozvaha", consolidated: null, value: 39282354.72 },
  vydaje: { name: "vydaje", source: "rozpocet", consolidated: false, value: 1238821621.55 },
  vydaje_kons: { name: "vydaje_kons", source: "rozpocet_konsolidovany", consolidated: true, value: 570558162.79 },
  kapitalove_vydaje_kons: { name: "kapitalove_vydaje_kons", source: "rozpocet_konsolidovany", consolidated: true, value: 191581285.06 },
  saldo_kons: { name: "saldo_kons", source: "rozpocet_konsolidovany", consolidated: true, value: 26458378.4 },
  obyvatele: { name: "obyvatele", source: "pocob", consolidated: false, value: 10399 },
};

describe("BUDGET_INDICATORS", () => {
  it("declares, per field, the statement and variant the live API reports for that indicator", () => {
    for (const [field, d] of Object.entries(BUDGET_INDICATORS)) {
      const live = VARIANTS_FIXTURE[d.key as keyof typeof VARIANTS_FIXTURE];
      expect(live, field).toBeDefined();
      expect({ source: live.source, consolidated: live.consolidated }, field).toEqual({
        source: d.source,
        consolidated: d.consolidated,
      });
    }
  });

  it("debt is the town's own (`dluh`), never the organizations' total, and never mixed with the gross flows", () => {
    const year = extractBudgetYear(VARIANTS_FIXTURE);
    expect(year.debtCzk).toBe(3508510);
    expect(year.expenditureCzk).toBe(570558162.79);
    // the ratio takes both operands from the consolidated variant
    expect(capexRatioPct(year.capexCzk, year.expenditureCzk)).toBe(33.6);
  });
});

describe("extractBudgetYear", () => {
  it("extracts the consolidated indicator subset from the live shape", () => {
    expect(extractBudgetYear(INDICATORS_FIXTURE)).toEqual({
      debtCzk: 88719159.04,
      expenditureCzk: 794524420.96,
      capexCzk: 295974212.56,
      saldoCzk: -87131612.98,
      population: 21521,
    });
  });

  it("maps absent indicators to null — never 0", () => {
    const partial = { dluh: INDICATORS_FIXTURE.dluh };
    expect(extractBudgetYear(partial)).toEqual({
      debtCzk: 88719159.04,
      expenditureCzk: null,
      capexCzk: null,
      saldoCzk: null,
      population: null,
    });
    expect(extractBudgetYear(null).debtCzk).toBeNull();
  });
});

describe("derivations", () => {
  it("perCapita rounds to whole Kč and refuses division by zero", () => {
    expect(perCapita(88719159.04, 21521)).toBe(4122);
    expect(perCapita(-87131612.98, 21521)).toBe(-4049);
    expect(perCapita(1000, 0)).toBeNull();
    expect(perCapita(null, 21521)).toBeNull();
    expect(perCapita(1000, null)).toBeNull();
  });

  it("capexRatioPct keeps one decimal and propagates nulls", () => {
    expect(capexRatioPct(295974212.56, 794524420.96)).toBe(37.3);
    expect(capexRatioPct(null, 794524420.96)).toBeNull();
    expect(capexRatioPct(295974212.56, 0)).toBeNull();
  });
});

describe("MonitorClient (injected fetch — no network)", () => {
  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

  it("harvestBudgetSnapshots maps year → December loadID and collects per-town years", async () => {
    const urls: string[] = [];
    const client = new MonitorClient({
      fetchImpl: (async (url: RequestInfo | URL) => {
        urls.push(String(url));
        return jsonResponse(INDICATORS_FIXTURE);
      }) as typeof fetch,
    });
    const snaps = await client.harvestBudgetSnapshots(["00233129"], [2024, 2025], { concurrency: 1 });
    expect(urls).toEqual([
      "https://monitor.statnipokladna.gov.cz/api/ukazatele?ic=00233129&obdobi=2412",
      "https://monitor.statnipokladna.gov.cz/api/ukazatele?ic=00233129&obdobi=2512",
    ]);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].byYear.get(2025)?.debtCzk).toBe(88719159.04);
  });

  it("fetchMunicipalities fails loud when most rows drop (shape drift)", async () => {
    const client = new MonitorClient({
      fetchImpl: (async () => jsonResponse([{ ic: "bad" }, { ic: "worse" }])) as typeof fetch,
    });
    await expect(client.fetchMunicipalities("CZ020", 2512)).rejects.toThrow(/shape drift/);
  });

  it("propagates HTTP failures instead of returning empty data", async () => {
    const client = new MonitorClient({
      fetchImpl: (async () => new Response("down", { status: 500 })) as typeof fetch,
    });
    await expect(client.fetchPeriods()).rejects.toThrow(/500/);
  });
});
