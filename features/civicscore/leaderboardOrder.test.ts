import { describe, expect, it } from "vitest";
import { compareLeaderboardRow } from "./getLeaderboardData";

/* Probe for `sort-missing-id-tiebreaker` on the leaderboard display order
 * (identity-survives-reuse). Score+name is not a total order: two MPs sharing
 * both would resolve by input position. The pspId tail makes row order
 * reproducible. (Rank is competition-ranked and decoupled from position, so
 * this pins ROW order only.) */

type Row = { score: number; name: string; pspId: number };
const sort = (rows: Row[]) => [...rows].sort(compareLeaderboardRow);

describe("compareLeaderboardRow", () => {
  it("orders by score descending", () => {
    const out = sort([
      { score: 80, name: "B", pspId: 2 },
      { score: 95, name: "A", pspId: 1 },
    ]);
    expect(out.map((r) => r.pspId)).toEqual([1, 2]);
  });

  it("breaks an equal score by Czech name collation", () => {
    const out = sort([
      { score: 90, name: "Žák", pspId: 2 },
      { score: 90, name: "Adam", pspId: 1 },
    ]);
    expect(out.map((r) => r.name)).toEqual(["Adam", "Žák"]);
  });

  it("breaks an equal score AND name by pspId — a total order", () => {
    const forward: Row[] = [
      { score: 95.4, name: "Novák", pspId: 620 },
      { score: 95.4, name: "Novák", pspId: 118 },
    ];
    const reversed = [...forward].reverse();
    expect(sort(forward).map((r) => r.pspId)).toEqual([118, 620]);
    expect(sort(reversed).map((r) => r.pspId)).toEqual([118, 620]);
  });
});
