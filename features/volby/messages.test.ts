// The /volby copy catalog, pinned — the discipline features/profile/messages.test.ts
// established, applied to the election mirror. Three things this surface's copy must
// never do: drift between locales (a key added in Czech and forgotten in English), let
// an English sentence sit in the Czech catalog, and ACCUSE. A finding is a question for
// the council, the board or the ministry — the catalog is where that voice is enforced.

import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { scoreLanguage } from "@/lib/analysis/language-gate";
import { RULE_REF } from "@/lib/analysis/volby/rules";
import { PAGE_SECTIONS } from "@/features/shell/navModel";

function flatten(ns: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    if (typeof v === "string") out[`${prefix}${k}`] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}${k}.`));
  }
  return out;
}

const cs = flatten(csCatalog.volby as Record<string, unknown>);
const en = flatten(enCatalog.volby as Record<string, unknown>);
const csMeta = csCatalog.meta as unknown as Record<string, string>;
const enMeta = enCatalog.meta as unknown as Record<string, string>;
const csLanding = flatten((csCatalog.landing as Record<string, unknown>).volby as Record<string, unknown>);
const enLanding = flatten((enCatalog.landing as Record<string, unknown>).volby as Record<string, unknown>);

const placeholders = (s: string): string[] => [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();

describe("volby message catalog", () => {
  it("cs and en declare exactly the same keys (volby, landing.volby, meta.volby*)", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(csLanding).sort()).toEqual(Object.keys(enLanding).sort());
    const metaKeys = (m: Record<string, string>) => Object.keys(m).filter((k) => k.startsWith("volby")).sort();
    expect(metaKeys(csMeta)).toEqual(metaKeys(enMeta));
    expect(metaKeys(csMeta).length).toBeGreaterThan(5);
  });

  it("no key is empty in either locale", () => {
    for (const ns of [cs, en, csLanding, enLanding]) {
      for (const [k, v] of Object.entries(ns)) expect(v.trim(), k).not.toBe("");
    }
  });

  it("each key declares the same ICU placeholders in both locales", () => {
    for (const k of Object.keys(cs)) expect(placeholders(en[k]), k).toEqual(placeholders(cs[k]));
    for (const k of Object.keys(csLanding)) expect(placeholders(enLanding[k]), k).toEqual(placeholders(csLanding[k]));
    for (const k of Object.keys(csMeta).filter((x) => x.startsWith("volby"))) {
      expect(placeholders(enMeta[k]), k).toEqual(placeholders(csMeta[k]));
    }
  });

  it("every finding kind, severity, valence, review state and later-fact kind has a label", () => {
    for (const kind of Object.keys(RULE_REF)) expect(cs[`kind.${kind}`], kind).toBeTruthy();
    for (const s of ["low", "medium", "high"]) expect(cs[`severity.${s}`], s).toBeTruthy();
    for (const v of ["negative", "positive", "unrated"]) expect(cs[`valence.${v}`], v).toBeTruthy();
    for (const r of ["verified", "pending_review", "deterministic"]) expect(cs[`review.${r}`], r).toBeTruthy();
    for (const l of ["fate_sb", "forensic_verdict", "collision_detected", "flags_computed"]) expect(cs[`later.${l}`], l).toBeTruthy();
    for (const a of ["komunalni", "krajske", "statni", "nejasne"]) expect(cs[`census.arena.${a}`], a).toBeTruthy();
    for (const b of ["komunalni", "krajske", "snemovni"]) expect(cs[`ballot.${b}`], b).toBeTruthy();
  });

  it("the finding kind labels are the ones the design brief fixed", () => {
    expect(cs["kind.tender_konvejer"]).toBe("Dopravník zakázek");
    expect(cs["kind.tender_dvorni_dodavatel"]).toBe("Dvorní dodavatel");
    expect(cs["kind.tender_cisty_radar"]).toBe("Čistý radar");
    expect(cs["kind.law_posudek"]).toBe("Posudek");
    expect(cs["kind.law_sponsor_conflict"]).toBe("Střet sponzora s penězi");
    expect(cs["kind.law_became_law_clean"]).toBe("Zákon prošel bez střetu");
    expect(cs["kind.effort_workhorse"]).toBe("Tahoun");
    expect(cs["kind.effort_rapporteur"]).toBe("Zpravodajský tahoun");
    expect(cs["kind.money_ties_unrated"]).toBe("Vazby bez posouzení");
  });

  it("the rail's /volby anchors point at keys that exist", () => {
    const all = flatten(csCatalog as unknown as Record<string, unknown>);
    for (const s of PAGE_SECTIONS["/volby"]) expect(all[s.labelKey], s.labelKey).toBeTruthy();
    expect(PAGE_SECTIONS["/volby"]).toHaveLength(5);
  });

  it("no sentence accuses — findings are questions, never verdicts", () => {
    // The voice is „otázky pro zastupitele / radu / ministerstvo". A word from this
    // list in the catalog is a verdict the data cannot carry (three of four sources
    // are pending_review), so it fails the build rather than reaching a reader.
    const ACCUSATION = /\b(korup\w*|podvod\w*|zloči\w*|trestn\w*|vin(en|na|ni|ík)\w*|zloděj\w*|krad\w*|corrupt\w*|fraud\w*|crim\w*|guilty|thie\w*|steal\w*|stole\w*)\b/i;
    for (const ns of [cs, en, csLanding, enLanding]) {
      for (const [k, v] of Object.entries(ns)) expect(v, `${k}: „${v}“`).not.toMatch(ACCUSATION);
    }
    for (const [k, v] of Object.entries(csMeta).filter(([x]) => x.startsWith("volby"))) {
      expect(v, k).not.toMatch(ACCUSATION);
    }
  });

  it("the copy never promises a composite score", () => {
    // The words may appear only in a negation („žádný souhrnný index", „no composite
    // index", „…se nepočítá") — a sentence that names one without denying it is a promise.
    const NAMES = /(souhrnn\w+ (skóre|index)|composite (score|index))/i;
    const DENIES = /(žádný|bez|nepočítá|\bno\b|\bnot\b|\bnever\b)/i;
    for (const ns of [cs, en, csLanding, enLanding]) {
      for (const [k, v] of Object.entries(ns)) {
        if (NAMES.test(v)) expect(DENIES.test(v), `${k}: „${v}“`).toBe(true);
      }
    }
  });

  it("the nepropojeno sentence says the nejasne bodies are NOT localised to this obec", () => {
    expect(cs["obec.unlinkedBody"]).toMatch(/celostátní počet/);
    expect(cs["obec.unlinkedBody"]).toMatch(/NEJSOU lokalizované/);
    expect(en["obec.unlinkedBody"]).toMatch(/NOT localised/);
  });

  it("a Czech sentence does not pass as English (language gate)", () => {
    for (const [k, v] of Object.entries(cs)) {
      if (/(Source|source)$/.test(k)) continue; // citations are joins of dataset names
      const prose = v.replace(/\{[^}]*\}/g, " ");
      if (prose.split(/\s+/).filter(Boolean).length < 8) continue;
      expect(scoreLanguage(prose).looksEnglish, `cs.${k}: ${v.slice(0, 60)}`).toBe(false);
    }
  });
});
