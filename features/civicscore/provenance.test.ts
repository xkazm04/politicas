import { describe, expect, it } from "vitest";
import { CONTRIBUTION_FORMULA_REF } from "@/lib/analysis/contribution";
import { summarizeContributionProvenance, storedRefLabel } from "./provenance";

const person = (pass: number | null, ref: string | null, computedAt?: string) => ({
  contribution_score: 50,
  contribution_provenance: {
    ...(pass === null ? {} : { pass }),
    ...(ref === null ? {} : { ref }),
    ...(computedAt === undefined ? {} : { computedAt }),
    method: "deterministic",
  },
});

describe("summarizeContributionProvenance", () => {
  it("MATCH — a uniform chamber on the declared ref reports pass, ref and formulaMatch", () => {
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF),
      person(42, CONTRIBUTION_FORMULA_REF),
      person(42, CONTRIBUTION_FORMULA_REF),
    ]);
    expect(p.state).toBe("uniform");
    expect(p.pass).toBe(42);
    expect(p.ref).toBe(CONTRIBUTION_FORMULA_REF);
    expect(p.distinctCount).toBe(1);
    expect(p.covered).toBe(3);
    expect(p.total).toBe(3);
    expect(p.formulaMatch).toBe(true);
  });

  it("MISMATCH — the pass-11 store: uniform, but on a ref the formula no longer declares", () => {
    const p = summarizeContributionProvenance([person(11, "contribution"), person(11, "contribution")]);
    expect(p.state).toBe("uniform");
    expect(p.pass).toBe(11);
    expect(p.ref).toBe("contribution");
    expect(p.formulaMatch).toBe(false);
    expect(storedRefLabel(p)).toBe("contribution");
    expect(p.declaredRef).toBe(CONTRIBUTION_FORMULA_REF);
  });

  it("MIXED — a half-finished recompute has NO single pass and says so", () => {
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF),
      person(42, CONTRIBUTION_FORMULA_REF),
      person(11, "contribution"),
    ]);
    expect(p.state).toBe("mixed");
    expect(p.pass).toBeNull(); // the old loader would have published 42 (or 11) here
    expect(p.ref).toBeNull();
    expect(p.distinctCount).toBe(2);
    expect(p.variants.map((v) => v.count)).toEqual([2, 1]); // count desc
    expect(p.formulaMatch).toBe(false);
    expect(storedRefLabel(p)).toBe(`${CONTRIBUTION_FORMULA_REF}, contribution`);
  });

  it("mixed on the pass alone (same ref, two passes) is still mixed", () => {
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF),
      person(43, CONTRIBUTION_FORMULA_REF),
    ]);
    expect(p.state).toBe("mixed");
    expect(p.distinctCount).toBe(2);
    // Every ref still matches the formula — the ranking is one formula, two passes.
    expect(p.formulaMatch).toBe(true);
  });

  it("ABSENT — nodes without provenance claim nothing, and never claim a match", () => {
    const p = summarizeContributionProvenance([{ contribution_score: 50 }, { contribution_score: 60 }]);
    expect(p.state).toBe("absent");
    expect(p.pass).toBeNull();
    expect(p.covered).toBe(0);
    expect(p.total).toBe(2);
    expect(p.formulaMatch).toBe(false);
  });

  it("counts partial coverage honestly (some nodes never got stamped)", () => {
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF),
      { contribution_score: 60 },
    ]);
    expect(p.state).toBe("uniform");
    expect(p.covered).toBe(1);
    expect(p.total).toBe(2);
  });

  it("ignores malformed provenance values rather than inventing a pass", () => {
    const p = summarizeContributionProvenance([
      { contribution_provenance: "pass 42" },
      { contribution_provenance: { pass: Number.NaN, ref: "" } },
      { contribution_provenance: null },
    ]);
    expect(p.state).toBe("absent");
    expect(p.covered).toBe(0);
  });

  it("dates the ranking only when the WHOLE chamber agrees on one day", () => {
    // /dashboard reads this instead of running a second full person-relation scan
    // for one date (getRecomputeFact), so the uniformity bar has to be the strict one.
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF, "2026-08-04"),
      person(42, CONTRIBUTION_FORMULA_REF, "2026-08-04"),
    ]);
    expect(p.state).toBe("uniform");
    expect(p.computedAt).toBe("2026-08-04");
  });

  it("accepts a full instant but publishes the DAY", () => {
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF, "2026-08-04T09:12:33.000Z"),
    ]);
    expect(p.computedAt).toBe("2026-08-04");
  });

  it("MIXED — a half-recomputed chamber has no single day either", () => {
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF, "2026-08-04"),
      person(11, "contribution", "2026-07-29"),
    ]);
    expect(p.state).toBe("mixed");
    expect(p.computedAt).toBeNull();
  });

  it("one pass written on two days is not one day (two writes of one pass)", () => {
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF, "2026-08-04"),
      person(42, CONTRIBUTION_FORMULA_REF, "2026-08-05"),
    ]);
    expect(p.state).toBe("uniform"); // {pass, ref} still agree
    expect(p.computedAt).toBeNull(); // …but „when" does not
  });

  it("a scored person with no stamp costs the chamber its date, not a guess", () => {
    const p = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF, "2026-08-04"),
      person(42, CONTRIBUTION_FORMULA_REF),
    ]);
    expect(p.state).toBe("uniform");
    expect(p.computedAt).toBeNull();
  });

  it("an unparseable stamp is not a date and is never repaired into one", () => {
    const p = summarizeContributionProvenance([person(42, CONTRIBUTION_FORMULA_REF, "loni")]);
    expect(p.computedAt).toBeNull();
  });

  it("ABSENT — no provenance, no date", () => {
    expect(summarizeContributionProvenance([{}, {}]).computedAt).toBeNull();
  });

  it("is order-independent — the same multiset yields the same variants", () => {
    const a = summarizeContributionProvenance([
      person(11, "contribution"),
      person(42, CONTRIBUTION_FORMULA_REF),
      person(42, CONTRIBUTION_FORMULA_REF),
    ]);
    const b = summarizeContributionProvenance([
      person(42, CONTRIBUTION_FORMULA_REF),
      person(11, "contribution"),
      person(42, CONTRIBUTION_FORMULA_REF),
    ]);
    expect(a.variants).toEqual(b.variants);
  });
});
