// The /zakony copy catalog, pinned — the same discipline `features/money/messages.test.ts`
// established. LawWatch had no colocated messages test before this file: the batch-017
// §-level sector-attribution block is the first surface here to carry reader-facing prose
// straight from a DERIVED, UNGATED ledger (the `verdictDisposition` sentences), so its own
// key parity, ICU placeholders and Czech-language discipline are pinned explicitly.
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { isCzechSafe } from "@/lib/analysis/language-gate";

type Ns = Record<string, unknown>;

/** Flattens `lawwatch.detail.sectorAttribution.heading` → one dotted key per leaf string. */
function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.lawwatch as Ns);
const en = flatten(enCatalog.lawwatch as Ns);
const csOvereni = flatten(csCatalog.overeni as Ns);
const enOvereni = flatten(enCatalog.overeni as Ns);

/** Named ICU variables only (`{name}` / `{name, plural, ...}` / `{name, ...}`), not the
 * word-content of a plural's category branches — a naive `\{(\w+)[^}]*\}` scan over
 * `{count, plural, one {tisk} few {tisky} other {tisků}}` would (wrongly) also capture
 * "tisk"/"tisky"/"tisků" as if they were variable names, and the two locales legitimately
 * choose different words per category. This regex anchors on the FIRST token after `{`. */
function variables(s: string): string[] {
  return [...new Set([...s.matchAll(/\{\s*(\w+)[,}]/g)].map((m) => m[1]))].sort();
}

