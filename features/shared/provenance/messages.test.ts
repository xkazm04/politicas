// Katalog účtenky (`shared.receipt.*`) musí být úplný v OBOU jazycích — a
// česky česky.
//
// /zdroj je nejcitovanější adresa produktu (každá peněžní vazba na /penize na
// ni ukazuje) a do 2026-08-12 byla jedinou katalogovou plochou BEZ vlastního
// testu katalogu: chybějící anglický klíč by čtenáři vysázel holý název klíče
// doprostřed dokladu. Vzor je features/overeni/messages.test.ts — tytéž tři
// kontroly (parita klíčů, parita ICU/t.rich, neprázdné hodnoty) plus jazyková
// brána nad českou prózou a akceptační meze směru „doklad mluví, i když zmizel".
import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { REL_LABELS_CS, relLabelKey } from "./receipt";

type Nested = Record<string, unknown>;

/** Ploché „a.b" klíče celého podstromu. */
function flatten(obj: Nested, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Nested, key));
  }
  return out;
}

const csShared = (csCatalog as Nested).shared as Nested;
const enShared = (enCatalog as Nested).shared as Nested;
const csNs = flatten(csShared.receipt as Nested);
const enNs = flatten(enShared.receipt as Nested);
const csKeys = Object.keys(csNs).sort();
const enKeys = Object.keys(enNs).sort();

function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

function tags(s: string): string[] {
  return [...new Set([...s.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();
}

describe("katalog účtenky (shared.receipt)", () => {
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

  it("každá známá relace má v obou katalozích svou větu", () => {
    for (const rel of Object.keys(REL_LABELS_CS)) {
      const key = relLabelKey(rel);
      expect(key, rel).not.toBeNull();
      // relLabelKey vrací klíč včetně prefixu „receipt." — namespace je `shared`.
      const local = key!.replace(/^receipt\./, "");
      expect(csNs[local], `cs.${local}`).toBeTruthy();
      expect(enNs[local], `en.${local}`).toBeTruthy();
    }
  });
});

describe("česká copy účtenky prochází jazykovou branou", () => {
  it("žádná česká věta se nečte jako anglická", () => {
    for (const k of csKeys) {
      // Krátké strojové řetězce (kickery, značka plochy) klasifikátor neumí a
      // ani nemá — brána je na VĚTY, které píšeme my.
      if (csNs[k].trim().split(/\s+/).length < 4) continue;
      expect(looksEnglish(csNs[k]), `cs.${k}`).toBe(false);
    }
  });
});

describe("zaniklá účtenka má co říct", () => {
  // Akceptační mez: čtenář, který přišel po citaci na adresu, kterou dnešní
  // graf nenese, musí PŘEČÍST, co tvrdila — a rozeznat, který koncový bod v
  // grafu ještě je. Bez těchhle tří vět je stránka base64 blob.
  it("obě katalogy nesou nadpis tvrzení i obě věty o koncovém uzlu", () => {
    for (const [ns, lang] of [
      [csNs, "cs"],
      [enNs, "en"],
    ] as const) {
      expect(ns["page.goneClaimKicker"], `${lang}.page.goneClaimKicker`).toBeTruthy();
      expect(ns["page.goneNodeHere"], `${lang}.page.goneNodeHere`).toBeTruthy();
      expect(ns["page.goneNodeMissing"], `${lang}.page.goneNodeMissing`).toBeTruthy();
      // „je" a „není" se nesmějí sejít v jedné větě — to je celý jejich smysl.
      expect(ns["page.goneNodeHere"]).not.toBe(ns["page.goneNodeMissing"]);
    }
  });

  it("poslední zaznamenaná verze se nesází jako dnešní tvrzení", () => {
    for (const [ns, lang] of [
      [csNs, "cs"],
      [enNs, "en"],
    ] as const) {
      // oba okamžiky, každý s vlastním datem
      expect(placeholders(ns["page.lastRecorded"]), `${lang}.page.lastRecorded`).toEqual(["date"]);
      expect(placeholders(ns["page.lastSuperseded"]), `${lang}.page.lastSuperseded`).toEqual(["date"]);
      expect(ns["page.lastRecorded"]).not.toBe(ns["page.lastSuperseded"]);
      // a věta, která z archivované verze nedělá tvrzení
      expect(ns["page.lastNote"], `${lang}.page.lastNote`).toBeTruthy();
      expect(ns["page.lastSource"], `${lang}.page.lastSource`).toBeTruthy();
    }
  });
});

describe("banner „k tomu dni“ rozlišuje, co neví", () => {
  // Akceptační mez směru #10: tři různá „tenhle den ti neukážeme" nesmějí
  // splynout v jednu větu. `absentThen` (záznamy jsme vedli, tohle mezi nimi
  // nebylo), `beforeEpoch` (tak daleko zpátky nevedeme nic) a `refused` (to
  // nebyl den) jsou tři různá zjištění a čtou se různě.
  const NOT_TODAY = ["absentThen", "beforeEpoch", "beforeEpochUnknown", "refused"] as const;

  it("každý stav má v obou katalozích vlastní, neprázdnou a navzájem různou větu", () => {
    for (const [ns, lang] of [
      [csNs, "cs"],
      [enNs, "en"],
    ] as const) {
      const sentences = [...NOT_TODAY, "at"].map((s) => {
        const v = ns[`asOf.${s}`];
        expect(v, `${lang}.asOf.${s}`).toBeTruthy();
        return v;
      });
      expect(new Set(sentences).size, lang).toBe(sentences.length);
      expect(ns["asOf.kicker"], `${lang}.asOf.kicker`).toBeTruthy();
    }
  });

  it("stavy, pod kterými stojí DNEŠNÍ záznam, to musí říct", () => {
    // Bez téhle věty čtenář odejde s dojmem, že takhle to tehdy vypadalo — a
    // to je přesně ta chyba, kterou banner existuje odchytit.
    for (const s of NOT_TODAY) {
      expect(csNs[`asOf.${s}`], `cs.asOf.${s}`).toMatch(/DNEŠNÍ/);
      expect(enNs[`asOf.${s}`], `en.asOf.${s}`).toMatch(/TODAY/);
    }
    // `at` je jediný stav, kde je pod bannerem archivovaná verze
    expect(csNs["asOf.at"]).not.toMatch(/DNEŠNÍ/);
    expect(enNs["asOf.at"]).not.toMatch(/TODAY's record/);
  });

  it("každá věta drží své ICU placeholdery", () => {
    expect(placeholders(csNs["asOf.at"])).toEqual(["day"]);
    expect(placeholders(csNs["asOf.absentThen"])).toEqual(["day"]);
    expect(placeholders(csNs["asOf.beforeEpoch"])).toEqual(["day", "epoch"]);
    expect(placeholders(csNs["asOf.beforeEpochUnknown"])).toEqual(["day"]);
    expect(placeholders(csNs["asOf.refused"])).toEqual(["raw"]);
  });
});

describe("zaniklá účtenka má co říct (pokračování)", () => {
  it("nedostupný store neposílá čtenáře do provozního velína", () => {
    // backHref je „/" (app/zdroj/[ref]/page.tsx) — popisek to musí říkat, jinak
    // se odkaz čte jako cesta do /dashboard, kam externí čtenář nepatří.
    expect(csNs["unavailable.back"]).not.toMatch(/velín/i);
    expect(enNs["unavailable.back"]).not.toMatch(/control room/i);
  });
});
