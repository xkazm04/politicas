import { describe, expect, it } from "vitest";

import { computeContribution, type CommitteeSeat } from "@/lib/analysis/contribution";
import { legacyScore } from "@/lib/analysis/contribution-legacy";

/** A body an MP LEADS, as psp.cz files it: a member row AND a function row, one organ. */
const ledBody = (organPspId: number): CommitteeSeat[] => [
  { organPspId, organType: "Výbor", functionType: null },
  { organPspId, organType: "Výbor", functionType: "předseda" },
];
const plainSeat = (organPspId: number): CommitteeSeat => ({ organPspId, organType: "Výbor", functionType: null });

describe("legacyScore — the frozen pre-correction formula", () => {
  it("counts membership ROWS where the current formula counts BODIES — the whole 2026-07-29 correction", () => {
    // ONE committee, chaired: two psp.cz rows.
    const seats = ledBody(101);
    const legacy = legacyScore({ seats, participationRate: 0, absenceRate: 1, bills: 0, interpellations: 0, speechTurns: 0 });
    const current = computeContribution({
      personPspId: 1, seats, ballotsWithPosition: 0, rollCallsHeld: 0, excusedDays: 100, sessionDays: 100,
    });
    expect(legacy.committeeRows).toBe(2);
    expect(current.committeeCount).toBe(1);
    // 2/3 of the committee term vs 1/3 — a filing convention worth 6,7 index points.
    expect(legacy.score).toBe(23.3);
    expect(current.contributionScore).toBe(16.7);
  });

  it("a chaired single committee used to outrank two plain seats; it no longer does", () => {
    const chair = ledBody(101);
    const twoSeats = [plainSeat(201), plainSeat(202)];
    const base = { participationRate: 0, absenceRate: 1, bills: 0, interpellations: 0, speechTurns: 0 };
    expect(legacyScore({ ...base, seats: chair }).committeeRows).toBe(
      legacyScore({ ...base, seats: twoSeats }).committeeRows,
    );
    const cur = (seats: CommitteeSeat[]) =>
      computeContribution({ personPspId: 1, seats, ballotsWithPosition: 0, rollCallsHeld: 0, excusedDays: 100, sessionDays: 100 })
        .committeeCount;
    expect(cur(chair)).toBe(1);
    expect(cur(twoSeats)).toBe(2);
  });

  it("publishes its rates at ONE decimal — the pass-11 rounding the correction replaced", () => {
    const r = legacyScore({ seats: [], participationRate: 0.938, absenceRate: 0.0123, bills: 0, interpellations: 0, speechTurns: 0 });
    expect(r.participationRate).toBe(0.9);
    expect(r.absenceRate).toBe(0);
    // The SCORE is computed from the raw ratio, not the published one — which is exactly
    // why a store's published parts could sit 1,6 points from its published whole.
    expect(r.score).toBe(33.3); // 0.938×25 + (1−0.0123)×10
  });

  it("saturation literals are FROZEN at 4 bills+interpellations and 40 speech turns", () => {
    const base = { seats: [], participationRate: 0, absenceRate: 1 };
    expect(legacyScore({ ...base, bills: 4, interpellations: 0, speechTurns: 0 }).score).toBe(20);
    expect(legacyScore({ ...base, bills: 9, interpellations: 9, speechTurns: 0 }).score).toBe(20); // capped
    expect(legacyScore({ ...base, bills: 0, interpellations: 0, speechTurns: 40 }).score).toBe(15);
    expect(legacyScore({ ...base, bills: 0, interpellations: 0, speechTurns: 400 }).score).toBe(15); // capped
  });

  it("ignores non-committee organ types, exactly as the live formula does", () => {
    const seats: CommitteeSeat[] = [
      { organPspId: 1, organType: "Klub", functionType: "předseda" },
      { organPspId: 2, organType: "Podvýbor", functionType: null },
    ];
    const r = legacyScore({ seats, participationRate: 0, absenceRate: 1, bills: 0, interpellations: 0, speechTurns: 0 });
    expect(r.committeeRows).toBe(1);
    expect(r.leadershipRows).toBe(0);
  });

  it("is pure and deterministic — the proof gate must give the same answer every run", () => {
    const input = { seats: ledBody(7), participationRate: 0.5, absenceRate: 0.25, bills: 1, interpellations: 2, speechTurns: 12 };
    expect(legacyScore(input)).toEqual(legacyScore(input));
  });
});
