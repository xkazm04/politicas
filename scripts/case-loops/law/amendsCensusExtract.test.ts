// The amends census's core heuristic — extractRealAmendedLaws — carried six audited fixes
// (batch-005 D1, batch-007 N1/N4/round-2, batch-008 F1) and no unit test: every regression
// was found by re-auditing 141 bills. Four corpus-shaped operative texts pin the documented
// classes (2026-09-09, scan-sweep law-amends-analysis, test-strategist).
// The Čl. fixture keeps its transitional article longer than the 150-char lookback the
// next marker reads — a shorter one leaks its heading into the next block (a lead).
import { describe, expect, it } from "vitest";
import { extractRealAmendedLaws } from "./amends-census";

describe("extractRealAmendedLaws — the documented corpus classes", () => {
  it("Čl.-organised omnibus: one target per article; a transitional article and a repeal block add nothing", () => {
    const text = [
      "",
      "Čl. I",
      "Zákon č. 586/1992 Sb., o daních z příjmů, ve znění zákona č. 35/1993 Sb., se mění takto:",
      "1. V § 4 se slova ...",
      "",
      "Čl. II",
      "Přechodné ustanovení",
      "Pro poplatníky podle zákona č. 424/1991 Sb. platí, že daňová povinnost vzniklá přede dnem nabytí účinnosti tohoto zákona se posuzuje podle dosavadních právních předpisů a lhůty, které začaly běžet přede dnem nabytí účinnosti tohoto zákona, se dokončí podle dosavadních právních předpisů.",
      "",
      "Čl. III",
      "Zákon č. 262/2006 Sb., zákoník práce, se mění takto:",
      "1. V § 2 ...",
      "",
      "Čl. IV",
      "Zrušovací ustanovení",
      "Zrušují se:",
      "1. Zákon č. 348/2005 Sb., o rozhlasových a televizních poplatcích.",
      "",
    ].join("\n");
    const r = extractRealAmendedLaws(text);
    expect(r.structure).toBe("cl");
    expect([...r.laws].sort()).toEqual(["262/2006", "586/1992"]);
    expect(r.repealedRefs).toContain("348/2005");
    expect(r.laws.has("424/1991")).toBe(false);
  });

  it("single-subject NEW act (no 'kterým se mění' in its opening) amends nothing, whatever it cites", () => {
    const text = "Zákon o kybernetické bezpečnosti\n§ 1\nTento zákon zapracovává předpisy Evropské unie a navazuje na zákon č. 181/2014 Sb.\n§ 2 ...";
    const r = extractRealAmendedLaws(text);
    expect(r.structure).toBe("single-subject-non-amending");
    expect(r.laws.size).toBe(0);
  });

  it("single-subject novela names its one target; a footnote citation is not that target", () => {
    const text = [
      "Zákon, kterým se mění zákon č. 262/2006 Sb., zákoník práce",
      "§ 1",
      "1) Zákon č. 354/2019 Sb., o soudních tlumočnících a soudních překladatelích.",
      "Zákon č. 262/2006 Sb., zákoník práce, ve znění pozdějších předpisů, se mění takto:",
    ].join("\n");
    const r = extractRealAmendedLaws(text);
    expect(r.structure).toBe("single-subject-amending");
    expect([...r.laws]).toEqual(["262/2006"]);
  });
});

describe("extractRealAmendedLaws — a ČÁST's heading window stops at the next ČÁST (2026-09-09, bounty-hunter)", () => {
  it("ČÁST-organised bill: only a part whose heading says Změna is searched; the repeal part is reported, not amended", () => {
    const text = [
      "",
      "ČÁST PRVNÍ",
      "ZÁKON O DIGITÁLNÍ SLUŽBĚ",
      "§ 1 Tento zákon upravuje ... podle zákona č. 111/2009 Sb.",
      "",
      "ČÁST DRUHÁ",
      "Změna zákona o daních z příjmů",
      "Zákon č. 586/1992 Sb., o daních z příjmů, se mění takto:",
      "1. V § 6 ...",
      "",
      "ČÁST TŘETÍ",
      "ZRUŠOVACÍ USTANOVENÍ",
      "Zrušují se:",
      "1. Zákon č. 348/2005 Sb.",
      "",
      "ČÁST ČTVRTÁ",
      "ÚČINNOST",
      "Tento zákon nabývá účinnosti ...",
      "",
    ].join("\n");
    const r = extractRealAmendedLaws(text);
    expect(r.structure).toBe("cast");
    expect([...r.laws]).toEqual(["586/1992"]);
    expect(r.skippedParts).toHaveLength(3);
    expect(r.repealedRefs).toContain("348/2005");
  });
});
