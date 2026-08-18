import { describe, expect, it } from "vitest";
import { byScoreThenId } from "./ordering";

/* Probe for `sort-missing-id-tiebreaker` (stable-identity law). A batch-selecting
 * triage sort persists rank/batch off row position, so equal-score rows must
 * resolve on a stable id — NOT on the order the rows happened to arrive in.
 * These assertions fail against a score-only comparator and pass once the id
 * tiebreaker is appended. */

interface Row {
  id: number;
  score: number;
}

const sort = (rows: Row[]) => [...rows].sort(byScoreThenId((r) => r.score, (r) => r.id));

describe("byScoreThenId", () => {
  it("orders distinct scores descending", () => {
    const out = sort([
      { id: 1, score: 3 },
      { id: 2, score: 9 },
      { id: 3, score: 5 },
    ]);
    expect(out.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("breaks equal-score ties by ascending id", () => {
    const out = sort([
      { id: 7, score: 5 },
      { id: 2, score: 5 },
      { id: 5, score: 5 },
    ]);
    expect(out.map((r) => r.id)).toEqual([2, 5, 7]);
  });

  it("is a TOTAL order: reversing input does not change the ranking", () => {
    const forward: Row[] = [
      { id: 4, score: 8 },
      { id: 1, score: 8 }, // tie with id:4 at score 8
      { id: 9, score: 8 }, // three-way tie
      { id: 3, score: 2 },
    ];
    const reversed = [...forward].reverse();
    expect(sort(forward).map((r) => r.id)).toEqual(sort(reversed).map((r) => r.id));
    // and the tie resolves on id, so the batch boundary is deterministic
    expect(sort(forward).map((r) => r.id)).toEqual([1, 4, 9, 3]);
  });

  it("supports string ids (billNodeId / tie id)", () => {
    const cmp = byScoreThenId<{ nid: string; s: number }>((r) => r.s, (r) => r.nid);
    const out = [
      { nid: "bill:tisk:58", s: 4 },
      { nid: "bill:tisk:12", s: 4 },
      { nid: "bill:tisk:9", s: 9 },
    ].sort(cmp);
    expect(out.map((r) => r.nid)).toEqual(["bill:tisk:9", "bill:tisk:12", "bill:tisk:58"]);
  });
});
