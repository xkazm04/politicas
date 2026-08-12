// Fasáda mluví z katalogu, ne ze zdrojáku (2026-08-12).
//
// PROČ TENHLE TEST EXISTUJE: dvě rubriky titulní strany — DenikTeaser a
// ReferendumTeaser — vznikly s poznámkou „copy česky přímo zde (messages/*.json
// je mimo plochu)", tedy jako dočasná výjimka. Ta výjimka přežila obě dávky,
// kvůli kterým vznikla, a anglický čtenář dostal na PRVNÍ stránce produktu
// pětatřicet českých vět: „Zápis se načítá…", „otevřít tuhle čočku", „Nastav si
// váhy sám", aria-label „Dnešní zápis". Katalog o nich nevěděl, takže je
// neviděla ani kontrola parity, ani jazyková brána.
//
// Testuje se GREPEM přes zdroj, ne renderem: repozitář nemá jsdom ani
// testing-library (týž důvod a týž precedens jako motion.test.ts vedle).
//
// ── ROZSAH A VÝJIMKY, vypsané ────────────────────────────────────────────────
// ROZSAH: každý `.tsx` v `features/landing/components/` (odvozeno ze složky, ne
//   vypsáno — nová rubrika spadne pod pravidlo sama). Testy nejsou zdroj plochy.
// NEHLÍDÁ SE:
//   · komentáře (řádkové i blokové) — repozitář píše komentáře česky záměrně,
//     a ten záměr tenhle test nemá rušit;
//   · `import`/`export … from` řádky — cesty mohou nést cokoli;
//   · řetězec v pozici KLÍČE objektu (`"čerstvé": "stalenessFresh"`). To je
//     STROJOVÝ TOKEN datové vrstvy (atlas kvality píše pásma česky), ne copy,
//     kterou jsme napsali. Pravidlo je STRUKTURNÍ, ne seznam schválených
//     souborů: český řetězec jako HODNOTA nebo jako text v JSX je copy, český
//     řetězec jako klíč mapy je token, který přišel z dat.
//   · `console.*` — hlášky pro vývojáře nejsou plocha;
//   · VERZÁLKOVÁ ZKRATKA bez mezery („IČO") — je to JMÉNO rejstříkového klíče,
//     ne věta. Vysází se v obou jazycích stejně (týž důvod, proč ho /penize
//     nechává v dlaždici nepřeložený). Pravidlo je opět strukturní: cokoli
//     s malým písmenem nebo s mezerou je věta a hlídá se.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS = "features/landing/components";

/** Znaky, které v anglickém řetězci nestojí — levný a spolehlivý detektor češtiny. */
const CZECH = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;

function componentSources(): string[] {
  return readdirSync(COMPONENTS)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => join(COMPONENTS, f).replace(/\\/g, "/"))
    .sort();
}

/** Verzálková zkratka bez mezery („IČO") je jméno, ne věta — v obou jazycích táž. */
const isAbbreviation = (s: string) => !/\p{Ll}/u.test(s) && !/\s/.test(s);

/** Zdroj bez komentářů, importů a vývojářských hlášek — zbude to, co se vykreslí. */
function renderableSource(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ") // blokové komentáře (včetně {/* … */})
    .replace(/^[ \t]*\/\/.*$/gm, " ") // celořádkové komentáře
    .replace(/^[ \t]*(?:import|export)\b[^;]*?from\s+["'][^"']*["'];?[ \t]*$/gm, " ")
    .replace(/console\.\w+\([^)]*\)/g, " ");
}

/** České řetězcové literály, které NEJSOU klíčem objektu. */
function czechStringLiterals(src: string): string[] {
  const out: string[] = [];
  for (const m of renderableSource(src).matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1(\s*:)?/g)) {
    const [, , body, asKey] = m;
    if (asKey) continue; // klíč mapy = strojový token datové vrstvy
    const text = body.trim();
    if (CZECH.test(text) && !isAbbreviation(text)) out.push(text);
  }
  return out;
}

/** Český text stojící přímo v JSX (mezi `>` a `<`, bez závorek a značek). */
function czechJsxText(src: string): string[] {
  const out: string[] = [];
  for (const m of renderableSource(src).matchAll(/>([^<>{}]*)</g)) {
    const text = m[1].trim();
    if (text.length > 0 && CZECH.test(text) && !isAbbreviation(text)) out.push(text);
  }
  return out;
}

describe("fasáda — rubriky titulní strany nesázejí českou copy ze zdrojáku", () => {
  it("rozsah se odvozuje ze složky a není prázdný", () => {
    const sources = componentSources();
    expect(sources.length).toBeGreaterThan(5);
    expect(sources).toContain(`${COMPONENTS}/DenikTeaser.tsx`);
    expect(sources).toContain(`${COMPONENTS}/ReferendumTeaser.tsx`);
  });

  it("žádný komponent fasády nenese český řetězcový literál", () => {
    const offenders: Record<string, string[]> = {};
    for (const path of componentSources()) {
      const hits = czechStringLiterals(readFileSync(path, "utf8"));
      if (hits.length > 0) offenders[path] = hits;
    }
    expect(offenders, "česká copy patří do messages/{cs,en}.json").toEqual({});
  });

  it("žádný komponent fasády nenese český text přímo v JSX", () => {
    const offenders: Record<string, string[]> = {};
    for (const path of componentSources()) {
      const hits = czechJsxText(readFileSync(path, "utf8"));
      if (hits.length > 0) offenders[path] = hits;
    }
    expect(offenders, "česká copy patří do messages/{cs,en}.json").toEqual({});
  });

  it("strojový token v pozici klíče mapy se nehlásí — a hodnota vedle něj ano", () => {
    // Falzifikace vlastního pravidla: kdyby se rozlišení klíč/hodnota rozbilo,
    // buď by test začal hlásit DataSources.tsx (atlas píše pásma česky), nebo
    // by přestal chytat větu, kvůli které vznikl.
    const sample = `const M: Record<string, string> = { "čerstvé": "stalenessFresh" };`;
    expect(czechStringLiterals(sample)).toEqual([]);
    expect(czechStringLiterals(`const s = "Zápis se načítá…";`)).toEqual(["Zápis se načítá…"]);
    expect(czechJsxText(`<p>Deník republiky</p>`)).toEqual(["Deník republiky"]);
    expect(czechJsxText(`<p>{t("denik.title")}</p>`)).toEqual([]);
    // Zkratka rejstříku projde, věta s malým písmenem ne — i když obě nesou háček.
    expect(czechJsxText(`<span>IČO</span>`)).toEqual([]);
    expect(czechJsxText(`<span>klíč IČO</span>`)).toEqual(["klíč IČO"]);
  });
});