describe("lawwatch message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("declares one sector label per token the batch-017 payload actually carries", () => {
    for (const sector of ["economy", "environment", "agriculture", "digital", "health"]) {
      expect(cs[`sector.${sector}`], sector).toBeTruthy();
      expect(en[`sector.${sector}`], sector).toBeTruthy();
    }
  });

  describe("forensicIndex", () => {
    const keys = Object.keys(cs).filter((k) => k.startsWith("forensicIndex."));

    it("is non-empty (the /zakony corpus index section)", () => {
      expect(keys.length).toBeGreaterThan(0);
    });

    it("declares the same ICU variables in both locales", () => {
      for (const k of keys) {
        expect(variables(en[k]), k).toEqual(variables(cs[k]));
      }
    });

    it("declares no empty value in either locale", () => {
      for (const k of keys) {
        expect(cs[k]?.trim(), k).toBeTruthy();
        expect(en[k]?.trim(), k).toBeTruthy();
      }
    });

    it("every sentence passes the Czech-language gate", () => {
      for (const k of keys) {
        // ICU plural/select markup is English BY SPEC (`one`/`few`/`other`), so a short
        // message built out of it scores as English however Czech its branches are. The
        // features/profile precedent applies: skip the key, never loosen the classifier.
        if (/,\s*(plural|select|selectordinal)\s*,/.test(cs[k])) continue;
        expect(isCzechSafe(cs[k]), k).toBe(true);
      }
    });

    it("states the census against the whole corpus in both the complete and partial case", () => {
      for (const k of ["forensicIndex.complete", "forensicIndex.partial"]) {
        expect(variables(cs[k]), k).toEqual(["billsFmt", "verdictsFmt"]);
      }
    });

    it("discloses a withheld verdict AS withheld, never as absent", () => {
      // The corpus's withheld strings stay in the graph; a sentence that reads „chybí"
      // would describe an absence the data does not carry. The one permitted form is
      // the explicit NEGATION — „zadrženo neznamená chybí" denies the absence, which
      // is the disclosure at its strongest, not a violation of it.
      expect(cs["forensicIndex.withheld"]).toMatch(/zadrž/i);
      expect(cs["forensicIndex.withheld"].replace(/neznamená chybí/gi, "")).not.toMatch(/chybí/i);
      expect(en["forensicIndex.withheld"]).toMatch(/withheld/i);
      expect(cs["forensicIndex.withheldNone"]).toMatch(/zadrž/i);
      expect(cs["forensicIndex.withheldBadge"]).toMatch(/zadrž/i);
    });

    it("prints the ordering rule and refuses a severity scale", () => {
      // Ordering by count/print number is neutral; ordering low→high would publish a
      // wrongdoing scale nobody issued. The copy has to say so, because the ordering is
      // invisible otherwise.
      expect(cs["forensicIndex.orderRule"]).toMatch(/řazení/i);
      expect(cs["forensicIndex.orderRule"]).toMatch(/závažnost/i);
      expect(en["forensicIndex.orderRule"]).toMatch(/ordering/i);
    });

    it("has no ungated-vocabulary copy of its own — it reads /overeni's", () => {
      // The corpus verdicts are analyst passes, not human-gate decisions. The sentence
      // for that fact lives ONCE (features/overeni/gateVocabulary.ts::GATE_UNGATED_KEY).
      for (const k of keys) expect(cs[k], k).not.toMatch(/lidskou branou neprochází/);
      expect(csOvereni["gate.ungated"]).toMatch(/lidsk(ou|é|ou branou)/);
    });

    it("carries no internal pipeline jargon in reader-facing copy", () => {
      for (const k of keys) {
        // The `source*` keys name the graph pass as a citable artifact id, the same way
        // `graphPass` does — the deliberate exception, as in sectorAttribution.source.
        if (k.startsWith("forensicIndex.source")) continue;
        expect(cs[k], k).not.toMatch(/\bdávka\s*\d/i);
        expect(cs[k], k).not.toMatch(/\bbatch\b|\bpass\s*\d/i);
      }
    });
  });

  describe("detail.sectorAttribution", () => {
    const keys = Object.keys(cs).filter((k) => k.startsWith("detail.sectorAttribution."));

    it("is non-empty (the block this file exists to pin)", () => {
      expect(keys.length).toBeGreaterThan(0);
    });

    it("declares the same ICU variables in both locales", () => {
      for (const k of keys) {
        expect(variables(en[k]), k).toEqual(variables(cs[k]));
      }
    });

    it("every sentence passes the Czech-language gate", () => {
      for (const k of keys) {
        expect(isCzechSafe(cs[k]), k).toBe(true);
      }
    });

    it("never renders a bare neutral lead: an ungated label exists beside the disposition", () => {
      // 2026-08-06: the ungated label is no longer a second copy under the lawwatch
      // namespace — BillDetail.tsx imports GATE_UNGATED_KEY from
      // features/overeni/gateVocabulary.ts and reads it from the `overeni` catalog, so this
      // catalog no longer declares `detail.sectorAttribution.ungated` at all.
      expect(cs["detail.sectorAttribution.ungated"]).toBeUndefined();
      expect(en["detail.sectorAttribution.ungated"]).toBeUndefined();
      expect(csOvereni["gate.ungated"]).toMatch(/lidsk(ou|é|ou branou)/);
      expect(enOvereni["gate.ungated"]).toMatch(/human gate/);
    });

    it("discloses a withheld disposition instead of silently dropping the flag", () => {
      // 2026-08-06 fix: a flag whose verdictDisposition fails the Czech/jargon gate is no
      // longer dropped whole (sectorAttribution.ts no longer returns null on that gate) — it
      // renders with company/sector/statute plus this sentence in place of the prose.
      expect(cs["detail.sectorAttribution.dispositionWithheld"]).toBeTruthy();
      expect(en["detail.sectorAttribution.dispositionWithheld"]).toBeTruthy();
      expect(cs["detail.sectorAttribution.dispositionWithheld"]).toMatch(/brán|zadrž/);
      expect(en["detail.sectorAttribution.dispositionWithheld"]).toMatch(/gate|withheld/);
    });

    it("states why a row has no §-list instead of silently omitting it", () => {
      expect(cs["detail.sectorAttribution.noParagraphsCensus"]).toBeTruthy();
      expect(cs["detail.sectorAttribution.noParagraphsFallback"]).toBeTruthy();
      expect(en["detail.sectorAttribution.noParagraphsCensus"]).toBeTruthy();
      expect(en["detail.sectorAttribution.noParagraphsFallback"]).toBeTruthy();
    });

    it("carries no internal pipeline jargon (batch/pass tokens) in reader-facing copy", () => {
      for (const k of keys) {
        // "dávka 017" inside the SourceNote citation is a deliberate exception — it names the
        // batch as a citable artifact id, the same way `graphPass`/`kg-pass:NN` do elsewhere.
        if (k === "detail.sectorAttribution.source") continue;
        expect(cs[k], k).not.toMatch(/\bdávka\s*\d/i);
        expect(cs[k], k).not.toMatch(/\bbatch\b|\bpass\s*\d/i);
      }
    });
  });
});
