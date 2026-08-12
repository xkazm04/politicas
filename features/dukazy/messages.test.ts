// Katalog kopie Deníku důkazů, připíchnutý — týž tvar jako u sesterského
// Deníku republiky (features/denik/messages.test.ts).
//
// Věstník brány tiskne JEDNO číslo o sobě samém — kolik řádků review_audit
// prošlo — a čte ho se stropem, u kterého repozitář sám varuje, že useknuté
// čtení „publikuje špatné číslo". Od 2026-08-12 to plocha umí vyslovit a
// zároveň vede z každého rozhodnutí do dne, ve kterém totéž rozhodnutí nese
// druhý deník platformy. Obě věci musí být v obou jazycích.

import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { isCzechSafe } from "@/lib/analysis/language-gate";
import { DECISION_KEYS } from "./deriveFeed";

type Ns = Record<string, unknown>;

function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.dukazy as Ns);
const en = flatten(enCatalog.dukazy as Ns);

function variables(s: string): string[] {
  return [...new Set([...s.matchAll(/\{\s*(\w+)[,}]/g)].map((m) => m[1]))].sort();
}

/** Only PAIRED tags are `t.rich` tags — `anchorsNote` documents the anchor
 *  shape as literal text (`#z-<id>`), which ICU renders verbatim. */
function richTags(s: string): string[] {
  return [...new Set([...s.matchAll(/<(\w+)>(?=[\s\S]*?<\/\1>)/g)].map((m) => m[1]))].sort();
}

/** The RENDERED words: ICU markup out, and machine identifiers out too —
 *  `review_audit` and `kg_node bill.forensic_*` are the record's own column
 *  names, cited verbatim in both locales, and the stopword classifier scores
 *  `bill`/`node` as English (measured: `entry.sourceForensic` fails the gate on
 *  those two tokens alone). An identifier must carry a `.` or `_` BETWEEN two
 *  word characters, so no prose word can be swallowed by this. */
const prose = (s: string) =>
  s.replace(/\{[^{}]*\}/g, " ").replace(/[\p{L}\d]+(?:[._][\p{L}\d]+)+/gu, " ");

const keys = Object.keys(cs).sort();

describe("dukazy message catalog", () => {
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
      if (/,\s*(plural|select|selectordinal)\s*,/.test(cs[k])) continue;
      expect(isCzechSafe(prose(cs[k])), k).toBe(true);
    }
  });

  it("every gated decision the pure module can emit has a sentence in both locales", () => {
    // deriveFeed vrací KLÍČE, plocha překládá — klíč bez věty by rozhodnutí
    // vykreslil prázdné.
    for (const key of Object.values(DECISION_KEYS)) {
      expect(cs[key], key).toBeTruthy();
      expect(en[key], key).toBeTruthy();
    }
  });
});

/* ── počet rozhodnutí, který je jen spodní mez ──────────────────────────────── */

describe("section.sourceFloor — the audit figure when the read hit its cap", () => {
  it("declares the sentence in both locales", () => {
    expect(cs["section.sourceFloor"]).toBeTruthy();
    expect(en["section.sourceFloor"]).toBeTruthy();
  });

  it("names the cap as a value, never as a literal number", () => {
    expect(variables(cs["section.sourceFloor"])).toEqual(["cap"]);
    expect(variables(en["section.sourceFloor"])).toEqual(["cap"]);
    expect(cs["section.sourceFloor"]).not.toMatch(/10\s?000/);
  });

  it("says the figure beside it is a floor, not a count of decisions", () => {
    expect(cs["section.sourceFloor"]).toMatch(/spodní mez/);
    expect(cs["section.sourceFloor"]).toMatch(/ne počet|není počet/);
    expect(en["section.sourceFloor"]).toMatch(/floor/i);
    expect(en["section.sourceFloor"]).toMatch(/not a count/i);
  });

  it("does not restate the unqualified source line", () => {
    expect(cs["section.sourceFloor"]).not.toBe(cs["section.source"]);
  });
});

/* ── dva deníky, které na sebe vedou ────────────────────────────────────────── */

describe("denikLink / entry.denikDay — the two journals point at each other", () => {
  it("declares the header link in both locales", () => {
    expect(cs["denikLink"]).toBeTruthy();
    expect(en["denikLink"]).toBeTruthy();
  });

  it("the per-record link offers a DAY, not just the other journal", () => {
    // Adresa je filtr entity + kotva dne; kdyby věta slibovala jen „deník",
    // čtenář by nevěděl, že přistane přesně na dni toho rozhodnutí.
    expect(cs["entry.denikDay"]).toMatch(/den/);
    expect(en["entry.denikDay"]).toMatch(/\bday\b/i);
    expect(cs["entry.denikDay"]).not.toBe(cs["denikLink"]);
  });

  it("the accessible name of the per-record link names its subject", () => {
    // Bez subjektu by čtečka přečetla desítky totožných odkazů „ten den v deníku".
    expect(variables(cs["entry.denikDayAria"])).toEqual(["subject"]);
    expect(variables(en["entry.denikDayAria"])).toEqual(["subject"]);
  });
});
