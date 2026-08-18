import { describe, expect, it } from "vitest";
import { formatFact } from "./graphLoader";

/* Probe for `hardcoded-label-bypasses-catalog` (one-validation-door). formatFact
 * threads `locale` into number/currency formatting but returned a hardcoded
 * Czech `ano`/`ne` for booleans — so a boolean fact (bill/company
 * flagged_conflict) rendered as Czech inside the English NodeInspector.
 * Display-only: the content hash is computed at HASH_LOCALE='cs', so localising
 * display does not move permalink hashes. */

describe("formatFact boolean localisation", () => {
  it("renders booleans in Czech for the cs locale", () => {
    expect(formatFact("flagged_conflict", true, "cs")).toBe("ano");
    expect(formatFact("flagged_conflict", false, "cs")).toBe("ne");
  });

  it("renders booleans in English for the en locale (was hardcoded Czech)", () => {
    expect(formatFact("flagged_conflict", true, "en")).toBe("yes");
    expect(formatFact("flagged_conflict", false, "en")).toBe("no");
  });

  it("falls back to the default locale for an unknown locale", () => {
    expect(formatFact("flagged_conflict", true, "de")).toBe("ano"); // defaultLocale = cs
  });

  it("still returns null for empty values and leaves non-booleans unchanged", () => {
    expect(formatFact("x", null, "en")).toBeNull();
    expect(formatFact("x", "", "en")).toBeNull();
    expect(formatFact("origin", "vláda", "en")).toBe("vláda");
  });
});
