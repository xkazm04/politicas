/*
 * Katalog /data — první messages test téhle plochy (13 jiných features ho má).
 *
 * Proč teď: /data je vydávací stránka datové vrstvy a od 2026-08-13 na ní stojí
 * věty o ZTRÁTĚ výřezu — co ve staženém souboru není. Věta, která se rozejde s
 * druhým jazykem nebo si vysází holý klíč, je na téhle ploše totéž co špatné
 * číslo. Test drží čtyři věci, které se jinak rozejdou tiše:
 *   1. klíč existuje v obou katalozích (jinak čtenáři vypadne `download.cut.…`),
 *   2. ICU placeholdery a značky `t.rich` jsou v obou jazycích tytéž,
 *   3. česká věta se nečte jako anglická (jazyková brána —
 *      memory/reader-facing-loaders-need-the-language-gate.md),
 *   4. čísla, která zná KÓD (stropy výřezu, okno memoizace), se do vět dostávají
 *      jako parametry, ne jako literály — literál v katalogu se od kódu odpojí
 *      a nikdo se to nedozví.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { FEED_FAMILIES, MACHINE_ENDPOINTS } from "./feedIndex";

type Nested = Record<string, unknown>;

/** Ploché „a.b" klíče celého namespace. */
function flatten(obj: Nested, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Nested, key));
  }
  return out;
}

const csNs = flatten((csCatalog as Nested).dataReleases as Nested);
const enNs = flatten((enCatalog as Nested).dataReleases as Nested);
const csKeys = Object.keys(csNs).sort();
const enKeys = Object.keys(enNs).sort();

/** `{name}` placeholdery, jako setříděná množina. */
const placeholders = (s: string): string[] =>
  [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();

/** `<tag>…</tag>` značky pro t.rich — musí sedět, jinak next-intl spadne. */
const tags = (s: string): string[] => [...new Set([...s.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();

describe("katalog /data", () => {
  it("cs a en deklarují přesně tytéž klíče", () => {
    expect(csKeys).toEqual(enKeys);
  });

  it("každý klíč nese v obou jazycích tytéž ICU placeholdery a tytéž značky", () => {
    for (const k of csKeys) {
      expect(placeholders(enNs[k]), k).toEqual(placeholders(csNs[k]));
      expect(tags(enNs[k]), k).toEqual(tags(csNs[k]));
    }
  });

  it("žádná hodnota není prázdná", () => {
    for (const k of csKeys) {
      expect(csNs[k].trim().length, `cs.${k}`).toBeGreaterThan(0);
      expect(enNs[k].trim().length, `en.${k}`).toBeGreaterThan(0);
    }
  });

  it("každý klíč, o který si plocha řekne, v obou katalozích existuje", () => {
    // Zdrojový sken (vzor motion.test.ts / hardcodedCopy.test.ts): tenhle repozitář
    // nemá jsdom, takže se stránka nedá vykreslit — chybějící klíč by se poznal až
    // v prohlížeči, holou cestou `download.cut.…` místo věty.
    const src = readFileSync(
      fileURLToPath(new URL("./DataReleasesPage.tsx", import.meta.url)),
      "utf8",
    );
    const asked = [
      ...[...src.matchAll(/\bt(?:\.rich)?\(\s*"([^"]+)"/g)].map((m) => m[1]),
      // klíče předávané podkomponentám jako props (CutTable)
      ...[...src.matchAll(/(?:titleKey|keyColKey)="([^"]+)"/g)].map((m) => m[1]),
    ];
    expect(asked.length).toBeGreaterThan(40);
    for (const k of new Set(asked)) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });

  it("každý klíč, který vrací adresář odběrů, v obou katalozích existuje", () => {
    const emitted = [
      ...FEED_FAMILIES.flatMap((f) => [f.titleKey, f.carriesKey, ...(f.noteKey ? [f.noteKey] : [])]),
      ...MACHINE_ENDPOINTS.flatMap((e) => [e.titleKey, e.carriesKey]),
    ];
    for (const k of emitted) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });
});

describe("česká copy /data prochází jazykovou branou", () => {
  it("žádná česká věta se nečte jako anglická", () => {
    for (const k of csKeys) {
      // Krátké strojové řetězce (kickery, názvy sloupců, jména tabulek) klasifikátor
      // neumí a ani nemá — brána je na VĚTY, které píšeme my.
      if (csNs[k].trim().split(/\s+/).length < 4) continue;
      expect(looksEnglish(csNs[k]), `cs.${k}`).toBe(false);
    }
  });
});

/*
 * ZTRÁTA VÝŘEZU SE MUSÍ DÁT PŘEČÍST (2026-08-13).
 *
 * Stránka nabízela stažení větou „co si stáhnete dnes, můžete citovat" a
 * přiznávala jen STROP. Výřez je přitom abecední prefix, ne vzorek: na dnešním
 * korpusu v něm není ani jeden poslanec a ani jedna vazba `linked_to`. Tyhle
 * pojistky drží, že věty o ztrátě ze stránky nezmizí a že čísla v nich zůstanou
 * parametry.
 */
describe("copy o výřezu říká, co ve výřezu NENÍ", () => {
  const cut = (k: string) => `download.cut.${k}`;

  it("věty o chybějících druzích a vztazích existují a nesou seznam jmen", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns[cut("absentKinds")])).toEqual(["keys"]);
      expect(placeholders(ns[cut("absentRels")])).toEqual(["keys"]);
      expect(ns[cut("absentMeaning")].trim().length).toBeGreaterThan(0);
    }
  });

  it("pravidlo výřezu bere OBA stropy z kódu, ne z literálu", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns[cut("rule")])).toEqual(["edgeCap", "nodeCap"]);
    }
    expect(placeholders(csNs["methodology.body"])).toEqual(["edgeCap", "nodeCap"]);
  });

  it("velikost přiznává, jak dlouho může být stará — okno jde z kódu", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns["download.sizeNote"])).toEqual(["hours"]);
    }
  });

  it("nečitelný výřez má vlastní větu i vlastní citaci zdroje", () => {
    for (const ns of [csNs, enNs]) {
      expect(ns[cut("unavailable")].trim().length).toBeGreaterThan(0);
      expect(ns[cut("unavailableSource")].trim().length).toBeGreaterThan(0);
    }
  });

  it("žádná věta si nevysází počet řádků číslicí — čísla nese kód", () => {
    // Tvarové pravidlo, ne seznam výjimek: skupina tisíců (mezera nebo pevná
    // mezera mezi číslicemi) v katalogu je vždycky literál, který se od store
    // odpojí. Stropy, počty uzlů i korpus jdou přes ICU parametry.
    const thousands = /\d[\s ]\d{3}\b/;
    for (const k of csKeys) {
      expect(thousands.test(csNs[k]), `cs.${k}`).toBe(false);
      expect(thousands.test(enNs[k]), `en.${k}`).toBe(false);
    }
  });
});
