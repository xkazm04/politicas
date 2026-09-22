import { describe, expect, it } from "vitest";
import { asciiFold } from "../normalize";
import { classifyEmploymentCoi, COI_SECTORS, SELF_REFERENTIAL_STEMS } from "./volby";

/* The classifier folds the OCCUPATION to ASCII and then tests each stem with a leading
 * `\b`. A stem that itself carries a diacritic can therefore never match anything
 * ("voják" against folded "vojak"), and a stem with a typo matches nothing either:
 * `bankez` / `bankeř` were the finance sector's banker stems, `asciiFold("bankéř")` is
 * "banker", so a banker on the budget committee was structurally undetectable — the
 * P42 lesson applied to the stem list itself (2026-09-06, scan-sweep, bounty-hunter). */

describe("COI stems are fold-idempotent and distinct (2026-09-06, bounty-hunter)", () => {
  it("every stem is already ASCII-folded — a stem with a diacritic can never match", () => {
    for (const def of COI_SECTORS) {
      for (const stem of def.stems) expect(asciiFold(stem), `${def.sector}: ${stem}`).toBe(stem);
    }
    for (const stem of SELF_REFERENTIAL_STEMS) expect(asciiFold(stem)).toBe(stem);
  });

  it("no sector lists the same stem twice", () => {
    for (const def of COI_SECTORS) expect(new Set(def.stems).size, def.sector).toBe(def.stems.length);
  });

  it("a banker on the budget committee is a finance hit (was unreachable: stem `bankez`)", () => {
    const hits = classifyEmploymentCoi(5, "Test Bankéř", "bankéř", [{ abbrev: "RV" }]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ sector: "finance_budget", matchedStem: "banker" });
  });
});
