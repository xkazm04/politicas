// Katalog kopie Deníku republiky, připíchnutý — táž kázeň, jakou zavedl
// features/money/messages.test.ts a po něm /zakony, spis a VoteTrack.
//
// Deník byl do 2026-08-12 dvojjazyčnou plochou BEZ testu zpráv, a přitom právě
// tady se od téhož dne tisknou dvě věty, které jdou datově vyvrátit: přiznání
// stropu lidské brány (počet rozhodnutí je pak SPODNÍ MEZ, ne počet) a přiznání
// stropu proudu „zaznamenáno" (čte se od nejnovějších, takže useknutí bere
// nejstarší historii). Obě musí být v obou jazycích, obě musí být česky psané a
// ani jedna nesmí slíbit opravu.

import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { isCzechSafe } from "@/lib/analysis/language-gate";

type Ns = Record<string, unknown>;

/** Flattens `denik.limits.auditTruncated` → one dotted key per leaf string. */
function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.denik as Ns);
const en = flatten(enCatalog.denik as Ns);

/** Named ICU variables only — never the word content of a plural's branches. */
function variables(s: string): string[] {
  return [...new Set([...s.matchAll(/\{\s*(\w+)[,}]/g)].map((m) => m[1]))].sort();
}

/** `t.rich` tag names — a tag in one locale and not the other throws at render.
 *  Only PAIRED tags count: `anchorsNote` documents the anchor shape as literal
 *  text (`#d-<datum>` / `#d-<date>`), and an unpaired `<…>` is exactly what ICU
 *  renders verbatim — reading it as a tag would report a difference that has no
 *  render-time consequence and force the two locales to name one placeholder
 *  in one language. */
function richTags(s: string): string[] {
  return [...new Set([...s.matchAll(/<(\w+)>(?=[\s\S]*?<\/\1>)/g)].map((m) => m[1]))].sort();
}

/** The RENDERED words of a Czech sentence: ICU markup stripped (the reader sees
 *  „1 234", never „rows") and machine identifiers stripped too — `review_audit`,
 *  `change_event`, `kg_node bill.forensic_*` are the record's OWN column names,
 *  cited verbatim in both locales, and the stopword classifier scores tokens
 *  like `bill` and `node` as English. Nothing that could hide English prose is
 *  removed: an identifier must carry a `.` or `_` between two word characters. */
const prose = (s: string) =>
  s.replace(/\{[^{}]*\}/g, " ").replace(/[\p{L}\d]+(?:[._][\p{L}\d]+)+/gu, " ");

const keys = Object.keys(cs).sort();

describe("denik message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(keys).toEqual(Object.keys(en).sort());
  });

  it("declares the same ICU variables in both locales", () => {
    for (const k of keys) expect(variables(en[k]), k).toEqual(variables(cs[k]));
  });

  it("declares the same t.rich tags in both locales", () => {
    for (const k of keys) expect(richTags(en[k]), k).toEqual(richTags(cs[k]));
  });

  it("declares no empty value in either locale", () => {
    for (const k of keys) {
      expect(cs[k]?.trim(), k).toBeTruthy();
      expect(en[k]?.trim(), k).toBeTruthy();
    }
  });

  it("every Czech sentence passes the Czech-language gate", () => {
    for (const k of keys) {
      // ICU plural/select markup is English BY SPEC (`one`/`few`/`other`).
      if (/,\s*(plural|select|selectordinal)\s*,/.test(cs[k])) continue;
      expect(isCzechSafe(prose(cs[k])), k).toBe(true);
    }
  });

  it("carries no internal pipeline jargon in reader-facing copy", () => {
    for (const k of keys) {
      expect(cs[k], k).not.toMatch(/\bdávka\s*\d/i);
      expect(cs[k], k).not.toMatch(/\bbatch\b|\bpass\s*\d/i);
    }
  });
});

/* ── strop, který se přizná ─────────────────────────────────────────────────── */

describe("limits.auditTruncated — the gate figure is a FLOOR when the read stopped", () => {
  // /denik i /dukazy tisknou počet rozhodnutí brány jako délku pole, které se
  // čte s tvrdým stropem; repozitář sám varuje, že useknuté čtení „publikuje
  // špatné číslo". Do 2026-08-12 to nešlo z plochy zjistit vůbec.
  it("declares the sentence in both locales", () => {
    expect(cs["limits.auditTruncated"]).toBeTruthy();
    expect(en["limits.auditTruncated"]).toBeTruthy();
  });

  it("names the cap it stopped at, as a value — never a literal", () => {
    // Číslo v katalogu by se rozešlo s konstantou, na které se čte
    // (poučení PUBLISHED_WEIGHTS_LABEL) — proto proměnná.
    expect(variables(cs["limits.auditTruncated"])).toEqual(["cap"]);
    expect(variables(en["limits.auditTruncated"])).toEqual(["cap"]);
    expect(cs["limits.auditTruncated"]).not.toMatch(/10\s?000/);
  });

  it("says the published figure is a lower bound, not a count", () => {
    expect(cs["limits.auditTruncated"]).toMatch(/nejméně/);
    expect(cs["limits.auditTruncated"]).toMatch(/ne celkový počet|není počet/);
    expect(en["limits.auditTruncated"]).toMatch(/at least/i);
    expect(en["limits.auditTruncated"]).toMatch(/not a total|not a count/i);
  });

  it("promises no repair — a cap is a disclosure, not a fix", () => {
    expect(cs["limits.auditTruncated"]).not.toMatch(/oprav(íme|eno|ili)|doplníme/i);
    expect(en["limits.auditTruncated"]).not.toMatch(/\bwe will\b|\bsoon\b/i);
  });
});

describe("limits.changesTruncated — the „recorded“ stream loses its OLDEST rows", () => {
  it("declares the sentence in both locales", () => {
    expect(cs["limits.changesTruncated"]).toBeTruthy();
    expect(en["limits.changesTruncated"]).toBeTruthy();
  });

  it("names the cap AND how many were actually read", () => {
    expect(variables(cs["limits.changesTruncated"])).toEqual(["cap", "n"]);
    expect(variables(en["limits.changesTruncated"])).toEqual(["cap", "n"]);
  });

  it("says WHICH end is lost — the read is ordered, so the loss is systematic", () => {
    expect(cs["limits.changesTruncated"]).toMatch(/nejnovějš/);
    expect(cs["limits.changesTruncated"]).toMatch(/nejstarš/);
    expect(en["limits.changesTruncated"]).toMatch(/newest/i);
    expect(en["limits.changesTruncated"]).toMatch(/oldest/i);
  });

  it("reads differently from the gate-cap sentence next door", () => {
    expect(cs["limits.changesTruncated"]).not.toBe(cs["limits.auditTruncated"]);
    expect(en["limits.changesTruncated"]).not.toBe(en["limits.auditTruncated"]);
  });
});

/* ── ukazatel, který má adresu, je odkaz ────────────────────────────────────── */

describe("entryRow.evidenceAria — the gate row links its twin in /dukazy", () => {
  it("declares the label in both locales and names the record it opens", () => {
    expect(variables(cs["entryRow.evidenceAria"])).toEqual(["label", "value"]);
    expect(variables(en["entryRow.evidenceAria"])).toEqual(["label", "value"]);
    expect(cs["entryRow.evidenceAria"]).toMatch(/důkaz/i);
    expect(en["entryRow.evidenceAria"]).toMatch(/evidence journal/i);
  });
});
