import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPublicSafe, jargonViolationDetails, jargonViolations, publicCopyOrNull } from "./public-copy";

describe("public-copy guard", () => {
  // Real strings taken from the live graph (batches 001–005) — the exact class
  // that reached readers once the dossier layer started rendering.
  it("rejects a batch self-reference", () => {
    const s = "Spolupodepsal sadu klubových tisků ODS, kterou v batch 001 spolupodepisoval i Karel Haas.";
    expect(jargonViolations(s)).toContain("batch/sample self-reference");
    expect(isPublicSafe(s)).toBe(false);
    expect(publicCopyOrNull(s)).toBeNull();
  });

  it("rejects raw prop identifiers and pipeline field names", () => {
    const s = "bills_authored=2 odpovídá počtu položek v sponsoredBills, ale u žádného není první předkladatel.";
    const v = jargonViolations(s);
    expect(v).toContain("raw prop identifier");
    expect(v).toContain("raw pipeline field name");
  });

  it("rejects internal case references and gate citations", () => {
    expect(jargonViolations("Vazba pochází z Case ① a nebyla ověřena.")).toContain("internal case reference");
    expect(jargonViolations("Ponecháno dle gate (e) bez úpravy čísla.")).toContain("internal gate-rule citation");
  });

  it("passes clean reader copy untouched", () => {
    const s =
      "Místopředseda ústavně-právního výboru; spolupodepsal pět tisků, u novely jednacího řádu je garančním zpravodajem.";
    expect(jargonViolations(s)).toEqual([]);
    expect(isPublicSafe(s)).toBe(true);
    expect(publicCopyOrNull(s)).toBe(s);
  });

  it("treats empty/absent prose as not renderable", () => {
    expect(isPublicSafe("")).toBe(false);
    expect(isPublicSafe(null)).toBe(false);
    expect(isPublicSafe(undefined)).toBe(false);
    expect(publicCopyOrNull(undefined)).toBeNull();
  });

  it("withholds the whole string rather than scrubbing part of it", () => {
    // A half-cleaned sentence would be worse than none: it reads as finished copy.
    const s = "Skutečně aktivní poslanec. Pozn.: contribution_score je nízké kvůli krátkému mandátu.";
    expect(publicCopyOrNull(s)).toBeNull();
  });

  // Q-effort-15 (batch 007): gate.ts used to carry its OWN duplicated jargon-rule
  // array — including this "API/pipeline mechanics" rule — that this module never
  // had, so a string could be DROPPED at persist time yet still render (its withheld
  // status computed from a weaker rule set). Unified: this is now the one definition.
  it("rejects API/pipeline mechanics language (unified with gate.ts, batch 007)", () => {
    const s = "Ověřeno přes ARES VR REST endpoint, vrácená odpověď byla ve formátu JSON.";
    expect(jargonViolations(s)).toContain("API/pipeline mechanics");
    expect(isPublicSafe(s)).toBe(false);
  });

  it("jargonViolationDetails reports the exact matched substring per rule", () => {
    const s = "gate (e) dovolilo ponechat tisk beze změny.";
    const details = jargonViolationDetails(s);
    expect(details).toContainEqual({ what: "internal gate-rule citation", match: "gate (e)" });
  });
});

// Q-effort-15 (batch 007): `effort_analyst_note` is a deliberately NON-rendered
// analyst/reviewer channel (see gate.ts and getProfileData.ts comments) — rewrite
// passes are explicitly allowed to leave pipeline jargon in it, on the premise that
// nothing ever reads it for render. That premise has no enforcement beyond this test:
// a batch-006 reflection found 38/136 batch-007 notes carry 56 jargon hits by design,
// so a future profile change that references the field by name would ship all of it
// silently (the render-time `publicCopyOrNull` guard never sees a field it isn't
// asked to check). Source-grep guard, not a runtime check — cheap and durable.
describe("effort_analyst_note must never be wired into a render path", () => {
  const RENDER_SOURCES = [
    "features/profile/getProfileData.ts",
    "features/profile/ProfilePage.tsx",
    "features/civicscore/getLeaderboardData.ts",
  ];
  it.each(RENDER_SOURCES)("%s does not reference effort_analyst_note", (relPath) => {
    const src = readFileSync(relPath, "utf8");
    expect(src).not.toMatch(/effort_analyst_note/);
  });
});
