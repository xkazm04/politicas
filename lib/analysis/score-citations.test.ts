import { describe, expect, it } from "vitest";
import { findScoreCitations, staleScoreWarnings } from "./score-citations";

describe("findScoreCitations", () => {
  // Every string below is a real shape taken from the live dossier corpus — the shapes
  // the first, „N bodu"-only lens could not see.
  it("finds a bare parenthetical after a score cue", () => {
    const t = "Nejvyšší kontribuční skóre z trojice (90,5), přitom regionální tisk ho označil za absentéra.";
    expect(findScoreCitations(t, 90.5).map((c) => c.raw)).toEqual(["90,5"]);
  });

  it("finds a score in a growth sentence", () => {
    const t = "Skóre vzrostlo z 66 (PSP9) na 80,5 (PSP10) při zachování téže vedoucí funkce.";
    expect(findScoreCitations(t, 80.5).map((c) => c.raw)).toEqual(["80,5"]);
  });

  it("finds an integer-valued score", () => {
    expect(findScoreCitations("Deset vystoupení a skóre přínosu 60 — nízkoenergetický profil.", 60)).toHaveLength(1);
  });

  it("requires a score cue — a bare count never matches", () => {
    // 6 bills, not a score of 6
    expect(findScoreCitations("u jednoho ze 6 tisků je první signatář", 6)).toEqual([]);
    expect(findScoreCitations("48 řečnických vystoupení", 48)).toEqual([]);
  });

  it("does not match a number embedded in a longer number", () => {
    expect(findScoreCitations("skóre 185,4 v přehledu", 85.4)).toEqual([]);
    expect(findScoreCitations("skóre 60,4 v přehledu", 60)).toEqual([]);
    expect(findScoreCitations("skóre 160 v přehledu", 60)).toEqual([]);
  });

  // Both of these were silently missed by the first version and cost 2 of 16 real hits.
  it("treats a following SENTENCE comma as punctuation, not a decimal", () => {
    const t = "skóre přínosu vzrostlo ze 72,9 na 77,9, což ukazuje konzistentní práci.";
    expect(findScoreCitations(t, 77.9).map((c) => c.raw)).toEqual(["77,9"]);
  });

  it("matches an integer score written with an explicit tenth", () => {
    // The real corpus sentence: the cue („skóre") sits in the preceding clause.
    const t = "V PSP9 patřil k nejhlasitějším (9 tisků, skóre 59,2) — v PSP10 (63,0) je téměř tichý na plénu.";
    expect(findScoreCitations(t, 63).map((c) => c.raw)).toEqual(["63,0"]);
    expect(findScoreCitations("skóre přínosu 60 — nízkoenergetický profil", 60).map((c) => c.raw)).toEqual(["60"]);
  });

  it("respects the proximity window", () => {
    const far = `skóre přínosu je popsáno níže. ${"x".repeat(200)} 90,5`;
    expect(findScoreCitations(far, 90.5)).toEqual([]);
  });
});

describe("staleScoreWarnings", () => {
  it("warns when the prose still carries the superseded value", () => {
    const w = staleScoreWarnings("Bureš", "effort_notes", "Nejvyšší kontribuční skóre z trojice (90,5).", 90.5, 83.8);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("now 83,8");
  });

  it("is silent when the score did not move", () => {
    expect(staleScoreWarnings("X", "effort_notes", "skóre 90,5", 90.5, 90.5)).toEqual([]);
  });

  it("is silent when either value is absent rather than guessing", () => {
    expect(staleScoreWarnings("X", "effort_notes", "skóre 90,5", null, 83.8)).toEqual([]);
    expect(staleScoreWarnings("X", "effort_notes", "skóre 90,5", 90.5, undefined)).toEqual([]);
  });
});
