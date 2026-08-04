import { describe, expect, it } from "vitest";

import { median } from "@/lib/analysis/score-legibility";
import { DUEL_FACT_DEFS, duelFactRows, factWinner } from "./duelFacts";
import type { ComponentKey, DuelFacts, LeaderboardListEntry } from "./getLeaderboardData";

const ZERO: Record<ComponentKey, number> = {
  participation: 0,
  committee: 0,
  legislative: 0,
  speech: 0,
  attendance: 0,
  leadership: 0,
};

function mk(name: string, pspId: number, facts: Partial<DuelFacts>): LeaderboardListEntry {
  return {
    pspId,
    rank: 1,
    name,
    clubAbbrev: "X",
    clubName: "X",
    clubColor: "steel", // fixture — nikdy se nekreslí
    region: null,
    score: 50,
    tiedCount: 1,
    components: ZERO,
    effortWorkhorse: false,
    effortWorkhorseFlavour: null,
    effortRapporteurLoad: 0,
    effortHasDossier: false,
    effortLowScoreReason: null,
    effortLowScoreRecordedAt: null,
    duelFacts: {
      speechTurns: null,
      amendmentsAuthored: null,
      interpellations: null,
      rapporteurLoad: null,
      tenureClass: null,
      ...facts,
    },
  };
}

describe("factWinner", () => {
  it("marks the higher side, and neither on a tie", () => {
    expect(factWinner(10, 3)).toBe("a");
    expect(factWinner(3, 10)).toBe("b");
    expect(factWinner(7, 7)).toBeNull();
  });

  it("never lets a MISSING value lose — 'we don't know' is not worse performance", () => {
    expect(factWinner(null, 12)).toBeNull();
    expect(factWinner(12, null)).toBeNull();
    expect(factWinner(null, null)).toBeNull();
  });

  it("does not treat a real zero as missing — 0 loses to 1, honestly", () => {
    expect(factWinner(0, 1)).toBe("b");
    expect(factWinner(0, 0)).toBeNull();
  });
});

describe("duelFactRows", () => {
  const chamber = [
    mk("A", 1, { speechTurns: 100, amendmentsAuthored: 4, interpellations: 2, rapporteurLoad: 5 }),
    mk("B", 2, { speechTurns: 10, amendmentsAuthored: 0, interpellations: 0, rapporteurLoad: 0 }),
    mk("C", 3, { speechTurns: 20, amendmentsAuthored: 1, interpellations: 0, rapporteurLoad: 0 }),
    mk("D", 4, { speechTurns: 30, amendmentsAuthored: 2, interpellations: 1, rapporteurLoad: 1 }),
    // No data at all — must be excluded from every median, not counted as a zero.
    mk("E", 5, {}),
  ];

  it("reports every fact in its own unit against the REAL chamber median", () => {
    const rows = duelFactRows(chamber[0], chamber[1], chamber);
    expect(rows.map((r) => r.def.key)).toEqual(DUEL_FACT_DEFS.map((d) => d.key));
    const speech = rows.find((r) => r.def.key === "speechTurns")!;
    expect(speech.a).toBe(100);
    expect(speech.b).toBe(10);
    expect(speech.chamberMedian).toBe(25); // median of 10, 20, 30, 100 — E excluded
    expect(speech.chamberN).toBe(4);
    expect(speech.winner).toBe("a");
    expect(speech.def.unit).toBe("vystoupení");
    expect(speech.def.source).toContain("psp.cz");
  });

  it("uses score-legibility's median — one definition, not a second one", () => {
    const rows = duelFactRows(chamber[0], chamber[1], chamber);
    for (const r of rows) {
      const values = chamber
        .map((e) => e.duelFacts[r.def.key])
        .filter((v): v is number => typeof v === "number");
      expect(r.chamberMedian, r.def.key).toBe(median(values));
    }
  });

  it("an MP whose facts the graph does not carry renders MISSING, never zero", () => {
    const rows = duelFactRows(chamber[4], chamber[0], chamber);
    for (const r of rows) {
      expect(r.a, r.def.key).toBeNull();
      expect(r.winner, r.def.key).toBeNull(); // nothing is won against a blank
    }
  });

  it("the chamber median ignores the MPs without a value (and says how many it used)", () => {
    const rows = duelFactRows(chamber[0], chamber[1], chamber);
    for (const r of rows) expect(r.chamberN).toBe(4);
    const blankChamber = [mk("X", 9, {}), mk("Y", 10, {})];
    for (const r of duelFactRows(blankChamber[0], blankChamber[1], blankChamber)) {
      expect(r.chamberMedian).toBeNull(); // no median is honest; 0 would not be
      expect(r.chamberN).toBe(0);
    }
  });

  it("compares COUNTS, not the six derived component points", () => {
    // Every fighter above carries an all-zero component vector; the rows still differ,
    // because the duel now reads facts rather than weighted points.
    const rows = duelFactRows(chamber[0], chamber[2], chamber);
    expect(rows.some((r) => r.winner !== null)).toBe(true);
  });
});
