import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { getBudgetSeries, getRegistry, latestMetrics, type Municipality, type TownBudgetSeries } from "./mirrorData";
import { SNAPSHOT_YEARS } from "./data/budgetSnapshots.generated";
import {
  bandIndexFor,
  median,
  MIN_PEERS,
  peerGroupFor,
  peerMedians,
  POPULATION_BANDS,
} from "./peerGroups";

const town = (ic: string, population: number, krajIndex: number): Municipality => ({
  ic,
  name: `Obec ${ic}`,
  county: "Okres",
  krajIndex,
  krajName: `Kraj ${krajIndex}`,
  population,
});

const series = (ic: string, debt: (number | null)[]): TownBudgetSeries => ({
  ic,
  years: [2023, 2024, 2025],
  debtPerCapita: debt,
  capexRatio: debt.map((d) => (d === null ? null : 20)),
  saldoPerCapita: debt.map((d) => (d === null ? null : -100)),
});

describe("bandIndexFor", () => {
  it("maps boundary populations to the disclosed bands (lower inclusive, upper exclusive)", () => {
    expect(bandIndexFor(0)).toBe(0);
    expect(bandIndexFor(199)).toBe(0);
    expect(bandIndexFor(200)).toBe(1);
    expect(bandIndexFor(9_999)).toBe(5);
    expect(bandIndexFor(10_000)).toBe(6);
    expect(bandIndexFor(99_999)).toBe(8);
    expect(bandIndexFor(100_000)).toBe(9);
    expect(bandIndexFor(1_400_000)).toBe(9); // Praha — poslední pásmo bez stropu
  });

  it("bands tile the whole population axis without gaps", () => {
    for (let i = 1; i < POPULATION_BANDS.length; i++) {
      expect(POPULATION_BANDS[i].min).toBe(POPULATION_BANDS[i - 1].max);
    }
    expect(POPULATION_BANDS[POPULATION_BANDS.length - 1].max).toBeNull();
  });
});

describe("peerGroupFor", () => {
  // 6 covered towns in band 10k–20k / kraj 1, one in kraj 2, plus noise.
  const registry: Municipality[] = [
    town("00000001", 15_000, 1), // the selected town
    ...Array.from({ length: 6 }, (_, i) => town(`0000001${i}`, 12_000 + i, 1)),
    town("00000020", 13_000, 2),
    town("00000030", 500, 1), // different band, same kraj — never a peer
    town("00000040", 15_500, 1), // same band+kraj but NOT covered
  ];
  const covered = new Set(registry.map((m) => m.ic));
  covered.delete("00000040");

  it("stays within the kraj when it has at least MIN_PEERS covered peers", () => {
    const g = peerGroupFor(registry[0], registry, covered);
    expect(g.scope).toBe("kraj");
    expect(g.peers).toHaveLength(6);
    expect(g.peers.every((p) => p.krajIndex === 1)).toBe(true);
    expect(g.peers.some((p) => p.ic === "00000001")).toBe(false); // never self
    expect(g.peers.some((p) => p.ic === "00000040")).toBe(false); // never uncovered
    expect(g.peers.some((p) => p.ic === "00000030")).toBe(false); // never cross-band
    expect(g.bandLabel).toBe("10 000–19 999 obyvatel");
  });

  it("widens to the national band when the kraj group is under MIN_PEERS", () => {
    const krajTwoTown = registry.find((m) => m.ic === "00000020")!;
    const g = peerGroupFor(krajTwoTown, registry, covered);
    expect(g.scope).toBe("celostátní");
    // national band = the 7 kraj-1 towns (selected included, it's not self here)
    expect(g.peers).toHaveLength(7);
    expect(g.peers.length).toBeGreaterThanOrEqual(MIN_PEERS);
  });

  it("is deterministic and preserves registry order", () => {
    const a = peerGroupFor(registry[0], registry, covered).peers.map((p) => p.ic);
    const b = peerGroupFor(registry[0], registry, covered).peers.map((p) => p.ic);
    expect(a).toEqual(b);
  });
});

