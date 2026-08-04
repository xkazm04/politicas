import { describe, expect, it } from "vitest";
import { committeeClaimWarnings, extractCommitteeClaims } from "./committee-claims";

describe("extractCommitteeClaims", () => {
  it("reads spelled-out Czech numerals bound to výbor", () => {
    expect(extractCommitteeClaims("Zasedá v šesti výborech a komisích.").map((c) => c.count)).toEqual([6]);
    expect(extractCommitteeClaims("uváděný počet sedmi výborů neodpovídá").map((c) => c.count)).toEqual([7]);
  });

  it("reads Arabic numerals, including across an adjective", () => {
    expect(extractCommitteeClaims("zapojení do 5 výborů/komisí").map((c) => c.count)).toEqual([5]);
    expect(extractCommitteeClaims("ve 2 sněmovních výborech").map((c) => c.count)).toEqual([2]);
  });

  // Each exclusion below removed a REAL false positive measured on the live corpus in
  // batch 010 — the scan fired 59 times before them and 15 after.
  it("ignores podvýbor — the PSP10 ingest carries no subcommittee memberships", () => {
    expect(extractCommitteeClaims("je členem sedmi podvýborů")).toEqual([]);
    expect(extractCommitteeClaims("čtyř podvýborů pro energetiku")).toEqual([]);
  });

  it("ignores a numeral separated from výbor by a preposition or adverb", () => {
    // six BILLS still sitting in committees, not six committees
    expect(extractCommitteeClaims("z devíti tisků je 6 stále ve výborech")).toEqual([]);
  });

  it("ignores a partitive — the numeral counts the set, not the MP's seats", () => {
    expect(extractCommitteeClaims("předsedá jeden ze šesti výborů")).toEqual([]);
  });

  it("ignores Czech negation, which inverts the numeral", () => {
    expect(extractCommitteeClaims("nepůsobí ani v jednom výboru")).toEqual([]);
    expect(extractCommitteeClaims("nezasedá v žádném výboru")).toEqual([]);
  });

  it("ignores numerals too large to be a committee count", () => {
    expect(extractCommitteeClaims("v roce 2026 výbor projednal")).toEqual([]);
  });

  it("bounds words on Czech diacritics — \\b would not", () => {
    // "pošesti" must not match the numeral "šesti"
    expect(extractCommitteeClaims("pošesti výborech")).toEqual([]);
  });
});

describe("committeeClaimWarnings", () => {
  it("warns when the prose contradicts the deterministic prop", () => {
    const w = committeeClaimWarnings("Adamec", "effort_notes", "Uváděný počet tří výborů v datech.", 2);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("committee_count=2");
  });

  it("is silent when prose and prop agree", () => {
    expect(committeeClaimWarnings("Adamec", "effort_notes", "Zasedá ve dvou výborech.", 2)).toEqual([]);
  });

  it("never compares a cross-term field — PSP9 counts are not this term's", () => {
    expect(committeeClaimWarnings("Samaš", "effort_psp9_trend_note", "V minulém období 7 výborů, nyní 2 výbory.", 5)).toEqual([]);
  });

  it("is silent when the prop is absent rather than guessing a zero", () => {
    expect(committeeClaimWarnings("X", "effort_notes", "Zasedá v šesti výborech.", null)).toEqual([]);
    expect(committeeClaimWarnings("X", "effort_notes", "Zasedá v šesti výborech.", undefined)).toEqual([]);
  });
});
