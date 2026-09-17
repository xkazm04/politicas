import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { attributeCauses, pairKey, renderCauseCount, type BillRelation, type CandidatePair } from "./cause-collapse";

/* Measured A/B over the REAL batch-009 payloads, not fixtures.
 *
 * arm A = the collision backlog as the queue builder published it: the one discovered
 *         bill-level cause subtracted as a literal bill-pair, and no row carrying a cause.
 * arm B = the same rows attributed to the published cause register.
 *
 * The positive control is the first assertion: arm A's reconstruction must reproduce the
 * `backlogRemaining` the committed batch-011 queue actually shipped. If it does not, this file
 * is not measuring the pipeline and nothing after it counts.
 */

const PAYLOADS = "docs/data-analysis/case-law/payloads";
const read = (f: string) => JSON.parse(readFileSync(join(PAYLOADS, f), "utf8")) as Record<string, unknown>;

interface EscalatedPair extends CandidatePair {
  genuineParagraphs: string[];
}

const escalate = read("batch-009-collision-sweep.json").escalate as EscalatedPair[];
const register = read("batch-009-duplicate-bills.json").findings as BillRelation[];
const shippedQueue = read("batch-011-collision-queue.json") as { backlogRemaining: number };

/** Arm A, verbatim: the queue builder's own exclusion — one hardcoded bill-pair. */
const closedDuplicate = (a: number, b: number) => (a === 68 && b === 90) || (a === 90 && b === 68);
const armA = escalate.filter((p) => !closedDuplicate(p.billA, p.billB));

describe("collision backlog: instances vs causes", () => {
  it("POSITIVE CONTROL: arm A reproduces the backlog number the shipped queue printed", () => {
    expect(escalate).toHaveLength(83);
    expect(armA).toHaveLength(shippedQueue.backlogRemaining);
    expect(shippedQueue.backlogRemaining).toBe(76);
  });

  it("arm A publishes no cause for any row it carries", () => {
    // Nothing in the escalated row shape says why a row stands beside any other row.
    for (const row of armA) {
      expect(Object.keys(row)).not.toContain("causeId");
      expect(Object.keys(row)).not.toContain("relation");
    }
  });

  it("arm B attributes every row and loses none (the floor)", () => {
    const b = attributeCauses(escalate, register);
    expect(b.rows).toHaveLength(escalate.length);
    expect(b.unattributedRows).toBe(0);
    // The (statute, bill-pair) set is preserved exactly — attribution, not filtering.
    const inSet = new Set(escalate.map((p) => `${p.lawRef}::${pairKey(p.billA, p.billB)}`));
    const outSet = new Set(b.rows.map((r) => `${r.row.lawRef}::${pairKey(r.row.billA, r.row.billB)}`));
    expect(outSet).toEqual(inSet);
    for (const r of b.rows) expect(r.causeId).toBeTruthy();
  });

  it("arm B finds the cause the constant encoded, by reading the register", () => {
    const b = attributeCauses(escalate, register);
    const byRelation = b.causes.filter((c) => c.kind === "bill-relation");
    expect(byRelation).toHaveLength(1);
    expect(byRelation[0]).toMatchObject({ id: `bill:${pairKey(68, 90)}`, relation: "containment", rows: 7 });
    expect(b.rowsExplainedByRelation).toBe(7);
  });

  it("the collapse moves the count UP here, not down", () => {
    // The rule under test predicts a raw count OVERSTATES what is independent. Over this
    // backlog it understated: the seven rows of the one known cause were subtracted whole
    // instead of counted once, so the shipped 76 dropped the fact along with its instances.
    const b = attributeCauses(escalate, register);
    expect(b.distinctCauses).toBe(77);
    expect(b.distinctCauses).toBeGreaterThan(armA.length);
    expect(escalate.length - b.distinctCauses).toBe(6);
  });

  it("NEGATIVE CONTROL: an empty register switches the collapse off, observably", () => {
    const off = attributeCauses(escalate, []);
    expect(off.distinctCauses).toBe(83);
    expect(off.rowsExplainedByRelation).toBe(0);
    expect(off.causes.every((c) => c.rows === 1)).toBe(true);
  });

  it("the published count carries its cause predicate", () => {
    const line = renderCauseCount(attributeCauses(escalate, register));
    expect(line).toContain("83 candidate row(s) from 77 distinct cause(s)");
    expect(line).toContain("explains 7");
    expect(renderCauseCount(attributeCauses(escalate, []))).toContain("every row is its own cause");
  });

  it("a second relation in the register is honoured without a code change", () => {
    // The register's 28×141 relation explains no escalated row, so it is invisible in the
    // numbers above. Feed rows it covers and the attribution picks it up — which is the whole
    // point of reading the register rather than hardcoding one pair.
    const extra: CandidatePair[] = [
      { lawRef: "243/2000", billA: 28, billB: 141 },
      { lawRef: "250/2000", billA: 141, billB: 28 },
    ];
    const b = attributeCauses([...escalate, ...extra], register);
    expect(b.causes.find((c) => c.id === `bill:${pairKey(28, 141)}`)).toMatchObject({ relation: "partial-overlap", rows: 2 });
    expect(b.rows).toHaveLength(85);
  });
});
