import { describe, expect, it } from "vitest";

import type { ClubWindow } from "@/lib/db/store";

import { clubAt, clubNameAt, mandatesWithMultipleClubs } from "./clubAt";

const w = (club: string, fromAt: string | null, toAt: string | null): ClubWindow => ({ club, fromAt, toAt });

describe("clubAt — the club on the day of the vote", () => {
  const switched = [w("ANO2011", "2025-11-03", "2026-03-31"), w("MS", "2026-04-01", null)];

  it("resolves a day inside a window to that club", () => {
    expect(clubAt(switched, "2026-01-15")).toEqual({ kind: "in_club", club: "ANO2011" });
    expect(clubAt(switched, "2026-06-01")).toEqual({ kind: "in_club", club: "MS" });
  });

  it("is inclusive on both edges — a membership's last day still covers a vote", () => {
    expect(clubNameAt(switched, "2025-11-03")).toBe("ANO2011");
    expect(clubNameAt(switched, "2026-03-31")).toBe("ANO2011");
    expect(clubNameAt(switched, "2026-04-01")).toBe("MS");
  });

  it("treats an open toAt as current", () => {
    expect(clubNameAt([w("ODS", "2025-11-03", null)], "2030-01-01")).toBe("ODS");
  });

  it("treats an open fromAt as open at the start of the term", () => {
    expect(clubNameAt([w("ODS", null, "2026-05-05")], "1999-01-01")).toBe("ODS");
  });

  it("says outside_window for a day between windows — never 'unaffiliated'", () => {
    const gap = [w("ANO2011", "2025-11-03", "2026-03-31"), w("MS", "2026-05-01", null)];
    expect(clubAt(gap, "2026-04-15")).toEqual({ kind: "outside_window" });
    // The distinction the bucket exists to preserve:
    expect(clubAt([], "2026-04-15")).toEqual({ kind: "no_window" });
  });

  it("REFUSES two overlapping windows rather than picking by order", () => {
    const overlap = [w("ANO2011", "2025-11-03", "2026-04-30"), w("MS", "2026-04-01", null)];
    expect(clubAt(overlap, "2026-04-15")).toEqual({ kind: "ambiguous", clubs: ["ANO2011", "MS"] });
    expect(clubNameAt(overlap, "2026-04-15")).toBeNull();
    // Order must not change the verdict — that is the whole point.
    expect(clubAt([...overlap].reverse(), "2026-04-15")).toEqual({ kind: "ambiguous", clubs: ["ANO2011", "MS"] });
  });

  it("does not call two rows of the SAME club a contradiction", () => {
    const split = [w("ODS", "2025-11-03", "2026-01-31"), w("ODS", "2026-01-01", null)];
    expect(clubAt(split, "2026-01-15")).toEqual({ kind: "in_club", club: "ODS" });
  });

  it("refuses to guess when the vote carries no usable date", () => {
    expect(clubAt(switched, null)).toEqual({ kind: "outside_window" });
    expect(clubAt(switched, "nedatováno")).toEqual({ kind: "outside_window" });
    // …but a mandate with no windows at all is still 'no window', not 'outside' one.
    expect(clubAt([], null)).toEqual({ kind: "no_window" });
  });

  it("tolerates a timestamp where a date was expected", () => {
    expect(clubNameAt(switched, "2026-01-15T10:04:00Z")).toBe("ANO2011");
  });

  it("counts the mandates a dated read can differ on", () => {
    const byMandate = new Map<number, ClubWindow[]>([
      [1, switched],
      [2, [w("ODS", "2025-11-03", null)]],
      [3, [w("ODS", "2025-11-03", "2026-01-31"), w("ODS", "2026-02-01", null)]], // same club twice
    ]);
    expect(mandatesWithMultipleClubs(byMandate)).toBe(1);
  });
});
