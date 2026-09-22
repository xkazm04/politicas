// The catalog primitive's copy contract. The component itself is presentational
// and takes no domain module, so what CAN go wrong is the catalog: a rung with no
// copy renders its own key name at a reader, and a Czech-first surface that lost
// its Czech string renders English to a Czech reader.

import { describe, expect, it } from "vitest";
import { rungKey, type VerdictRung } from "@/lib/analysis/verdict-provenance";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

const RUNGS: VerdictRung[] = ["machine", "pending", "verified", "rejected"];

/** The primitive also renders `withheld`, `by` and `byOn`, which no rung maps to. */
const EXTRA_KEYS = ["withheld", "by", "byOn"] as const;

function verdictCatalog(cat: typeof csCatalog): Record<string, string> {
  const shared = (cat as unknown as { shared: Record<string, unknown> }).shared;
  return (shared.verdict ?? {}) as Record<string, string>;
}

describe("shared.verdict copy", () => {
  it("every rung rungKey() can produce has a string in BOTH catalogs", () => {
    for (const rung of RUNGS) {
      // rungKey returns the fully-qualified key; the component reads the
      // namespace, so the leaf is what has to exist.
      const leaf = rungKey(rung).replace("shared.verdict.", "");
      expect(leaf).toBe(rung);
      expect(typeof verdictCatalog(csCatalog)[leaf]).toBe("string");
      expect(typeof verdictCatalog(enCatalog)[leaf]).toBe("string");
    }
  });

  it("the withheld state has its own copy — it is a rendered refusal, not a blank", () => {
    // If this key were missing, a rejected verdict would render the string
    // "shared.verdict.withheld" where the honest empty state belongs.
    for (const key of EXTRA_KEYS) {
      expect(typeof verdictCatalog(csCatalog)[key]).toBe("string");
      expect(typeof verdictCatalog(enCatalog)[key]).toBe("string");
    }
  });

  it("the two catalogs carry exactly the same keys — neither has a dead or a missing one", () => {
    expect(Object.keys(verdictCatalog(csCatalog)).sort()).toEqual(
      Object.keys(verdictCatalog(enCatalog)).sort(),
    );
  });

  it("rejected and withheld both SAY something — an empty string would be a blank badge", () => {
    for (const cat of [csCatalog, enCatalog]) {
      expect(verdictCatalog(cat).rejected.trim().length).toBeGreaterThan(0);
      expect(verdictCatalog(cat).withheld.trim().length).toBeGreaterThan(0);
    }
  });

  it("the attribution templates keep their ICU placeholders in both locales", () => {
    for (const cat of [csCatalog, enCatalog]) {
      expect(verdictCatalog(cat).by).toContain("{kdo}");
      expect(verdictCatalog(cat).byOn).toContain("{kdo}");
      expect(verdictCatalog(cat).byOn).toContain("{kdy}");
    }
  });
});
