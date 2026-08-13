/*
 * JEDNA HRANICE, JEDNA ADRESA.
 *
 * `plausible-date.ts` říká ve své vlastní hlavičce, proč je sdílený: „aby
 * hranice byla v celé aplikaci jedna a stejná." Přesto si `PLAUSIBLE_FROM`
 * do 2026-08-13 znovu deklaroval `features/dashboard/datedFacts.ts` — a deník
 * (`features/denik/deriveDenik.ts`) si ji importoval PŘES NĚJ, takže konstanta,
 * jejímž jediným smyslem je, že je jedna, měla dvě adresy a dva skoky.
 *
 * `plausible-date.test.ts` testuje čisté pravidlo a záměrně žádného
 * spotřebitele. Tohle je ta druhá polovina: že žádný spotřebitel nemá vlastní
 * kopii. Kdyby ji měl, rozešly by se v tichosti — konstanta se nemění často,
 * a proto si toho nikdo nevšimne dřív než čtenář.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PLAUSIBLE_FROM } from "./plausible-date";

/**
 * Zdroj BEZ komentářů — precedens `features/money/console.a11y.test.ts`:
 * soubor, který o pravidle jen VYPRÁVÍ ve své hlavičce, ho nesmí ani splnit,
 * ani shodit. (Tenhle test na to sám narazil: komentář vysvětlující, co tu
 * dřív stálo, obsahoval `"1993-01-01"` a kontrolu literálu shodil.)
 */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const CONSUMERS = [
  "features/dashboard/datedFacts.ts",
  "features/denik/deriveDenik.ts",
  "features/money/moneyLoader.ts",
  "features/money/getCompanyDetail.ts",
  "features/budget/supplierTrail.ts",
];

describe("PLAUSIBLE_FROM — deklarace je právě jedna", () => {
  it("žádný spotřebitel si hranici nedeklaruje sám", () => {
    for (const path of CONSUMERS) {
      const src = code(path);
      expect(src, path).not.toMatch(/(const|let|var)\s+PLAUSIBLE_FROM\s*=/);
      // A ani ji neopisuje jako literál — to je ta druhá cesta k rozchodu.
      expect(src, path).not.toContain(`"${PLAUSIBLE_FROM}"`);
    }
  });

  it("každý spotřebitel ji bere z modulu, který ji vlastní — ne přes odbočku", () => {
    for (const path of CONSUMERS) {
      const src = code(path);
      // Buď PLAUSIBLE_FROM, nebo některá z funkcí, které ji uvnitř uplatňují.
      const usesRule = /plausibleIsoDateOrNull|isPlausibleIsoDate|PLAUSIBLE_FROM/.test(src);
      expect(usesRule, path).toBe(true);
      // Import smí vést JEN na kanonický modul.
      const imports = [...src.matchAll(/import \{[^}]*\} from "([^"]*plausible-date[^"]*)"/g)].map((m) => m[1]);
      expect(imports.length, path).toBeGreaterThan(0);
      for (const spec of imports) expect(spec, path).toMatch(/(@\/lib\/analysis|\.)\/plausible-date$/);
      // Přes datedFacts se hranice nikdy nesmí brát znovu.
      expect(src, path).not.toMatch(/import \{[^}]*PLAUSIBLE_FROM[^}]*\} from "@\/features\/dashboard\/datedFacts"/);
    }
  });

  it("hodnota se sjednocením NEZMĚNILA — tohle je dedup, ne oprava", () => {
    // Kdyby se pohnula, /dashboard a /denik by začaly počítat jiná data za
    // nemožná a jejich přiznávací počítadla (`droppedImplausible`) by mlčky
    // změnila význam.
    expect(PLAUSIBLE_FROM).toBe("1993-01-01");
  });

  it("`features/profile/careerSpine.ts` zůstává doloženou výjimkou", () => {
    // PSP1 předchází vzniku ČR, takže rejstříková éra má vlastní, ZDŮVODNĚNOU
    // mez. Test ji drží jako výjimku pojmenovanou v kódu, aby se z ní nestal
    // další tichý fork.
    const src = code("features/profile/careerSpine.ts");
    expect(src).toMatch(/PSP_ERA_FROM/);
    expect(src).not.toMatch(/(const|let|var)\s+PLAUSIBLE_FROM\s*=/);
  });
});
