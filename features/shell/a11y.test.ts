// Chrom aplikace — přístupnost, připnutá GREPEM PŘES ZDROJ.
//
// POCTIVÁ MEZERA, stejná jako u features/votetrack/a11y.test.ts,
// features/money/console.a11y.test.ts a features/civicscore/a11y.test.ts:
// tenhle repozitář nemá jsdom ani testing-library, takže grep dokazuje, že
// zapojení ve ZDROJI je — ne že strom, který z něj vznikne, čte odečítačka
// tak, jak si přejeme. Chování prohlížeče (že `tabIndex={-1}` skutečně
// přesune fokus, ne jen odroluje) je vlastnost prohlížeče, ne tohohle testu.
//
// CO TU BYLO ŽIVÉ do 2026-08-13: lišta stojí v DOM PŘED obsahem a v celé
// aplikaci nebyl JEDINÝ přeskakovací odkaz — na každé z ~23 nebarevných rout
// musel čtenář ovládající aplikaci klávesnicí projít nejméně 13 a nejvýš ~23
// zastávek tabulátoru, než se dostal k textu. Orientační body přitom byly
// v pořádku už dřív; chyběl jedině prvek, kterým se mezi nimi dá skočit.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import cs from "@/messages/cs.json";
import en from "@/messages/en.json";

const SHELL = readFileSync("features/shell/AppShell.tsx", "utf8");

/** Zdroj bez komentářů — hlavička souboru popisuje, CO se opravovalo, a nesmí
 *  sama žádné tvrzení tohohle testu splnit ani vyvrátit. */
const CODE = SHELL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("přeskočit na obsah", () => {
  it("odkaz existuje a míří na kotvu obsahu", () => {
    expect(CODE, "chrom nemá přeskakovací odkaz").toMatch(/href="#obsah"/);
  });

  it("stojí v DOM PŘED lištou — jinak se lišta přeskočit nedá", () => {
    const link = CODE.indexOf('href="#obsah"');
    const sidebar = CODE.indexOf("<Sidebar");
    expect(link).toBeGreaterThan(-1);
    expect(sidebar).toBeGreaterThan(-1);
    expect(link, "odkaz se propadl za lištu, kterou má přeskakovat").toBeLessThan(sidebar);
  });

  it("cíl je zaostřitelný, ne jen odrolovatelný", () => {
    // Bez `tabIndex={-1}` Firefox i Safari odrolují, ale fokus nechají v liště:
    // další tabulátor pak pokračuje v navigaci, ne v textu.
    expect(CODE).toMatch(/id="obsah"[^>]*tabIndex=\{-1\}/);
  });

  it("je vidět při fokusu a neexistuje pro myš", () => {
    const anchor = CODE.slice(CODE.indexOf('href="#obsah"'), CODE.indexOf("<Sidebar"));
    expect(anchor, "odkaz není skrytý — pro myš se nemá kreslit").toMatch(/\bsr-only\b/);
    expect(anchor, "odkaz se při fokusu nezviditelní, takže ho nikdo neuvidí").toMatch(
      /\bfocus:not-sr-only\b/,
    );
    expect(anchor, "chybí domácí kobaltový prstenec fokusu").toMatch(/focus:outline-cobalt/);
  });

  it("popisek jde z katalogu, ne z literálu ve zdroji", () => {
    expect(CODE).toMatch(/\{t\("skipToContent"\)\}/);
  });

  it("popisek existuje v OBOU jazycích a není prázdný", () => {
    for (const [locale, cat] of [
      ["cs", cs],
      ["en", en],
    ] as const) {
      const v = (cat.nav as Record<string, unknown>).skipToContent;
      expect(typeof v, `${locale}: nav.skipToContent chybí`).toBe("string");
      expect((v as string).trim().length, `${locale}: nav.skipToContent je prázdný`).toBeGreaterThan(
        0,
      );
    }
  });

  it("holé routy vracejí obsah bez chromu, takže tam odkaz nevisí naprázdno", () => {
    // `/`, `/admin`, `/rentgen` a `/graf` si chrom nekreslí — přeskakovací
    // odkaz na plochu bez lišty by nabízel skok přes nic.
    expect(CODE).toMatch(/if \(bare\) return <>\{children\}<\/>;/);
  });
});