describe("median", () => {
  it("computes odd/even medians and refuses an empty sample", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("peerMedians", () => {
  const peers = [town("00000010", 12_000, 1), town("00000011", 12_001, 1), town("00000012", 12_002, 1)];
  const map = new Map<string, TownBudgetSeries>([
    ["00000010", series("00000010", [1000, 2000, 3000])],
    ["00000011", series("00000011", [2000, 3000, 5000])],
    ["00000012", series("00000012", [null, null, null])], // reported nothing
  ]);

  it("computes latest-year medians only from peers that reported a value", () => {
    const m = peerMedians(peers, map, 3);
    expect(m.debtPerCapita).toBe(4000); // median of [3000, 5000]
    expect(m.sampleSize).toBe(2);
    expect(m.capexRatio).toBe(20);
  });

  it("derives a per-year debt trend, with null for years nobody reported", () => {
    const empty = peerMedians([peers[2]], map, 3);
    expect(empty.debtTrend).toEqual([null, null, null]);
    const m = peerMedians(peers, map, 3);
    expect(m.debtTrend).toEqual([1500, 2500, 4000]);
  });

  it("a peer missing from the series map contributes nothing (never a 0)", () => {
    const m = peerMedians([town("99999999", 12_000, 1)], map, 3);
    expect(m.debtPerCapita).toBeNull();
    expect(m.sampleSize).toBe(0);
  });
});

describe("co soubor tvrdí, drží test (2026-09-01)", () => {
  it("štítek pásma v kódu = katalogový klíč budget.band{i} v obou jazycích (jedna věta, dvě deklarace)", () => {
    const cs = csCatalog.budget as Record<string, string>;
    const en = enCatalog.budget as Record<string, string>;
    POPULATION_BANDS.forEach((band, i) => {
      expect(cs[`band${i}`], `cs band${i}`).toBe(band.label);
      expect(en[`band${i}`], `en band${i}`).toBeTypeOf("string");
    });
    // Žádné pásmo navíc v katalogu, které by kód neznal.
    const catalogBands = Object.keys(cs).filter((k) => /^band\d+$/.test(k));
    expect(catalogBands).toHaveLength(POPULATION_BANDS.length);
  });

  it("peerGroupFor neřadí podle metriky — vrací pořadí rejstříku (řazení podle dluhu je věc plochy)", () => {
    const registry = [town("00000001", 12_000, 1), town("00000002", 11_000, 1), town("00000003", 19_000, 1)];
    const g = peerGroupFor(town("00000009", 15_000, 1), registry, new Set(registry.map((m) => m.ic)));
    expect(g.peers.map((p) => p.ic)).toEqual(["00000001", "00000002", "00000003"]);
  });

  it("medián stojí nad posledním rokem dávky — vrstevník, který ho nevykázal, nevstupuje, ať vykázal cokoli dřív", () => {
    const series = new Map<string, TownBudgetSeries>([
      ["00000001", { ic: "00000001", years: [2024, 2025], debtPerCapita: [100, 300], capexRatio: [10, 20], saldoPerCapita: [1, 3] }],
      ["00000002", { ic: "00000002", years: [2024, 2025], debtPerCapita: [900, null], capexRatio: [90, null], saldoPerCapita: [9, null] }],
    ]);
    const m = peerMedians([town("00000001", 12_000, 1), town("00000002", 12_000, 1)], series, 2);
    expect(m.debtPerCapita).toBe(300);
    expect(m.sampleSize).toBe(1);
  });

  it("peerRule tiskne jeden počet pro tři mediány — ve skutečné dávce jsou vzorky capex a salda stejně velké jako vzorek dluhu", () => {
    const all = getRegistry();
    const series = getBudgetSeries();
    const covered = new Set(series.keys());
    const offenders: string[] = [];
    for (const m of all) {
      if (!covered.has(m.ic)) continue;
      const g = peerGroupFor(m, all, covered);
      const md = peerMedians(g.peers, series, SNAPSHOT_YEARS.length);
      let capexN = 0;
      let saldoN = 0;
      for (const p of g.peers) {
        const ps = series.get(p.ic);
        if (!ps) continue;
        if (ps.capexRatio[ps.capexRatio.length - 1] !== null) capexN++;
        if (ps.saldoPerCapita[ps.saldoPerCapita.length - 1] !== null) saldoN++;
      }
      if (capexN !== md.sampleSize || saldoN !== md.sampleSize) offenders.push(`${m.name}: dluh ${md.sampleSize} · capex ${capexN} · saldo ${saldoN}`);
    }
    // Když tohle spadne, věta „medián z {count} obcí" platí jen pro dluh:
    // buď se počet vysází per metrika, nebo se sampleSize rozpadne na tři.
    expect(offenders).toEqual([]);
  });
  it("ve skutečné dávce vykázala každá obec v záznamu poslední rok — rok v popisku MetricDuo tak platí i pro medián", () => {
    const lastYear = SNAPSHOT_YEARS[SNAPSHOT_YEARS.length - 1];
    const series = getBudgetSeries();
    const offenders: string[] = [];
    for (const m of getRegistry()) {
      const latest = latestMetrics(series.get(m.ic));
      if (latest && latest.year !== lastYear) offenders.push(`${m.name}:${latest.year}`);
    }
    // Když tohle spadne, není chyba v datech: je v popisku. MetricDuo tiskne rok
    // obce nad oběma pruhy a medián je nad posledním rokem dávky — buď se medián
    // začne počítat nad rokem obce, nebo popisek dostane dva roky.
    expect(offenders).toEqual([]);
  });
});
