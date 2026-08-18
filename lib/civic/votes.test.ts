import { describe, expect, it } from "vitest";
import { comparePartyDiscipline, disciplineByParty, type PartyDisciplineRow } from "./votes";

/* Probe for `sort-missing-id-tiebreaker` on disciplineByParty (identity-survives-
 * reuse). Party rows were ranked on the discipline average alone; two parties on
 * an equal average resolved by PARTIES input order + V8 stable sort, so a
 * reordered source (or a non-stable sort) would silently swap tied parties.
 * comparePartyDiscipline breaks the tie on a stable key (seats desc, then code). */

const row = (over: Partial<PartyDisciplineRow>): PartyDisciplineRow => ({
  code: "x",
  name: "X",
  color: "transparent",
  seats: 0,
  avg: 50,
  perRc: [],
  ...over,
});

describe("comparePartyDiscipline", () => {
  it("orders distinct averages descending, nulls last", () => {
    const out = [
      row({ code: "a", avg: 40 }),
      row({ code: "b", avg: null }),
      row({ code: "c", avg: 90 }),
    ].sort(comparePartyDiscipline);
    expect(out.map((r) => r.code)).toEqual(["c", "a", "b"]);
  });

  it("breaks an equal-average tie by seats descending", () => {
    // fed in ascending-seats order; a score-only comparator would keep that
    // (stable sort), the tiebreaker must flip it to seats-desc.
    const out = [
      row({ code: "small", avg: 75, seats: 4 }),
      row({ code: "big", avg: 75, seats: 72 }),
      row({ code: "mid", avg: 75, seats: 20 }),
    ].sort(comparePartyDiscipline);
    expect(out.map((r) => r.code)).toEqual(["big", "mid", "small"]);
  });

  it("breaks an equal-average-and-seats tie by code, deterministically", () => {
    const forward = [
      row({ code: "zzz", avg: 60, seats: 10 }),
      row({ code: "aaa", avg: 60, seats: 10 }),
    ];
    const reversed = [...forward].reverse();
    expect(forward.sort(comparePartyDiscipline).map((r) => r.code)).toEqual(["aaa", "zzz"]);
    expect(reversed.sort(comparePartyDiscipline).map((r) => r.code)).toEqual(["aaa", "zzz"]);
  });

  it("disciplineByParty with no measurable roll-calls is fully seats-ordered", () => {
    // every party avg=null → all tie; order must be the deterministic tiebreak,
    // not a bare pass-through of the PARTIES array.
    const out = disciplineByParty([]);
    const seats = out.map((r) => r.seats);
    expect([...seats]).toEqual([...seats].sort((a, b) => b - a));
  });
});
