// /rozpocty — přístupnost, připnutá GREPEM PŘES ZDROJ (vzor features/shell/a11y.test.ts).
//
// Poctivá mezera stejná jako u ostatních a11y testů v repozitáři: bez jsdom se
// dokazuje, že zapojení ve ZDROJI je — ne že strom, který z něj vznikne, čte
// odečítačka tak, jak si přejeme.
//
// CO TU BYLO ŽIVÉ do 2026-09-05: §02 „Vývoj dluhu" je recharts <svg> bez
// jediného textového ekvivalentu — čtenář odečítačky dostal prázdný obrázek
// mezi dvěma tabulkami, které naopak `aria-labelledby` MAJÍ (§03, §04). Obal
// grafu teď nese `role="img"` + `aria-label` složený z KATALOGOVÝCH klíčů, které
// plocha už sází (titulek sekce + řádek „plná čára = obec · čárkovaná =
// medián"), takže popis grafu říká totéž, co vidí zrakový čtenář, v obou jazycích.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync("features/budget/BudgetMirrorPage.tsx", "utf8");

/** Zdroj bez komentářů — hlavička souboru popisuje, CO se opravovalo, a nesmí
 *  sama žádné tvrzení tohohle testu splnit ani vyvrátit. */
function stripComments(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const SRC = stripComments(PAGE);

describe("§02 debt-trend chart has a text alternative", () => {
  it("the ResponsiveContainer sits inside a wrapper with role=\"img\" and a catalog-derived aria-label", () => {
    const wrapperIdx = SRC.indexOf("<ResponsiveContainer");
    expect(wrapperIdx).toBeGreaterThan(0);
    // The element that opens immediately before the chart is its wrapper.
    const before = SRC.slice(Math.max(0, wrapperIdx - 600), wrapperIdx);
    const openTag = before.slice(before.lastIndexOf("<div"));
    expect(openTag).toMatch(/role="img"/);
    expect(openTag).toMatch(/aria-label=\{[^}]*\bt\("section2Title"\)/);
    expect(openTag).toMatch(/section2Aside/);
  });

  it("both data tables keep their aria-labelledby (the standard the chart is now held to)", () => {
    expect(SRC).toMatch(/<table aria-labelledby="skupina-nadpis"/);
  });
});
