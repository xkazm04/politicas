import { describe, expect, it } from "vitest";

import { componentDefs } from "./componentDefs";
import type { ComponentKey, LeaderboardData, LeaderboardListEntry } from "./getLeaderboardData";
import {
  decodeWeights,
  effectiveWeights,
  encodeWeights,
  histogramOf,
  isPublishedWeights,
  LENS_COMPONENT_ORDER,
  LENS_PRESETS,
  PUBLISHED_WEIGHTS,
  reweigh,
  summarizeScores,
  type WeightVector,
} from "./lens";

// ── fixtures ────────────────────────────────────────────────────────────────

// Zveřejněné složkové definice — IMPORTOVANÉ, ne přepsané. Šest labelů a šest
// citací tu dřív stálo jako literály ve třech fixtures; změna jednoho labelu je
// tiše rozešla s produktem, protože fixture nikdy neporovnávala svůj text s jeho.
const COMPONENTS: LeaderboardData["components"] = componentDefs();

function mk(
  name: string,
  pspId: number,
  components: Record<ComponentKey, number>,
  score: number,
): LeaderboardListEntry {
  return {
    pspId,
    rank: 0,
    name,
    clubAbbrev: "X",
    clubName: "X",
    clubColor: "steel", // fixture — nikdy se nekreslí (lint: žádné literální hexy)
    region: null,
    score,
    tiedCount: 1,
    components,
    effortWorkhorse: false,
    effortWorkhorseFlavour: null,
    effortRapporteurLoad: 0,
    effortHasDossier: false,
    effortLowScoreReason: null,
    effortRecordedAt: null,
    duelFacts: {
      speechTurns: null,
      amendmentsAuthored: null,
      interpellations: null,
      rapporteurLoad: null,
      tenureClass: null,
    },
  };
}

// Tři poslanci s odlišnými profily: A plný ve všem, B jen docházka+účast,
// C jen legislativa+sál.
const A = mk("Adamová", 1, { participation: 25, committee: 20, legislative: 20, speech: 15, attendance: 10, leadership: 10 }, 100);
const B = mk("Beneš", 2, { participation: 25, committee: 0, legislative: 0, speech: 0, attendance: 10, leadership: 0 }, 35);
const C = mk("Cibulka", 3, { participation: 0, committee: 0, legislative: 20, speech: 15, attendance: 0, leadership: 0 }, 35);

const w = (v: Partial<WeightVector>): WeightVector => ({ ...PUBLISHED_WEIGHTS, ...v });

// ── kódování do URL ─────────────────────────────────────────────────────────

describe("weights URL codec (?vahy=…)", () => {
  it("published weights encode to null — a clean address IS the official index", () => {
    expect(encodeWeights({ ...PUBLISHED_WEIGHTS })).toBeNull();
    expect(isPublishedWeights({ ...PUBLISHED_WEIGHTS })).toBe(true);
  });

  it("round-trips any custom vector in the fixed component order", () => {
    const custom = w({ attendance: 45, participation: 5 });
    const encoded = encodeWeights(custom);
    expect(encoded).toBe("5-20-20-15-45-10");
    expect(decodeWeights(encoded)).toEqual(custom);
  });

  it("round-trips every preset lens", () => {
    for (const p of LENS_PRESETS) {
      expect(decodeWeights(encodeWeights(p.weights))).toEqual(p.weights);
      expect(isPublishedWeights(p.weights)).toBe(false);
    }
  });

  it("rejects malformed input with null instead of guessing", () => {
    expect(decodeWeights(null)).toBeNull();
    expect(decodeWeights("")).toBeNull();
    expect(decodeWeights("25-20-20")).toBeNull(); // wrong arity
    expect(decodeWeights("25-20-20-15-10-10-5")).toBeNull(); // too many
    expect(decodeWeights("25-20-20-15-10-x")).toBeNull(); // not a number
    expect(decodeWeights("25-20-20-15-10-101")).toBeNull(); // out of range
    expect(decodeWeights("-5-20-20-15-10-10")).toBeNull(); // negative
    expect(decodeWeights("25-20-20-15-10-1.5")).toBeNull(); // not an integer
  });

  it("keeps the encoding order pinned to the published component order", () => {
    expect(LENS_COMPONENT_ORDER).toEqual(COMPONENTS.map((c) => c.key));
  });
});

// ── efektivní váhy ──────────────────────────────────────────────────────────

describe("effectiveWeights — sliders normalize to a 100-point index", () => {
  it("published weights already sum to 100 and pass through unchanged", () => {
    expect(effectiveWeights({ ...PUBLISHED_WEIGHTS })).toEqual({ ...PUBLISHED_WEIGHTS });
  });

  it("scaling every slider by the same factor is the same lens", () => {
    const doubled = Object.fromEntries(
      LENS_COMPONENT_ORDER.map((k) => [k, PUBLISHED_WEIGHTS[k] * 2]),
    ) as WeightVector;
    expect(effectiveWeights(doubled)).toEqual({ ...PUBLISHED_WEIGHTS });
  });

  it("an all-zero vector yields all-zero effective weights, not NaN", () => {
    const zero = w({ participation: 0, committee: 0, legislative: 0, speech: 0, attendance: 0, leadership: 0 });
    const eff = effectiveWeights(zero);
    for (const k of LENS_COMPONENT_ORDER) expect(eff[k]).toBe(0);
  });
});

