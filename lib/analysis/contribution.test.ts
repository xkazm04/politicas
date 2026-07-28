import { describe, expect, it } from "vitest";

import {
  absenteeManagerSignal,
  computeContribution,
  type ContributionInputs,
} from "@/lib/analysis/contribution";

const base: ContributionInputs = {
  personPspId: 100,
  seats: [],
  ballotsWithPosition: 0,
  rollCallsHeld: 0,
  excusedDays: 0,
  sessionDays: 100,
};

describe("computeContribution", () => {
  it("counts only committee/commission seats, not club or chamber membership", () => {
    const p = computeContribution({
      ...base,
      seats: [
        { organPspId: 1, organType: "Výbor", functionType: null },
        { organPspId: 2, organType: "Komise", functionType: null },
        { organPspId: 3, organType: "Klub", functionType: "Předseda" }, // club role → NOT committee work
        { organPspId: 4, organType: "Parlament", functionType: null }, // chamber → ignored
      ],
    });
    expect(p.committeeCount).toBe(2);
    expect(p.leadershipCount).toBe(0); // the leadership was in a Klub, not a committee
  });

  it("rewards committee leadership and saturates breadth at 3", () => {
    const p = computeContribution({
      ...base,
      seats: [
        { organPspId: 1, organType: "Výbor", functionType: "Předseda" },
        { organPspId: 2, organType: "Výbor", functionType: null },
        { organPspId: 3, organType: "Komise", functionType: null },
        { organPspId: 4, organType: "Delegace", functionType: null }, // 4th — breadth already saturated
      ],
    });
    expect(p.committeeCount).toBe(4);
    expect(p.leadershipCount).toBe(1);
    expect(p.components.committee).toBe(20); // saturated (>=3) at the committee weight
    expect(p.components.leadership).toBe(10);
  });

  // The 2026-07-29 correction. psp.cz files a body an MP LEADS as two membership rows —
  // a `member` row and a `function` row on the SAME organ (251 of 1 062 PSP10 pairs) — so
  // counting rows let a filing convention decide a rank. Measured against the real store:
  // 121/207 MPs held at least one such body, and deduping removed 220,5 index points from
  // 33 MPs, dropping the saturated population 158 → 131.
  describe("committee breadth counts BODIES, not psp.cz membership rows", () => {
    it("counts a led body once, and still pays the leadership weight for it", () => {
      const p = computeContribution({
        ...base,
        seats: [
          { organPspId: 10, organType: "Výbor", functionType: null }, // the `member` row
          { organPspId: 10, organType: "Výbor", functionType: "Předseda" }, // the `function` row
          { organPspId: 20, organType: "Komise", functionType: null },
        ],
      });
      expect(p.committeeCount).toBe(2); // two bodies, three rows
      expect(p.leadershipCount).toBe(1);
      expect(p.components.committee).toBe(13.3); // (2/3) × 20 — no longer saturated by a duplicate
      expect(p.components.leadership).toBe(10); // the chair is still worth its full weight
    });

    it("a chair of one committee no longer outranks a member of two", () => {
      const chairOfOne = computeContribution({
        ...base,
        seats: [
          { organPspId: 10, organType: "Výbor", functionType: null },
          { organPspId: 10, organType: "Výbor", functionType: "Předseda" },
        ],
      });
      const memberOfTwo = computeContribution({
        ...base,
        seats: [
          { organPspId: 10, organType: "Výbor", functionType: null },
          { organPspId: 20, organType: "Výbor", functionType: null },
        ],
      });
      expect(chairOfOne.committeeCount).toBe(1);
      expect(memberOfTwo.committeeCount).toBe(2);
      expect(memberOfTwo.components.committee).toBeGreaterThan(chairOfOne.components.committee);
      // …and the chair still scores higher overall, because leadership is its own component.
      expect(chairOfOne.contributionScore).toBeGreaterThan(memberOfTwo.contributionScore);
    });

    it("a row whose organ is unidentified is counted on its own, never merged on a guess", () => {
      const p = computeContribution({
        ...base,
        seats: [
          { organPspId: null, organType: "Výbor", functionType: null },
          { organPspId: null, organType: "Výbor", functionType: null },
          { organType: "Komise", functionType: null }, // organ id absent entirely
        ],
      });
      expect(p.committeeCount).toBe(3);
    });
  });

  it("publishes the rates at the precision the composite is computed from", () => {
    // The leaderboard re-derives participation/attendance POINTS from these stored rates,
    // so a 1-decimal rate made the published parts disagree with the published whole by up
    // to 1,6 points across 197/207 MPs.
    const p = computeContribution({ ...base, ballotsWithPosition: 938, rollCallsHeld: 1000, excusedDays: 5, sessionDays: 63 });
    expect(p.participationRate).toBe(0.938);
    expect(p.absenceRate).toBe(0.079);
  });

  it("scores voting participation and attendance", () => {
    const p = computeContribution({ ...base, ballotsWithPosition: 900, rollCallsHeld: 1000, excusedDays: 10, sessionDays: 100 });
    expect(p.participationRate).toBe(0.9);
    expect(p.components.participation).toBe(22.5); // 0.9 * 25
    expect(p.absenceRate).toBe(0.1);
    expect(p.components.attendance).toBe(9); // (1 - 0.1) * 10
  });

  it("scores legislative output (bills + interpellations) and floor presence (speeches)", () => {
    const p = computeContribution({ ...base, billsAuthored: 2, interpellations: 2, speechTurns: 40 });
    expect(p.components.legislative).toBe(20); // (2+2)/4 saturates → full 20
    expect(p.components.speech).toBe(15); // 40/40 saturates → full 15
    const half = computeContribution({ ...base, billsAuthored: 1, interpellations: 0, speechTurns: 10 });
    expect(half.components.legislative).toBe(5); // (1/4) * 20
    expect(half.components.speech).toBe(3.8); // (10/40) * 15 = 3.75, round1 → 3.8
  });

  it("a full contributor approaches 100, an absentee approaches 0", () => {
    const contributor = computeContribution({
      personPspId: 1,
      seats: [
        { organPspId: 1, organType: "Výbor", functionType: "Předseda" },
        { organPspId: 2, organType: "Komise", functionType: null },
        { organPspId: 3, organType: "Výbor", functionType: null },
      ],
      ballotsWithPosition: 980,
      rollCallsHeld: 1000,
      excusedDays: 2,
      sessionDays: 100,
      billsAuthored: 3,
      interpellations: 2,
      speechTurns: 60,
    });
    expect(contributor.contributionScore).toBeGreaterThan(95);

    const absentee = computeContribution({ ...base, ballotsWithPosition: 100, rollCallsHeld: 1000, excusedDays: 60, sessionDays: 100 });
    expect(absentee.contributionScore).toBeLessThan(15);
  });
});

