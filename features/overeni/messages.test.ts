// Katalog /overeni musí být úplný v OBOU jazycích — a česky česky.
//
// Brána byla do 2026-08-04 jedinou jednojazyčnou plochou na trase, která
// začíná na dvojjazyčném /penize (odkaz „účtenka" u každé vazby) a vede přes
// /zdroj sem. Copy se přestěhovala do messages/{cs,en}.json, a tenhle test drží
// tři věci, které se jinak rozejdou tiše:
//   1. klíč, který nějaká větev kódu UMÍ vrátit, existuje v obou katalozích
//      (jinak čtenáři vypadne holý název klíče do 3xl titulku),
//   2. ICU placeholdery jsou v obou jazycích tytéž,
//   3. česká věta neprojde jako anglická (jazyková brána —
//      memory/reader-facing-loaders-need-the-language-gate.md).
import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { GATE_COPY_KEYS } from "./gateVocabulary";
import { GUIDE_COPY_KEYS } from "./guide";
import { VERDICT_COPY_KEYS } from "./verdict";

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

const csNs = flatten((csCatalog as Nested).overeni as Nested);
const enNs = flatten((enCatalog as Nested).overeni as Nested);
const csKeys = Object.keys(csNs).sort();
const enKeys = Object.keys(enNs).sort();

/** `{name}` placeholdery, jako setříděná množina. */
function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

/** `<tag>…</tag>` značky pro t.rich — musí sedět, jinak next-intl spadne. */
function tags(s: string): string[] {
  return [...new Set([...s.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();
}

describe("katalog /overeni", () => {
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
});

describe("katalog /overeni — pokrývá všechno, co čisté moduly umí vrátit", () => {
  const emitted = [...VERDICT_COPY_KEYS, ...GATE_COPY_KEYS, ...GUIDE_COPY_KEYS];

  it("každý klíč z verdict.ts / gateVocabulary.ts / guide.ts existuje v obou katalozích", () => {
    for (const k of emitted) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });

  it("nepřeložený strojový stav si vysází svůj token — v obou jazycích", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns["gate.unmapped"])).toEqual(["token"]);
      expect(placeholders(ns["gate.headlineUnmapped"])).toEqual(["token"]);
    }
  });
});

describe("česká copy /overeni prochází jazykovou branou", () => {
  it("žádná česká věta se nečte jako anglická", () => {
    for (const k of csKeys) {
      // Krátké strojové řetězce (kickery, jména datasetu) klasifikátor neumí
      // a ani nemá — brána je na VĚTY, které píšeme my.
      if (csNs[k].trim().split(/\s+/).length < 4) continue;
      expect(looksEnglish(csNs[k]), `cs.${k}`).toBe(false);
    }
  });
});

describe("copy verdiktu nesmí číst zamítnutí jako potvrzení", () => {
  // Akceptační mez směru 1: screenshot verdiktu zamítnuté vazby se nesmí dát
  // číst jako doporučení. Drží ji copy, ne jen barva — v obou jazycích.
  it("zamítnutý a nezkontrolovaný titulek nezačíná potvrzením", () => {
    expect(csNs["verdict.headlineZdrojRejected"]).toContain("zamítla");
    expect(csNs["verdict.headlineZdrojRejected"]).not.toContain("Ověřeno");
    expect(csNs["verdict.headlineZdrojPending"]).not.toContain("Ověřeno");
    expect(enNs["verdict.headlineZdrojRejected"]).toContain("rejected");
    expect(enNs["verdict.headlineZdrojRejected"]).not.toMatch(/^Verified/);
    expect(enNs["verdict.headlineZdrojPending"]).not.toMatch(/^Verified/);
  });

  it("hrana potvrzená člověkem drží NEZESLABENÉ „ověřeno“", () => {
    expect(csNs["verdict.headlineZdrojVerified"]).toContain("Ověřeno");
    expect(enNs["verdict.headlineZdrojVerified"]).toMatch(/^Verified/);
  });

  it("naše plocha bez citace se neoznačí za cizí odkaz", () => {
    expect(csNs["verdict.leadAppRoute"]).toContain("naše stránka");
    expect(csNs["verdict.leadAppRoute"]).toContain("/zdroj/");
    expect(enNs["verdict.leadAppRoute"]).toContain("our page");
    expect(csNs["verdict.leadAppRoute"]).not.toBe(csNs["verdict.leadUnsupported"]);
  });

  it("ilustrační příklady se v obou jazycích PŘIZNAJÍ jako ilustrace", () => {
    for (const k of csKeys.filter((x) => x.includes("Illustrative"))) {
      expect(csNs[k].toLowerCase(), `cs.${k}`).toMatch(/ilustra|tvar adresy|nedá načíst/);
      expect(enNs[k].toLowerCase(), `en.${k}`).toMatch(/illustrat|shape of|cannot be loaded/);
    }
  });
});