// ── přepočet žebříčku ───────────────────────────────────────────────────────

describe("reweigh — the leaderboard under the reader's weights", () => {
  it("re-derives the published composite (±0,1) under published weights", () => {
    const view = reweigh([A, B, C], COMPONENTS, { ...PUBLISHED_WEIGHTS });
    const byId = new Map(view.entries.map((e) => [e.pspId, e]));
    expect(Math.abs(byId.get(1)!.score - 100)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(byId.get(2)!.score - 35)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(byId.get(3)!.score - 35)).toBeLessThanOrEqual(0.1);
  });

  it("re-ranks: an attendance-only lens puts the attender above the legislator", () => {
    const attendanceOnly = w({ participation: 0, committee: 0, legislative: 0, speech: 0, attendance: 100, leadership: 0 });
    const view = reweigh([A, B, C], COMPONENTS, attendanceOnly);
    expect(view.entries.map((e) => e.pspId)).toEqual([1, 2, 3]);
    const byId = new Map(view.entries.map((e) => [e.pspId, e]));
    // A i B mají plnou docházku → shodných 100,0; C má 0,0.
    expect(byId.get(1)!.score).toBe(100);
    expect(byId.get(2)!.score).toBe(100);
    expect(byId.get(3)!.score).toBe(0);
  });

  it("shares competition ranks on ties (1, 1, 3) and counts the tie", () => {
    const attendanceOnly = w({ participation: 0, committee: 0, legislative: 0, speech: 0, attendance: 100, leadership: 0 });
    const view = reweigh([A, B, C], COMPONENTS, attendanceOnly);
    expect(view.entries.map((e) => e.rank)).toEqual([1, 1, 3]);
    expect(view.entries.map((e) => e.tiedCount)).toEqual([2, 2, 1]);
    // uvnitř shody rozhoduje jen abeceda (Adamová < Beneš) — a nic netvrdí
    expect(view.entries.map((e) => e.name)).toEqual(["Adamová", "Beneš", "Cibulka"]);
  });

  it("keeps the component-points ≤ effective-weight invariant every bar depends on", () => {
    const lens = w({ speech: 80, legislative: 60 });
    const view = reweigh([A, B, C], COMPONENTS, lens);
    for (const e of view.entries) {
      for (const c of view.components) {
        expect(e.components[c.key]).toBeGreaterThanOrEqual(0);
        expect(e.components[c.key]).toBeLessThanOrEqual(c.weight + 0.05);
      }
    }
  });

  it("does not mutate its input and carries identity/badges through unchanged", () => {
    const before = JSON.parse(JSON.stringify(A));
    const view = reweigh([A, B, C], COMPONENTS, w({ attendance: 50 }));
    expect(A).toEqual(before);
    const a = view.entries.find((e) => e.pspId === 1)!;
    expect(a.name).toBe("Adamová");
    expect(a.effortHasDossier).toBe(false);
  });

  it("an all-zero lens scores everyone 0,0 at shared rank 1 — disclosed, never faked", () => {
    const zero = w({ participation: 0, committee: 0, legislative: 0, speech: 0, attendance: 0, leadership: 0 });
    const view = reweigh([A, B, C], COMPONENTS, zero);
    expect(view.entries.every((e) => e.score === 0 && e.rank === 1)).toBe(true);
    expect(view.totalRaw).toBe(0);
  });

  it("reports effective weights on the components it returns", () => {
    const doubled = Object.fromEntries(
      LENS_COMPONENT_ORDER.map((k) => [k, PUBLISHED_WEIGHTS[k] * 2]),
    ) as WeightVector;
    const view = reweigh([A, B, C], COMPONENTS, doubled);
    for (const c of view.components) expect(c.weight).toBe(PUBLISHED_WEIGHTS[c.key]);
  });
});

// ── souhrn + histogram ──────────────────────────────────────────────────────

describe("summarizeScores / histogramOf — mirror the loader's rules", () => {
  it("computes avg, median and sigma to one decimal", () => {
    const s = summarizeScores([10, 20, 60]);
    expect(s).toEqual({ avg: 30, median: 20, sigma: expect.any(Number), count: 3 });
    expect(s.sigma).toBeCloseTo(21.6, 1);
  });

  it("handles the empty list without NaN", () => {
    expect(summarizeScores([])).toEqual({ avg: 0, median: 0, sigma: 0, count: 0 });
    expect(histogramOf([])).toEqual([]);
  });

  it("bands are [from, from+5) and every score lands inside its printed band", () => {
    const scores = [64.9, 65, 69.9, 70, 100];
    const bands = histogramOf(scores);
    expect(bands.reduce((s, b) => s + b.count, 0)).toBe(scores.length);
    for (const s of scores) {
      const band = bands.find((b) => s >= b.from && s < b.from + 5);
      expect(band, `score ${s} must fall inside a band`).toBeDefined();
    }
    // maximum, které samo je násobkem 5, má vlastní pásmo (ostrá horní mez)
    expect(bands.at(-1)).toEqual({ from: 100, label: "100–105", count: 1 });
  });
});
