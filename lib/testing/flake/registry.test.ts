/**
 * THE QUARANTINE GATE, and the proof it can go red.
 *
 * Half of this file gates the REAL register on every unit run: valid entries, no
 * expiry passed, size under the ceiling. The other half feeds the validator
 * deliberately broken registers and asserts each rule fires — because a gate whose
 * failure path has never been executed is a gate nobody has any reason to trust,
 * and this one will spend most of its life green over an empty register.
 *
 * Read together: the first half proves the register is healthy today, the second
 * proves "healthy" is a claim the validator is actually capable of denying.
 */

import { describe, expect, it } from "vitest";

import {
  inspectRegister,
  loadRegister,
  publishedFigures,
  quarantinedFiles,
  type FlakeRegister,
  type QuarantineEntry,
} from "./registry";

const NOW = new Date("2026-08-24T00:00:00Z");

const ok = (over: Partial<QuarantineEntry> = {}): QuarantineEntry => ({
  file: "lib/db/pglite/repositories/review.test.ts",
  test: "review > setTieReviewState is atomic",
  owner: "mkdol",
  entered: "2026-08-20",
  expires: "2026-09-10",
  cause: "harness",
  form: "muted",
  evidence: "memory/vitest-pglite-needs-tamed-workers.md",
  ...over,
});

const reg = (entries: QuarantineEntry[], over: Partial<FlakeRegister> = {}): FlakeRegister => ({
  ceiling: 5,
  maxQuarantineDays: 60,
  entries,
  ...over,
});

/** Every problem message, joined — the assertions match on substrings of it. */
const problemsOf = (r: FlakeRegister) => inspectRegister(r, NOW).problems.join("\n");

describe("the live quarantine register", () => {
  it("parses, and every entry satisfies the entry rules", () => {
    const health = inspectRegister(loadRegister());
    expect(health.problems, health.problems.join("\n")).toEqual([]);
  });

  it("holds no EXPIRED quarantine — expiry escalates, it does not extend", () => {
    const health = inspectRegister(loadRegister());
    expect(
      health.expired,
      `quarantine expired and was neither fixed nor re-decided:\n${health.expired.join("\n")}`,
    ).toEqual([]);
  });

  it("is under its ceiling, and publishes size and oldest-entry age", () => {
    const health = inspectRegister(loadRegister());
    expect(health.size).toBeLessThanOrEqual(health.ceiling);
    // The two figures the technique asks to publish, with their predicate.
    expect(publishedFigures(health)).toMatch(/quarantine register: \d+\/\d+ entries/);
  });

  it("exports exactly the files the lanes will subtract", () => {
    expect(quarantinedFiles()).toEqual(loadRegister().entries.map((e) => e.file));
  });
});

describe("the validator can refuse — one case per rule", () => {
  it("accepts a well-formed entry (the control)", () => {
    expect(inspectRegister(reg([ok()]), NOW).problems).toEqual([]);
  });

  it("refuses a team, a rota or a placeholder as the owner", () => {
    expect(problemsOf(reg([ok({ owner: "the team" })]))).toContain("name a person");
    expect(problemsOf(reg([ok({ owner: "TBD" })]))).toContain("name a person");
    expect(problemsOf(reg([ok({ owner: "" })]))).toContain('missing "owner"');
  });

  it("refuses a missing or malformed date", () => {
    expect(problemsOf(reg([ok({ entered: "20 Aug 2026" })]))).toContain('"entered" must be YYYY-MM-DD');
    expect(problemsOf(reg([ok({ expires: "" })]))).toContain('"expires" must be YYYY-MM-DD');
  });

  it("refuses an entry with no expiry in the future — amnesty is not quarantine", () => {
    expect(problemsOf(reg([ok({ entered: "2026-08-20", expires: "2026-08-19" })]))).toContain(
      '"expires" must be after "entered"',
    );
    expect(problemsOf(reg([ok({ entered: "2026-01-01", expires: "2026-12-31" })]))).toContain(
      "amnesty with a date on it",
    );
  });

  it("FLAGS AN EXPIRED ENTRY — the gate's whole reason to exist", () => {
    const health = inspectRegister(reg([ok({ entered: "2026-06-01", expires: "2026-07-01" })]), NOW);
    expect(health.expired).toHaveLength(1);
    expect(health.expired[0]).toContain("expired 2026-07-01");
    expect(health.expired[0]).toContain("owner mkdol");
  });

  it("refuses a suspected PRODUCT defect — that escalates, it does not get quarantined", () => {
    expect(problemsOf(reg([ok({ cause: "product" })]))).toContain("must be ESCALATED");
  });

  it("refuses an unknown cause or form", () => {
    expect(problemsOf(reg([ok({ cause: "vibes" as never })]))).toContain('"cause" must be one of');
    expect(problemsOf(reg([ok({ form: "ignored" as never })]))).toContain('"form" must be one of');
  });

  it("refuses an entry with no evidence and no named test", () => {
    expect(problemsOf(reg([ok({ evidence: "" })]))).toContain("link the failure that put it here");
    expect(problemsOf(reg([ok({ test: "" })]))).toContain("record WHICH test flaked");
  });

  it("refuses the same file quarantined twice", () => {
    expect(problemsOf(reg([ok(), ok({ test: "another one" })]))).toContain("is quarantined twice");
  });

  it("BREACHES THE CEILING — a register absorbing every hard problem stops the line", () => {
    const six = Array.from({ length: 6 }, (_, i) => ok({ file: `lib/x${i}.test.ts` }));
    expect(problemsOf(reg(six))).toContain("stop the line");
  });

  it("reports the age of the oldest entry, not just the size", () => {
    const health = inspectRegister(
      reg([ok({ entered: "2026-08-01" }), ok({ file: "lib/y.test.ts", entered: "2026-06-24" })]),
      NOW,
    );
    expect(health.size).toBe(2);
    expect(health.oldestEntry).toBe("2026-06-24");
    expect(health.oldestAgeDays).toBe(61);
    expect(publishedFigures(health)).toContain("oldest entered 2026-06-24 (61 days ago)");
  });
});
