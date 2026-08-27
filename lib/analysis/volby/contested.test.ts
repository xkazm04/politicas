import { describe, expect, it } from "vitest";
import { contestedness, listLine, topContested } from "./contested";

describe("contestedness", () => {
  it("is 1 at a dead heat, 0 when unanimous, 0 when empty", () => {
    expect(contestedness(100, 100)).toBe(1);
    expect(contestedness(150, 0)).toBe(0);
    expect(contestedness(0, 0)).toBe(0);
    expect(contestedness(120, 80)).toBeCloseTo(0.8);
  });
});

describe("listLine", () => {
  const b = (choice: string) => ({ choice });
  it("needs a strict majority of yes/no ballots", () => {
    expect(listLine([b("yes"), b("yes"), b("no")])).toBe("yes");
    expect(listLine([b("no"), b("no"), b("yes")])).toBe("no");
    expect(listLine([b("yes"), b("no")])).toBe("split");
    expect(listLine([])).toBe("split");
  });
  it("ignores abstentions and absences as sides", () => {
    expect(listLine([b("yes"), b("abstain"), b("absent"), b("abstain")])).toBe("yes");
    expect(listLine([b("abstain"), b("absent")])).toBe("split");
  });
});

describe("topContested", () => {
  const ev = (votePspId: number, yes: number, no: number, votedOn = "2026-01-01", voided = false) => ({
    votePspId,
    title: `h${votePspId}`,
    votedOn,
    yes,
    no,
    voided,
  });
  it("excludes voided votes, sorts by contestedness desc, and caps at n", () => {
    const rows = topContested([ev(1, 100, 100, "2026-01-01", true), ev(2, 90, 100), ev(3, 150, 20), ev(4, 100, 90)], 2);
    expect(rows.map((r) => r.votePspId)).toEqual([2, 4]);
    expect(rows[0].contestedness).toBeCloseTo(1 - 10 / 190);
  });
  it("breaks ties by newer date then lower id, deterministically", () => {
    const rows = topContested([ev(9, 50, 50, "2026-01-01"), ev(5, 50, 50, "2026-02-01"), ev(7, 50, 50, "2026-02-01")], 5);
    expect(rows.map((r) => r.votePspId)).toEqual([5, 7, 9]);
  });
});
