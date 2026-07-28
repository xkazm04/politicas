import { describe, expect, it } from "vitest";
import {
  COMPONENT_CAP,
  componentValue,
  computeScoreLegibility,
  median,
  type ComponentKey,
  type LegibilityInput,
} from "./score-legibility";
import { CONTRIBUTION_WEIGHTS } from "./contribution";

const KEYS: ComponentKey[] = [
  "participation",
  "committee",
  "legislative",
  "speech",
  "attendance",
  "leadership",
];

/** A fully-populated MP: every input the scorer reads is present on the node. */
const full = {
  participation_rate: 0.9,
  absence_rate: 0.1,
  committee_count: 2,
  leadership_count: 0,
  bills_authored: 1,
  interpellations: 0,
  speech_turns: 10,
};

describe("componentValue", () => {
  it("reads each component in its own unit, attendance inverted from the stored absence rate", () => {
    expect(componentValue("participation", full)).toBe(0.9);
    expect(componentValue("committee", full)).toBe(2);
    expect(componentValue("legislative", full)).toBe(1); // bills + interpellations
    expect(componentValue("speech", full)).toBe(10);
    expect(componentValue("attendance", full)).toBe(0.9); // 1 − absence
    expect(componentValue("leadership", full)).toBe(0);
  });

  it("MISSING IS NOT ZERO — an absent input reads null, never 0", () => {
    expect(componentValue("speech", {})).toBeNull();
    expect(componentValue("committee", { committee_count: "3" })).toBeNull(); // wrong type
    expect(componentValue("participation", { participation_rate: Number.NaN })).toBeNull();
    // a real 0 is still a 0 — the distinction is the whole point
    expect(componentValue("speech", { speech_turns: 0 })).toBe(0);
  });

  it("a half-present legislative input reads missing, not a smaller true number", () => {
    expect(componentValue("legislative", { bills_authored: 3 })).toBeNull();
    expect(componentValue("legislative", { interpellations: 2 })).toBeNull();
    expect(componentValue("legislative", { bills_authored: 3, interpellations: 2 })).toBe(5);
  });
});

describe("median", () => {
  it("is the real median of the values present, and null when there are none", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("computeScoreLegibility", () => {
  // A four-MP chamber with fixed scores. Self is rank 3 on 70.
  const chamber = [
    { score: 92, props: full },
    { score: 80, props: { ...full, committee_count: 4, speech_turns: 40 } },
    { score: 70, props: { ...full, committee_count: 1, speech_turns: 8 } },
    { score: 41, props: { ...full, committee_count: 0, speech_turns: 2 } },
  ];
  const input: LegibilityInput = {
    self: {
      rank: 3,
      score: 70,
      props: { ...full, committee_count: 1, speech_turns: 8 },
      points: { participation: 22.5, committee: 6.7, legislative: 5, speech: 3, attendance: 9, leadership: 0 },
    },
    chamber,
    next: { name: "Adamec Alois", score: 80 },
    keys: KEYS,
  };
  const out = computeScoreLegibility(input);
  const by = (k: ComponentKey) => out.components.find((c) => c.key === k)!;

  it("states the real gap to the ranked neighbour above", () => {
    expect(out.gapToNext).toBe(10);
    expect(out.nextName).toBe("Adamec Alois");
    expect(out.total).toBe(4);
  });

  it("has no gap at rank 1", () => {
    const top = computeScoreLegibility({ ...input, self: { ...input.self, rank: 1, score: 92 }, next: null });
    expect(top.gapToNext).toBeNull();
    expect(top.nextName).toBeNull();
  });

  it("reports headroom in the component's own unit and the cap the scorer uses", () => {
    const c = by("committee");
    expect(c.value).toBe(1);
    expect(c.cap).toBe(COMPONENT_CAP.committee); // 3
    expect(c.headroomUnits).toBe(2); // two more committees to saturation
    expect(c.headroomPoints).toBe(13.3); // (2/3) × 20
    expect(c.chamberMedian).toBe(1.5); // median of 2, 4, 1, 0
  });

  it("rankAtCap COUNTS real scores above the projection — no interpolation", () => {
    // 70 + 13.3 = 83.3 → only the 92 sits above it → rank 2.
    expect(by("committee").rankAtCap).toBe(2);
    // speech: 8 → 40 is +12 points → 82 → still only 92 above → rank 2.
    expect(by("speech").headroomPoints).toBe(12);
    expect(by("speech").rankAtCap).toBe(2);
  });

  it("treats leadership as the step it is — all of the weight or none of it", () => {
    const none = by("leadership");
    expect(none.value).toBe(0);
    expect(none.headroomPoints).toBe(CONTRIBUTION_WEIGHTS.leadership); // the whole 10
    const held = computeScoreLegibility({
      ...input,
      self: { ...input.self, props: { ...input.self.props, leadership_count: 1 } },
    });
    expect(held.components.find((c) => c.key === "leadership")!.headroomPoints).toBe(0);
  });

  it("a saturated component offers no projection rather than a zero-point one", () => {
    const sat = computeScoreLegibility({
      ...input,
      self: { ...input.self, props: { ...input.self.props, committee_count: 9 } },
    });
    const c = sat.components.find((x) => x.key === "committee")!;
    expect(c.headroomUnits).toBe(0);
    expect(c.headroomPoints).toBe(0);
    expect(c.rankAtCap).toBeNull();
  });

  it("a missing input yields nulls everywhere, never a zero standing", () => {
    const gap = computeScoreLegibility({
      ...input,
      self: { ...input.self, props: { ...input.self.props, speech_turns: undefined } },
    });
    const c = gap.components.find((x) => x.key === "speech")!;
    expect(c.value).toBeNull();
    expect(c.headroomUnits).toBeNull();
    expect(c.headroomPoints).toBeNull();
    expect(c.rankAtCap).toBeNull();
    // the chamber median still comes from the MPs that DO have the input
    expect(c.chamberMedian).toBe(9); // median of 10, 40, 8, 2
  });

  it("is deterministic — same input, same output", () => {
    expect(computeScoreLegibility(input)).toEqual(computeScoreLegibility(input));
  });
});
