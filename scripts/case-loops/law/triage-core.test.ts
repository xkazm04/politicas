import { describe, expect, it } from "vitest";
import { lawDomains, THEME_KEYWORDS } from "./triage-core";

/* The domain matcher behind the sector-adjacency conflict signal. Its own comment records the
 * P42 defect it fixed in batch-002 — `.includes()` matched "daní" inside "vydání", so EVERY MP
 * bill title read as economy — and until 2026-09-07 nothing pinned that fix. */

describe("lawDomains — word-boundary keyword net over normalised Czech", () => {
  it("the batch-002 P42 case: the boilerplate 'na vydání zákona' is NOT economy", () => {
    expect(lawDomains("Návrh poslanců na vydání zákona, kterým se mění zákon č. 1/2000 Sb.")).toEqual([]);
  });

  it.each([
    ["zákon o daních z příjmů", "economy"],
    ["zákon o lesích", "agriculture"],
    ["zákon o dopravě", "transport"],
    ["Zákon o ochraně ovzduší", "environment"],
    ["zákon o vysokých školách", "education"],
  ])("%s → %s", (title, sector) => {
    expect(lawDomains(title)).toEqual([sector]);
  });

  it("matches at a word start regardless of case and diacritics", () => {
    expect(lawDomains("ZÁKON O DANÍCH")).toEqual(["economy"]);
    expect(lawDomains("zakon o danich")).toEqual(["economy"]);
  });

  it("every sector has at least one keyword, and the ten sectors are the company-sector vocabulary", () => {
    for (const [sector, kws] of Object.entries(THEME_KEYWORDS)) expect(kws.length, sector).toBeGreaterThan(0);
    expect(Object.keys(THEME_KEYWORDS).sort()).toEqual(
      ["agriculture", "digital", "economy", "education", "environment", "health", "justice", "security", "social", "transport"],
    );
  });
});
