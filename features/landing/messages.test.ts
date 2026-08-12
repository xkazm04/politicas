// Katalog TITULNÍ STRANY — první messages test téhle plochy (2026-08-12).
//
// Proč vznikl: fasáda je jediná stránka, kterou většina čtenářů uvidí, a přesto
// byla jediná bez připnutého katalogu. Dvě věty ji tím přežily o měsíce déle,
// než měly:
//
//   · `methodBody` slibovala „verzované váhy" a „citaci u každého PILÍŘE" —
//     čtyřpilířový model je smazaný (dole na téže stránce se vykresluje šest
//     složek indexu přispění) a číslo verze metodiky bylo přiznanou fikcí už
//     v SiteFooter.tsx („v1.4" byla fikce ukázky);
//   · `meta.rootDescription` — popis, který se lepí do každého sdílení a do
//     výsledků vyhledávání — sliboval „index efektivity pro každého českého
//     politika", ačkoli produkt počítá INDEX PŘISPĚNÍ nad 207 poslanci
//     10. období. Přesně tuhle třídu tvrzení opravil f9f4cf8 u
//     `meta.civicscoreDescription`; tenhle test drží, aby se nevrátila.
//
// Testuje se KATALOG, ne komponenta: obě věty jsou data a jejich chyba je
// chybou obsahu, ne renderu.

import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

/** Katalog fasády nese i vnořený `nav` objekt — sjednotíme na ploché klíče. */
function flatten(ns: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    if (typeof v === "string") out[`${prefix}${k}`] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}${k}.`));
  }
  return out;
}

const csNs = flatten(csCatalog.landing);
const enNs = flatten(enCatalog.landing);
const csKeys = Object.keys(csNs).sort();
const enKeys = Object.keys(enNs).sort();

/** `{name}` / `{count}` placeholdery, které řetězec deklaruje, jako setříděná množina. */
function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

describe("landing message catalog", () => {
  it("cs a en deklarují přesně tytéž klíče", () => {
    expect(csKeys).toEqual(enKeys);
  });

  it("každý klíč deklaruje v obou jazycích tytéž ICU placeholdery", () => {
    for (const k of csKeys) {
      expect(placeholders(enNs[k]), k).toEqual(placeholders(csNs[k]));
    }
  });

  it("žádná hodnota není prázdná", () => {
    for (const k of csKeys) {
      expect(csNs[k].trim(), `cs.${k}`).not.toBe("");
      expect(enNs[k].trim(), `en.${k}`).not.toBe("");
    }
  });
});

describe("landing — metoda mluví o šesti složkách, ne o pilířích a verzích", () => {
  it("methodBody nezmiňuje pilíř — ten model je smazaný", () => {
    expect(csNs.methodBody).not.toMatch(/pilíř|pilíre|pilířů/i);
    expect(enNs.methodBody).not.toMatch(/pillar/i);
  });

  it("methodBody neslibuje verzování vah — vzorec nese otisk, ne číslo verze", () => {
    expect(csNs.methodBody).not.toMatch(/verzovan/i);
    expect(enNs.methodBody).not.toMatch(/versioned/i);
  });

  it("methodBody pojmenuje šest zveřejněných složek, které se pod ním vykreslují", () => {
    expect(csNs.methodBody).toMatch(/šest/i);
    expect(enNs.methodBody).toMatch(/six/i);
  });

  it("žádný klíč fasády necituje neexistující verzi metodiky", () => {
    for (const ns of [csNs, enNs]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} cituje verzi metodiky, která neexistuje`).not.toMatch(/v1\.\d/);
      }
    }
  });
});

