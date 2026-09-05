// Čísla jdou do DOM i do ICU věty UŽ ZFORMÁTOVANÁ (lib/format.ts přes useFormat).
// Připnuto GREPEM PŘES ZDROJ.
//
// CO TU BYLO ŽIVÉ do 2026-09-05: tři místa v tomhle kontextu sázela číslo bez
// formátovací autority — panel vývoje tiskl surové počty (`{s.v.prior} → {s.v.current}`;
// vystoupení v sále přesahují tisíc, takže Čech četl „1234“ místo „1 234“),
// kandidátka kraje dávala body a váhu do ICU věty jako čísla (next-intl je pak
// protáhne vlastním Intl.NumberFormat mimo jedinou formátovací autoritu — přesně
// to, co RapporteurBadge v komentáři zakazuje) a odchylka od mediánu v žebříčku
// šla do DOM jako `{Math.abs(best.delta)}`. Pravidlo je jedno (docs/DESIGN.md,
// custom/no-raw-number-display míří jen na toFixed/toLocale*, tenhle tvar nevidí).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const TREND = stripComments(readFileSync("features/civicscore/components/TrendPanel.tsx", "utf8"));
const KRAJ = stripComments(readFileSync("features/civicscore/KrajPage.tsx", "utf8"));
const TABLE = stripComments(readFileSync("features/civicscore/components/LeaderboardTable.tsx", "utf8"));

describe("no bare count reaches the DOM or an ICU sentence", () => {
  it("TrendPanel prints the raw activity counts through f.int", () => {
    expect(TREND).not.toMatch(/\{s\.v\.prior\}/);
    expect(TREND).not.toMatch(/\{s\.v\.current\}/);
    expect(TREND).toMatch(/f\.int\(s\.v\.prior\)/);
    expect(TREND).toMatch(/f\.int\(s\.v\.current\)/);
  });

  it("KrajPage hands the pillar points and weight to the ICU sentence already formatted", () => {
    const start = KRAJ.indexOf('t("krajBarItem"');
    const site = KRAJ.slice(start, KRAJ.indexOf(".join(", start));
    expect(site).toMatch(/points:\s*f\.dec\(/);
    expect(site).toMatch(/weight:\s*f\.int\(/);
  });

  it("LeaderboardTable prints the standout delta through f.int", () => {
    expect(TABLE).not.toMatch(/\{Math\.abs\(best\.delta\)\}/);
    expect(TABLE).toMatch(/f\.int\(Math\.abs\(best\.delta\)\)/);
  });
});
