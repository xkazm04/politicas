// The /zebricek copy catalog must stay complete in BOTH locales. Czech-first means the
// Czech string is the source of truth — but a key that exists only in cs.json renders
// its own key name to an English reader, and a key that exists only in en.json is dead
// weight nobody notices. Five such dead keys (distributionSource, allSource, mockNote,
// componentLegendNote, legendWidthNote) survived in both catalogs with ZERO call sites
// until 2026-08-04, one of them still claiming the chamber was in its 9th term.
import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

const csNs: Record<string, string> = csCatalog.civicscore;
const enNs: Record<string, string> = enCatalog.civicscore;
const csKeys = Object.keys(csNs).sort();
const enKeys = Object.keys(enNs).sort();

/** `{name}` / `{count}` placeholders a string declares, as a sorted set. */
function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

describe("civicscore message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(csKeys).toEqual(enKeys);
  });

  it("each key declares the same ICU placeholders in both locales", () => {
    for (const k of csKeys) {
      expect(placeholders(enNs[k]), k).toEqual(placeholders(csNs[k]));
    }
  });

  it("states the term the loader actually reads (PSP10 = the tenth), not the ninth", () => {
    expect(csNs.lead).toContain("10. období");
    expect(enNs.lead).toContain("10th term");
    for (const ns of [csNs, enNs]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} still claims the 9th term`).not.toMatch(/9\. období|9th term/);
      }
    }
  });

  it("cites no methodology version — the real six-component index carries none", () => {
    for (const ns of [csNs, enNs]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} cites a methodology version that does not exist`).not.toMatch(/v1\.\d/);
      }
    }
  });
});

// Provenience skóre je čtenáři obrácená věta o tom, ČÍM byla čísla spočítána — a
// přesně tahle třída kopie už třikrát dojela na plochu anglicky
// (memory/reader-facing-loaders-need-the-language-gate.md). Proto je připnutá k bráně,
// ne svěřená úsudku.
describe("civicscore — provenience skóre je česky a nese obě linie", () => {
  const KEYS = ["provenanceNote", "provenanceMismatch", "provenanceMixed", "provenanceAbsent"];

  it("každý klíč existuje v obou katalozích", () => {
    for (const k of KEYS) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });

  it("česká věta neprojde jako anglická (jazyková brána)", () => {
    for (const k of KEYS) expect(looksEnglish(csNs[k]), `cs.${k}`).toBe(false);
  });

  it("věta o rozporu pojmenuje uloženou I deklarovanou linii — nikdy jen jednu", () => {
    expect(placeholders(csNs.provenanceMismatch)).toEqual(["codeRef", "dataRef"]);
  });

  it("věta o smíšeném grafu přiznává počet verzí i pokrytí, ne jedno číslo pasu", () => {
    expect(placeholders(csNs.provenanceMixed)).toEqual(["count", "total", "withProv"]);
  });
});
