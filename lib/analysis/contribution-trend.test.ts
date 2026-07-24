import { describe, expect, it } from "vitest";
import { computeTrend, type CurrentContribution } from "./contribution-trend";

const current: CurrentContribution = {
  score: 40,
  components: { participation: 10, committee: 10, legislative: 5, speech: 5, attendance: 8, leadership: 0 },
  billsAuthored: 1,
  interpellations: 0,
  speechTurns: 4,
  committeeCount: 2,
  leadershipCount: 0,
};

describe("computeTrend", () => {
  it("returns null when there is no prior-term prop (single-term fallback)", () => {
    expect(computeTrend(current, undefined)).toBeNull();
    expect(computeTrend(current, null)).toBeNull();
    expect(computeTrend(current, {})).toBeNull(); // no usable components
  });

  it("computes vote-independent deltas for a PARTIAL prior term and leaves score delta null", () => {
    const psp9 = {
      term: "PSP9",
      complete: false,
      missing: ["participation", "attendance"],
      billsAuthored: 9,
      interpellations: 2,
      speechTurns: 300,
      committeeCount: 3,
      leadershipCount: 1,
      participationRate: null,
      absenceRate: null,
      score: null,
      components: { committee: 20, leadership: 10, legislative: 20, speech: 15, participation: null, attendance: null },
      provenance: { track: "effort", pass: 13, method: "deterministic", ref: "contribution-psp9" },
    };
    const t = computeTrend(current, psp9)!;
    expect(t).not.toBeNull();
    expect(t.complete).toBe(false);
    expect(t.scoreDelta).toBeNull();
    expect(t.priorScore).toBeNull();
    expect(t.pendingComponents).toEqual(expect.arrayContaining(["participation", "attendance"]));
    const committee = t.components.find((c) => c.key === "committee")!;
    expect(committee.delta).toBe(-10);
    const participation = t.components.find((c) => c.key === "participation")!;
    expect(participation.delta).toBeNull();
    expect(t.counts.speechTurns).toEqual({ prior: 300, current: 4 });
    expect(t.provenance?.pass).toBe(13);
  });

  it("computes a full score delta when the prior term is complete", () => {
    const psp9 = {
      term: "PSP9",
      complete: true,
      missing: [],
      billsAuthored: 5,
      interpellations: 1,
      speechTurns: 100,
      committeeCount: 2,
      leadershipCount: 0,
      participationRate: 0.8,
      absenceRate: 0.2,
      score: 55,
      components: { committee: 13.3, leadership: 0, legislative: 15, speech: 12, participation: 20, attendance: 8 },
      provenance: { track: "effort", pass: 14, method: "deterministic", ref: "contribution-psp9" },
    };
    const t = computeTrend(current, psp9)!;
    expect(t.complete).toBe(true);
    expect(t.priorScore).toBe(55);
    expect(t.scoreDelta).toBe(-15);
    expect(t.pendingComponents).toEqual([]);
  });
});
