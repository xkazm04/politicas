import { describe, expect, it } from "vitest";

import { deriveForensicIndex, type ForensicIndexBill } from "./forensicIndex";

function bill(over: Partial<ForensicIndexBill> = {}): ForensicIndexBill {
  return {
    cislo: 1,
    tiskId: 1000,
    forensic: {
      severity: "low",
      confidence: 3,
      reviewState: "pending_review",
      withheldFields: 0,
      pass: 55,
      provenanceRef: "law-forensics",
      computedAt: "2026-08-05T11:22:33.000Z",
    },
    ...over,
  };
}

const f = (over: Partial<NonNullable<ForensicIndexBill["forensic"]>> = {}) => ({
  severity: "low",
  confidence: 3,
  reviewState: "pending_review",
  withheldFields: 0,
  pass: 55,
  provenanceRef: "law-forensics",
  computedAt: "2026-08-05T11:22:33.000Z",
  ...over,
});

describe("deriveForensicIndex", () => {
  it("counts the census against the whole corpus, not against the verdicts", () => {
    const view = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1 }),
      bill({ cislo: 2, tiskId: 2 }),
      bill({ cislo: 3, tiskId: 3, forensic: null }),
    ]);
    expect(view.totalBills).toBe(3);
    expect(view.verdictCount).toBe(2);
    expect(view.complete).toBe(false);
  });

  it("calls the census complete only when every bill carries a verdict", () => {
    const complete = deriveForensicIndex([bill({ cislo: 1, tiskId: 1 }), bill({ cislo: 2, tiskId: 2 })]);
    expect(complete.complete).toBe(true);
    // An empty corpus is not a complete one — 0 of 0 must never read as „census closed".
    expect(deriveForensicIndex([]).complete).toBe(false);
    expect(deriveForensicIndex([]).verdictCount).toBe(0);
  });

  it("groups by the stored severity token, ordered by count desc then token asc", () => {
    const view = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1, forensic: f({ severity: "high" }) }),
      bill({ cislo: 2, tiskId: 2, forensic: f({ severity: "medium" }) }),
      bill({ cislo: 3, tiskId: 3, forensic: f({ severity: "medium" }) }),
      bill({ cislo: 4, tiskId: 4, forensic: f({ severity: "low" }) }),
    ]);
    expect(view.groups.map((g) => [g.severity, g.count])).toEqual([
      ["medium", 2],
      ["high", 1],
      ["low", 1],
    ]);
  });

  it("orders bills inside a group by print number, never by severity or salience", () => {
    const view = deriveForensicIndex([
      bill({ cislo: 200, tiskId: 9 }),
      bill({ cislo: 7, tiskId: 8 }),
      bill({ cislo: 42, tiskId: 7 }),
    ]);
    expect(view.groups[0].entries.map((e) => e.cislo)).toEqual([7, 42, 200]);
  });

  it("puts a verdict on a bill with no print number last and counts it as unlinkable", () => {
    const view = deriveForensicIndex([
      bill({ cislo: null, tiskId: 4321 }),
      bill({ cislo: 9, tiskId: 1 }),
    ]);
    expect(view.groups[0].entries.map((e) => e.cislo)).toEqual([9, null]);
    expect(view.unlinkableCount).toBe(1);
  });

  it("carries an out-of-vocabulary severity verbatim and marks it unlabelled", () => {
    const view = deriveForensicIndex([bill({ forensic: f({ severity: "critical" }) })]);
    expect(view.groups[0].severity).toBe("critical");
    expect(view.groups[0].known).toBe(false);
    expect(view.groups[0].entries[0].severity).toBe("critical");
    expect(view.groups[0].entries[0].severityKnown).toBe(false);
  });

  it("keeps the known-severity flag true for the catalog vocabulary", () => {
    for (const severity of ["low", "medium", "high"]) {
      expect(deriveForensicIndex([bill({ forensic: f({ severity }) })]).groups[0].known, severity).toBe(true);
    }
  });

  it("counts withheld verdicts AND withheld strings — a withhold is not an absence", () => {
    const view = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1, forensic: f({ withheldFields: 3 }) }),
      bill({ cislo: 2, tiskId: 2, forensic: f({ withheldFields: 1 }) }),
      bill({ cislo: 3, tiskId: 3, forensic: f({ withheldFields: 0 }) }),
    ]);
    expect(view.withheldVerdictCount).toBe(2);
    expect(view.withheldFieldCount).toBe(4);
  });

  it("counts review states verbatim, ordered by count desc then token asc", () => {
    const view = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1, forensic: f({ reviewState: "pending_review" }) }),
      bill({ cislo: 2, tiskId: 2, forensic: f({ reviewState: "pending_review" }) }),
      bill({ cislo: 3, tiskId: 3, forensic: f({ reviewState: "published" }) }),
    ]);
    expect(view.reviewStates).toEqual([
      { state: "pending_review", count: 2 },
      { state: "published", count: 1 },
    ]);
  });

  it("reports one pass only when every verdict agrees on it", () => {
    const uniform = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1, forensic: f({ pass: 55 }) }),
      bill({ cislo: 2, tiskId: 2, forensic: f({ pass: 55 }) }),
    ]);
    expect(uniform.passes).toEqual([55]);
    expect(uniform.uniformPass).toBe(55);

    const mixed = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1, forensic: f({ pass: 55 }) }),
      bill({ cislo: 2, tiskId: 2, forensic: f({ pass: 47 }) }),
    ]);
    expect(mixed.passes).toEqual([47, 55]);
    expect(mixed.uniformPass).toBeNull();

    // One verdict with no provenance at all is NOT a uniform corpus either.
    const partial = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1, forensic: f({ pass: 55 }) }),
      bill({ cislo: 2, tiskId: 2, forensic: f({ pass: null }) }),
    ]);
    expect(partial.uniformPass).toBeNull();
  });

  it("reports one formula ref and one computed instant only when every verdict agrees", () => {
    // Základ citace censu (lawClaims.forensicCensusDerivation) stojí na téhle
    // dvojici. Kdyby ji stačilo nést půlce korpusu, brána by u nezměněného čísla
    // hlásila `moved/basis` — nebo naopak potvrdila shodu dvou různých výpočtů.
    const uniform = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1 }),
      bill({ cislo: 2, tiskId: 2 }),
    ]);
    expect(uniform.uniformRef).toBe("law-forensics");
    expect(uniform.uniformComputedAt).toBe("2026-08-05T11:22:33.000Z");

    const mixedRef = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1 }),
      bill({ cislo: 2, tiskId: 2, forensic: f({ provenanceRef: "law-forensics-v2" }) }),
    ]);
    expect(mixedRef.uniformRef).toBeNull();
    expect(mixedRef.uniformComputedAt).toBe("2026-08-05T11:22:33.000Z");

    const missing = deriveForensicIndex([
      bill({ cislo: 1, tiskId: 1 }),
      bill({ cislo: 2, tiskId: 2, forensic: f({ provenanceRef: null, computedAt: null }) }),
    ]);
    expect(missing.uniformRef).toBeNull();
    expect(missing.uniformComputedAt).toBeNull();
  });

  it("is empty and honest over a corpus with no verdicts", () => {
    const view = deriveForensicIndex([bill({ forensic: null }), bill({ cislo: 2, tiskId: 2, forensic: null })]);
    expect(view.verdictCount).toBe(0);
    expect(view.groups).toEqual([]);
    expect(view.reviewStates).toEqual([]);
    expect(view.passes).toEqual([]);
    expect(view.uniformPass).toBeNull();
    expect(view.uniformRef).toBeNull();
    expect(view.uniformComputedAt).toBeNull();
    expect(view.complete).toBe(false);
  });

  it("does not mutate the input order", () => {
    const bills = [bill({ cislo: 9, tiskId: 9 }), bill({ cislo: 1, tiskId: 1 })];
    deriveForensicIndex(bills);
    expect(bills.map((b) => b.cislo)).toEqual([9, 1]);
  });
});
