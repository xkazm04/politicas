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

  it("nedostupný store neposílá čtenáře do provozního velína", () => {
    // backHref je „/" (app/zdroj/[ref]/page.tsx) — popisek to musí říkat, jinak
    // se odkaz čte jako cesta do /dashboard, kam externí čtenář nepatří.
    expect(csNs["unavailable.back"]).not.toMatch(/velín/i);
    expect(enNs["unavailable.back"]).not.toMatch(/control room/i);
  });
});
