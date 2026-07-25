import { describe, expect, it } from "vitest";
import { isPublicSafe, jargonViolations, publicCopyOrNull } from "./public-copy";

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
});
