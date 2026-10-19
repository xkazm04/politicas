import { describe, expect, it } from "vitest";
import { computeContribution } from "./contribution";
import { mandateDenominators, type MandateWindow } from "./mandate-window";

// Seven roll calls over four sitting days; id 99 is voided/manual and never in the map.
const rollCalls = new Map<number, string>([
  [1, "2025-11-03"],
  [2, "2025-11-03"],
  [7, "2026-03-12"], // after LATE's mandate arose, before its oath
  [3, "2026-03-24"],
  [4, "2026-03-24"],
  [5, "2026-06-18"],
  [6, "2026-06-18"],
]);
const rows = (mandate: number, votes: number[]) => votes.map((v) => ({ mandatePspId: mandate, votePspId: v }));

const FULL = 10; // seated election day, still serving
const LATE = 20; // mandate arose 2026-03-11, oath (first ballot row) 2026-03-24
const LEFT = 30; // seated election day, left 2026-03-24
const NONE = 40; // in the windows, no ballot rows at all

const windows = new Map<number, MandateWindow>([
  [FULL, { from: "2025-10-04", to: null }],
  [LATE, { from: "2026-03-11", to: null }],
  [LEFT, { from: "2025-10-04", to: "2026-03-24" }],
  [NONE, { from: "2025-10-04", to: "2025-11-03" }],
]);
const excusedDays = new Map<number, Set<string>>([
  [FULL, new Set(["2025-11-03", "2025-12-01"])], // an excuse on a day with no roll call still counts, as today
  [LEFT, new Set(["2025-11-03", "2026-06-18"])], // the June excuse post-dates the mandate
]);
const ballots = [...rows(FULL, [1, 2, 7, 3, 4, 5, 6, 99]), ...rows(LATE, [3, 4, 5, 6]), ...rows(LEFT, [1, 2, 7, 3, 4])];

const d = mandateDenominators({ rollCalls, ballots, windows, excusedDays });

describe("mandateDenominators", () => {
  it("gives a full-term mandate exactly the term-level denominators (the floor)", () => {
    const termSessionDays = new Set(rollCalls.values()).size;
    expect(d.get(FULL)).toEqual({ rollCalls: rollCalls.size, sessionDays: termSessionDays, excusedDays: 2 });
  });

  it("counts the publisher's ballot rows, not the days since the mandate arose", () => {
    // A date window from 2026-03-11 would count 5: roll call 7 falls after the mandate
    // arose and before the oath, and the publisher wrote no row for it.
    expect(d.get(LATE)).toEqual({ rollCalls: 4, sessionDays: 2, excusedDays: 0 });
  });

  it("bounds a departed mandate's excuses by its window", () => {
    expect(d.get(LEFT)).toEqual({ rollCalls: 5, sessionDays: 3, excusedDays: 1 });
  });

  it("leaves a mandate with no ballot rows absent rather than zero", () => {
    expect(d.has(NONE)).toBe(false);
  });

  it("moves a short mandate's rates in opposite directions once fed to the scorer", () => {
    const seats: never[] = [];
    // LEFT was present at all 5 of its roll calls and excused 1 of its 3 sitting days.
    const term = computeContribution({ personPspId: LEFT, seats, ballotsWithPosition: 5, rollCallsHeld: 7, excusedDays: 1, sessionDays: 4 });
    const own = d.get(LEFT)!;
    const window = computeContribution({ personPspId: LEFT, seats, ballotsWithPosition: 5, rollCallsHeld: own.rollCalls, excusedDays: own.excusedDays, sessionDays: own.sessionDays });
    expect(window.participationRate).toBeGreaterThan(term.participationRate); // depressed under the term count
    expect(window.absenceRate).toBeGreaterThan(term.absenceRate); // flattered under the term count
  });
});