// Táž třída tvrzení jako `meta.rootDescription` níž, jen o patro výš: `lead` je
// PRVNÍ věta produktu (HeroStory) a slibovala „každou korunu veřejných peněz"
// a „skóre pro každého politika". Loadery měří 207 poslanců 10. období a smlouvy
// firem, které vlastní nebo řídí — ne rozpočet státu a ne všechny politiky.
describe("landing.lead — slibuje jen to, co loadery měří", () => {
  it("netvrdí, že pokrývá každou korunu veřejných peněz", () => {
    expect(csNs.lead).not.toMatch(/každ(á|ou) korun/i);
    expect(enNs.lead).not.toMatch(/every crown|every koruna/i);
  });

  it("netvrdí, že skóruje každého politika — index stojí nad poslanci sněmovny", () => {
    expect(csNs.lead).not.toMatch(/každého politika|všechny politiky/i);
    expect(enNs.lead).not.toMatch(/(each|every) politician/i);
  });

  it("pojmenuje index přispění a období, které loader skutečně čte", () => {
    expect(csNs.lead).toMatch(/index[uů]? přispění/i);
    expect(csNs.lead).toMatch(/10\. období/);
    expect(csNs.lead).not.toMatch(/9\. období/);
    expect(enNs.lead).toMatch(/contribution index/i);
    expect(enNs.lead).toMatch(/10th term/);
    expect(enNs.lead).not.toMatch(/9th term/);
  });
});

describe("meta.rootDescription — index přispění nad 207 poslanci, ne „index efektivity“", () => {
  const cs: string = csCatalog.meta.rootDescription;
  const en: string = enCatalog.meta.rootDescription;

  it("nemluví o indexu efektivity — produkt počítá index přispění", () => {
    expect(cs).not.toMatch(/efektivit/i);
    expect(en).not.toMatch(/effectiveness/i);
  });

  it("pojmenuje index přispění a jeho skutečné pokrytí (207 poslanců)", () => {
    expect(cs).toMatch(/index[uů]? přispění/i);
    expect(cs).toContain("207");
    expect(en).toMatch(/contribution index/i);
    expect(en).toContain("207");
  });

  it("uvádí období, které loader skutečně čte (PSP10 = desáté)", () => {
    expect(cs).toMatch(/10\. volebního období/);
    expect(en).toMatch(/10th parliamentary term/);
    expect(cs).not.toMatch(/9\. období|9\. volebního období/);
    expect(en).not.toMatch(/9th term|9th parliamentary term/);
  });
});

// Stav zdrojů je čtenáři obrácená věta o KVALITĚ DAT — přesně ta třída kopie,
// která už třikrát dojela na plochu anglicky
// (memory/reader-facing-loaders-need-the-language-gate.md).
describe("landing — rubrika Surový materiál je česky a přiznává nehodnocené", () => {
  const KEYS = [
    "sourcesSource",
    "sourcesUnavailable",
    "sourcesUnavailableBody",
    "sourcesUnavailableSource",
    "sourceCoverageUnrated",
    "sourceCompositeUnrated",
    "stalenessUnrated",
    "specimenNoClaim",
  ];

  it("každý klíč existuje v obou katalozích", () => {
    for (const k of KEYS) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });

  it("česká věta neprojde jako anglická (jazyková brána)", () => {
    for (const k of KEYS) expect(looksEnglish(csNs[k]), `cs.${k}`).toBe(false);
  });

  // Tyhle klíče se skládají za běhu ze STROJOVÝCH tokenů atlasu
  // (`čerstvé`/`stárnoucí`/`zastaralé`, `hodnoceno`/`částečné`/`nehodnoceno`),
  // takže je žádný grep přes `t("…")` nenajde — chybějící klíč by se projevil
  // až na vykreslené fasádě. Proto se existence pojistí tady.
  it("mapované strojové tokeny atlasu mají v obou katalozích svůj překlad", () => {
    const MAPPED = [
      "stalenessFresh",
      "stalenessAging",
      "stalenessStale",
      "sourceStatusRated",
      "sourceStatusPartial",
      "sourceStatusUnrated",
    ];
    for (const k of MAPPED) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });

  it("citace rubriky pojmenuje všechny čtyři dimenze i pravidlo o nehodnoceném", () => {
    for (const dim of ["pokrytí", "čerstvost", "integrita", "úplnost"]) {
      expect(csNs.sourcesSource.toLowerCase()).toContain(dim);
    }
    expect(csNs.sourcesSource).toMatch(/nikdy 0|nikdy nula/);
    expect(csNs.sourcesSource).toContain("/atlas");
    expect(enNs.sourcesSource).toContain("/atlas");
  });

  it("titulek rubriky už netvrdí, že jsou zdroje ověřené — tvrdí, že jsou změřené", () => {
    expect(csNs.sourcesCaption).not.toMatch(/ověřen/i);
    expect(enNs.sourcesCaption).not.toMatch(/verified/i);
  });
});
