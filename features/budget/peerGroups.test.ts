import { describe, expect, it } from "vitest";

import type { Municipality, TownBudgetSeries } from "./mirrorData";
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
