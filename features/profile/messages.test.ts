// The /poslanec copy catalog, pinned — the discipline `features/civicscore/
// messages.test.ts` established, applied to the surface politicas.md calls "the real
// product". The spis had no such test while carrying ~120 keys, and the three failures
// pinned below are the ones its own history has already produced elsewhere: a key added
// in Czech and forgotten in English, a plural placeholder that drifts between locales,
// and a sentence that asserts a review state the data no longer supports.

import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { scoreLanguage } from "@/lib/analysis/language-gate";

const cs = csCatalog.profile as unknown as Record<string, string>;
const en = enCatalog.profile as unknown as Record<string, string>;

const placeholders = (s: string): string[] =>
  [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();

/** `<own>…</own>` — the rich-text tags `t.rich` must find in BOTH catalogs. */
const tags = (s: string): string[] =>
  [...new Set([...s.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();

describe("profile message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("no key is empty in either locale", () => {
    for (const [k, v] of Object.entries(cs)) expect(v.trim(), `cs.${k}`).not.toBe("");
    for (const [k, v] of Object.entries(en)) expect(v.trim(), `en.${k}`).not.toBe("");
  });

  it("each key declares the same ICU placeholders and rich tags in both locales", () => {
    for (const k of Object.keys(cs)) {
      expect(placeholders(en[k]), k).toEqual(placeholders(cs[k]));
      expect(tags(en[k]), k).toEqual(tags(cs[k]));
    }
  });

  it("does not assert that every money tie is still pending", () => {
    // The gate can be written now (/penize/kontrola), so any sentence claiming the
    // whole corpus is unreviewed becomes false on the first confirmation. The section
    // renders per-tie state from the data instead; the copy may only say that an
    // UNDECIDED tie is not a finding.
    for (const ns of [cs, en]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} asserts a whole-corpus review state`).not.toMatch(
          /(všechny|všech) \d+ vazeb|all \d+ ties/i,
        );
      }
    }
  });

  it("the money figure and the score both offer a human verification address", () => {
    for (const ns of [cs, en]) {
      expect(ns.moneyVerifyFigure).toBeTruthy();
      expect(ns.verifyScore).toBeTruthy();
      expect(ns.moneyReceiptLink).toBeTruthy();
      expect(ns.moneyCompanyLink).toBeTruthy();
    }
  });

  it("every empty/unavailable state has copy in both locales", () => {
    // The distinction these keys carry is the brand rule itself: „we found nothing"
    // and „we could not read" must never render as the same sentence.
    for (const ns of [cs, en]) {
      for (const k of [
        "moneyEmptyTitle",
        "moneyEmptyBody",
        "moneyUnavailableTitle",
        "moneyUnavailableBody",
        "rebelInstancesNone",
        "rebelInstancesUnavailable",
        "rebelInstancesPending",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
    }
  });

  it("no Czech sentence reads as English", () => {
    // The same stopword gate the analysis copy is held to, asserted the way that gate
    // is actually defined: `looksEnglish`. It is deliberately NOT the inverse claim —
    // a citation like „registr smluv ⋈ ares ⋈ hlídač — klíč: IČO" carries no stopwords
    // at all, and demanding a positive Czech verdict from a keyword list would fail on
    // strings that are perfectly correct. What must never happen is an English
    // sentence sitting in the Czech catalog.
    for (const [k, v] of Object.entries(cs)) {
      // ICU plural/select markup is English BY SPEC (`one` / `few` / `other`), so a
      // message built out of it scores as English no matter how Czech its sentences
      // are. Those keys are skipped rather than the classifier being loosened for
      // everyone — the branch bodies are pinned by the placeholder test above.
      if (/,\s*(plural|select|selectordinal)\s*,/.test(v)) continue;
      // Citations are not prose either: a source note is a JOIN of dataset names,
      // column names and module paths („zdroj: absentee_manager_lead
      // (lib/analysis/contribution.ts)…"), and every identifier in it is English by
      // construction. The measured lesson from /penize is the same one — the gate
      // binds the copy WE write, not the evidence we show.
      if (/(Source|Aside)$/.test(k)) continue;
      if (v.replace(/\{[^}]*\}/g, " ").split(/\s+/).filter(Boolean).length < 8) continue;
      expect(scoreLanguage(v).looksEnglish, `cs.${k}: ${v.slice(0, 60)}`).toBe(false);
    }
  });
});
