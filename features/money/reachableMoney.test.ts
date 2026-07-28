// THE definition of reachable public money, pinned. "Dosažitelné veřejné peníze" used to
// mean three different numbers on three surfaces: the ledger de-duplicated per company
// and split steward money out, the console summed per TIE across all classes (so the 14
// companies tied to more than one MP counted twice), and the case file printed three
// uncited tiles that merged both classes above the fold.

import { describe, expect, it } from "vitest";
import { contractCoverage, reachableMoney, type ReachableTie } from "./reachableMoney";

const tie = (over: Partial<ReachableTie> & { companyId: string }): ReachableTie => ({
  tieClass: "owner-operator",
  contractCount: 1,
  contractCzk: 0,
  subsidiesCzk: 0,
  donatedToPartyCzk: null,
  ...over,
});

describe("reachableMoney — one company is counted once", () => {
  it("de-duplicates a company tied to two MPs (14 such companies on the live store)", () => {
    const m = reachableMoney([
      tie({ companyId: "co:1", contractCzk: 10_000_000, contractCount: 4 }),
      tie({ companyId: "co:1", contractCzk: 10_000_000, contractCount: 4 }), // the other MP
    ]);
    expect(m.attributable.contractCzk).toBe(10_000_000);
    expect(m.attributable.contractCount).toBe(4);
    expect(m.attributable.companies).toBe(1);
    expect(m.companies).toBe(1);
    expect(m.totalCzk).toBe(10_000_000);
  });

  it("counts two DIFFERENT companies twice", () => {
    const m = reachableMoney([
      tie({ companyId: "co:1", contractCzk: 1_000_000 }),
      tie({ companyId: "co:2", contractCzk: 2_000_000 }),
    ]);
    expect(m.attributable.contractCzk).toBe(3_000_000);
    expect(m.companies).toBe(2);
  });
});

describe("reachableMoney — the steward split is not optional", () => {
  it("keeps a public body's own contracting out of the attributable figure", () => {
    const m = reachableMoney([
      tie({ companyId: "co:firm", contractCzk: 5_000_000 }),
      tie({ companyId: "co:hospital", tieClass: "steward", contractCzk: 4_000_000_000 }),
    ]);
    expect(m.attributable.contractCzk).toBe(5_000_000);
    expect(m.steward.contractCzk).toBe(4_000_000_000);
    // …and the two still reconcile to the whole reachable surface.
    expect(m.totalCzk).toBe(m.attributable.contractCzk + m.steward.contractCzk);
  });

  it("treats a manager tie as attributable and a steward tie as not", () => {
    const m = reachableMoney([
      tie({ companyId: "co:a", tieClass: "manager", contractCzk: 7 }),
      tie({ companyId: "co:b", tieClass: "steward", contractCzk: 11 }),
    ]);
    expect(m.attributable.contractCzk).toBe(7);
    expect(m.steward.contractCzk).toBe(11);
  });

  it("splits subsidies and party donations by the same rule, never merged", () => {
    const m = reachableMoney([
      tie({ companyId: "co:a", subsidiesCzk: 100, donatedToPartyCzk: 50 }),
      tie({ companyId: "co:b", tieClass: "steward", subsidiesCzk: 900, donatedToPartyCzk: null }),
    ]);
    expect(m.attributable.subsidiesCzk).toBe(100);
    expect(m.attributable.donatedToPartyCzk).toBe(50);
    expect(m.steward.subsidiesCzk).toBe(900);
    expect(m.steward.donatedToPartyCzk).toBe(0);
  });

  it("a company whose ties DISAGREE about the class is attributable, whatever the input order", () => {
    // Two such companies on the live store: PRaK a.s. v likvidaci (0 CZK) and AGROFERT
    // a.s. (8.7 M CZK), each carrying a manager tie and a steward tie. The rule this
    // replaced used whichever tie the relation scan returned first — an ordering, not a
    // rule.
    const stewardFirst = reachableMoney([
      tie({ companyId: "co:agrofert", tieClass: "steward", contractCzk: 8_711_232 }),
      tie({ companyId: "co:agrofert", tieClass: "manager", contractCzk: 8_711_232 }),
    ]);
    const managerFirst = reachableMoney([
      tie({ companyId: "co:agrofert", tieClass: "manager", contractCzk: 8_711_232 }),
      tie({ companyId: "co:agrofert", tieClass: "steward", contractCzk: 8_711_232 }),
    ]);
    expect(stewardFirst.attributable.contractCzk).toBe(8_711_232);
    expect(stewardFirst.steward.contractCzk).toBe(0);
    expect(managerFirst).toEqual(stewardFirst);
  });
});

describe("contractCoverage — a capped corpus is a floor, not a total", () => {
  it("detects the cap's signature: a low ceiling several companies sit on", () => {
    const c = contractCoverage([25, 25, 25, 12, 4]);
    expect(c.isFloor).toBe(true);
    expect(c.perCompanyCap).toBe(25);
    expect(c.companiesAtCap).toBe(3);
  });

  it("does not call one big supplier a cap", () => {
    // The live corpus after the batch-012 re-ingest: the biggest tied company is
    // Krajská zdravotní with 17 040 contracts, alone at the top → no cap, no "nejméně".
    const c = contractCoverage([17_040, 966, 849, 483]);
    expect(c.isFloor).toBe(false);
    expect(c.perCompanyCap).toBeNull();
    expect(c.companiesAtCap).toBe(0);
  });

  it("does not call a ceiling shared by only two companies a cap", () => {
    expect(contractCoverage([25, 25, 4]).isFloor).toBe(false);
  });

  it("is empty-safe", () => {
    expect(contractCoverage([])).toEqual({ perCompanyCap: null, companiesAtCap: 0, isFloor: false });
  });

  it("reachableMoney computes coverage over the DE-DUPLICATED companies", () => {
    // Three ties on the same two companies must not fake a third company at the ceiling.
    const m = reachableMoney([
      tie({ companyId: "co:1", contractCount: 25 }),
      tie({ companyId: "co:1", contractCount: 25 }),
      tie({ companyId: "co:2", contractCount: 25 }),
    ]);
    expect(m.coverage.isFloor).toBe(false);
    expect(m.companies).toBe(2);
  });
});
