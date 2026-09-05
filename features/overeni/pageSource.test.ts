// Plocha /overeni — co její zdroják NESMÍ obsahovat, připnuto grepem přes zdroj
// (v repozitáři není jsdom; vzor features/civicscore/formattedNumbers.test.ts).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const PAGE = stripComments(readFileSync("features/overeni/OvereniPage.tsx", "utf8"));

describe("otisková rodina pojmenuje svůj algoritmus sama (2026-09-05, parity-auditor)", () => {
  it("brána nesází jméno hashe literálem — bere HASH_ALGORITHM rodiny, kterou ověřuje", () => {
    // /graf/p i exponát exportují HASH_ALGORITHM a obě plochy ho sází z konstanty;
    // brána měla „fnv-1a/32“ opsané. Změna algoritmu v rodině by tu tiskla starý název.
    expect(PAGE).not.toMatch(/fnv-1a/);
    expect(PAGE).toMatch(/HASH_ALGORITHM/);
  });
});
