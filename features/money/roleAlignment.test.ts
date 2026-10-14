import { describe, expect, it } from "vitest";

import { alignContractsToRole } from "./roleAlignment";

const TODAY = "2026-10-14";

/** Arm A: the comparison triage.ts carried before the shared helper (kept verbatim as the control). */
function legacyInPeriod(signedOn: string | null, from: string | null, to: string | null): boolean {
  if (!signedOn) return false;
  if (from && signedOn < from) return false;
  if (to && signedOn > to) return false;
  return true;
}
const legacy = (rows: { signedOn: string | null; amount: number }[], from: string | null, to: string | null) =>
  rows.reduce((n, r) => (from || to) && legacyInPeriod(r.signedOn, from, to) ? n + r.amount : n, 0);

const rows = [
  { signedOn: "2010-05-01", amount: 100 }, // before the window
  { signedOn: "2012-01-01", amount: 200 }, // first day
  { signedOn: "2014-06-30T09:15:00", amount: 400 }, // timestamp on the last day
  { signedOn: "2015-01-01", amount: 800 }, // after the window
  { signedOn: null, amount: 1600 }, // undated
];

describe("alignContractsToRole", () => {
  it("counts both boundary days, and a timestamp on the last day, as inside", () => {
    const r = alignContractsToRole(rows, "2012-01-01", "2014-06-30", TODAY);
    expect(r).toEqual({ windowed: true, alignedCzk: 600, alignedCount: 2, undatedCount: 1 });
    expect(legacy(rows, "2012-01-01", "2014-06-30")).toBe(200); // control drops the last-day timestamp
  });

  it("does not align anything for a tie with no registered start", () => {
    const r = alignContractsToRole(rows, null, "2014-06-30", TODAY);
    expect(r).toEqual({ windowed: false, alignedCzk: 0, alignedCount: 0, undatedCount: 0 });
    expect(legacy(rows, null, "2014-06-30")).toBe(300); // control invents "everything before the end"
  });

  it("bounds an open end by the snapshot day and never aligns an implausible date", () => {
    const bad = [
      { signedOn: "3062-01-01", amount: 1000 },
      { signedOn: "0002-03-04", amount: 2000 },
      { signedOn: "2027-01-01", amount: 4000 }, // after the snapshot
      { signedOn: "2020-02-02", amount: 8000 },
    ];
    const r = alignContractsToRole(bad, "2016-01-01", null, TODAY);
    expect(r).toEqual({ windowed: true, alignedCzk: 8000, alignedCount: 1, undatedCount: 3 });
    expect(legacy(bad, "2016-01-01", null)).toBe(13000); // control aligns the year-3062 and 2027 rows
  });
});
