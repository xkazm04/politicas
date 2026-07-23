import { describe, expect, it } from "vitest";
import {
  asciiFold,
  fullName,
  PRESENT_CHOICES,
  readBirthDate,
  termCode,
  voteChoice,
  voteKind,
  voteOutcome,
} from "./normalize";

describe("asciiFold", () => {
  it("folds Czech diacritics to ASCII (the unaccent substitute)", () => {
    expect(asciiFold("Nováková")).toBe("novakova");
    expect(asciiFold("Poslanecký klub Starostové a nezávislí")).toBe(
      "poslanecky klub starostove a nezavisli",
    );
    expect(asciiFold("Řehoř Čížek")).toBe("rehor cizek");
  });
  it("folds letters that NFD-strip would miss (ď/ť/ľ/đ/ø)", () => {
    expect(asciiFold("ďťľ")).toBe("dtl");
    expect(asciiFold("Đorđ Ø")).toBe("dord o");
  });
  it("collapses and trims whitespace", () => {
    expect(asciiFold("  a   b  ")).toBe("a b");
  });
  it("produces pure ASCII for any Czech input", () => {
    for (const s of ["Žluťoučký kůň", "Bělobrádek", "Výbor pro životní prostředí"]) {
      expect(asciiFold(s)).toMatch(/^[\x20-\x7e]*$/);
    }
  });
});

describe("fullName", () => {
  it("joins first and last, dropping empties", () => {
    expect(fullName("Petra", "Nováková")).toBe("Petra Nováková");
    expect(fullName(null, "Nováková")).toBe("Nováková");
    expect(fullName("", "  ")).toBe("");
  });
});

describe("readBirthDate", () => {
  it("treats the publisher's 1900-01-01 sentinel as unknown, not a real date", () => {
    expect(readBirthDate("1900-01-01")).toEqual({ date: null, unknown: true });
    expect(readBirthDate(null)).toEqual({ date: null, unknown: true });
  });
  it("passes a real date through", () => {
    expect(readBirthDate("1975-06-30")).toEqual({ date: "1975-06-30", unknown: false });
  });
});

describe("voteChoice", () => {
  it("maps the documented per-MP ballot codes", () => {
    expect(voteChoice("A")).toBe("yes");
    expect(voteChoice("B")).toBe("no");
    expect(voteChoice("N")).toBe("no");
    expect(voteChoice("C")).toBe("abstain");
    expect(voteChoice("F")).toBe("not_voting");
    expect(voteChoice("@")).toBe("not_logged_in");
    expect(voteChoice("M")).toBe("excused");
    expect(voteChoice("W")).toBe("pre_oath");
  });
  it("keeps the post-1995 merged bucket K distinct and never splits it", () => {
    expect(voteChoice("K")).toBe("abstain_or_not_voting");
    expect(PRESENT_CHOICES.has("abstain_or_not_voting")).toBe(true);
  });
  it("maps an unknown code to unknown, never to a guess", () => {
    expect(voteChoice("Z")).toBe("unknown");
    expect(voteChoice(null)).toBe("unknown");
  });
});

describe("voteOutcome / voteKind", () => {
  it("maps roll-call outcome codes", () => {
    expect(voteOutcome("A")).toBe("accepted");
    expect(voteOutcome("R")).toBe("rejected");
    expect(voteOutcome("K")).toBe("quorum_not_reached");
    expect(voteOutcome("Q")).toBe("unknown_non_public");
  });
  it("maps vote-kind codes", () => {
    expect(voteKind("N")).toBe("normal");
    expect(voteKind("R")).toBe("manual");
    expect(voteKind("E")).toBe("technical_fault");
  });
});

describe("termCode", () => {
  it("uses the PSP<n> abbreviation as the term code", () => {
    expect(termCode("PSP10", 174)).toBe("PSP10");
    expect(termCode("psp9", 173)).toBe("PSP9");
  });
  it("falls back to the organ id when the abbreviation is not a term code", () => {
    expect(termCode("ANO2011", 1750)).toBe("ORGAN1750");
  });
});