describe("absenteeManagerSignal — the Case ② × ① crossover", () => {
  const lowContribution = computeContribution({ ...base, personPspId: 6150, ballotsWithPosition: 100, rollCallsHeld: 1000, excusedDays: 40, sessionDays: 100 });
  const highContribution = computeContribution({
    ...base,
    personPspId: 7,
    seats: [{ organPspId: 1, organType: "Výbor", functionType: "Předseda" }, { organPspId: 2, organType: "Komise", functionType: null }, { organPspId: 3, organType: "Výbor", functionType: null }],
    ballotsWithPosition: 950,
    rollCallsHeld: 1000,
    excusedDays: 3,
    sessionDays: 100,
    billsAuthored: 4,
    speechTurns: 50,
  });

  it("flags high-money + low-contribution as an absentee-manager lead", () => {
    const s = absenteeManagerSignal(lowContribution, { linkedCompanies: 15, contractCzk: 1_238_000_000 });
    expect(lowContribution.contributionScore).toBeLessThan(40);
    expect(s.isAbsenteeManagerLead).toBe(true);
  });
  it("does NOT flag a hard worker even with money ties", () => {
    expect(highContribution.contributionScore).toBeGreaterThan(40);
    const s = absenteeManagerSignal(highContribution, { linkedCompanies: 5, contractCzk: 500_000_000 });
    expect(s.isAbsenteeManagerLead).toBe(false);
  });
  it("does NOT flag an absentee with no money ties (that's just low effort, not the crossover)", () => {
    const s = absenteeManagerSignal(lowContribution, { linkedCompanies: 0, contractCzk: 0 });
    expect(s.isAbsenteeManagerLead).toBe(false);
  });
});
