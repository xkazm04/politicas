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

/**
 * ICU plural/select SCAFFOLDING removed, branch prose KEPT (2026-08-13).
 *
 * `limits.withheld` became the namespace's first ICU plural in the same pass
 * that made it load-bearing — it is the sentence disclosing the 141 forensic
 * verdicts the journal withholds. The old gate SKIPPED any key containing a
 * plural, so that sentence would have entered the catalog ungated on the day it
 * was written. The scaffolding is stripped instead (the /denik precedent), so
 * every branch still has to read as Czech.
 */
const stripIcuScaffolding = (s: string) =>
  s
    .replace(/\{\s*\w+\s*,\s*(?:plural|selectordinal|select)\s*,\s*/g, " ")
    .replace(/(?:^|[\s}])(?:=\d+|zero|one|two|few|many|other)\s*\{/g, " ");

/** The RENDERED words: ICU markup out, and machine identifiers out too —
 *  `review_audit` and `kg_node bill.forensic_*` are the record's own column
 *  names, cited verbatim in both locales, and the stopword classifier scores
 *  `bill`/`node` as English (measured: `entry.sourceForensic` fails the gate on
 *  those two tokens alone). An identifier must carry a `.` or `_` BETWEEN two
 *  word characters, so no prose word can be swallowed by this. */
const prose = (s: string) =>
  stripIcuScaffolding(s)
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[\p{L}\d]+(?:[._][\p{L}\d]+)+/gu, " ");

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
    // NO plural/select escape hatch: `prose` strips the ICU KEYWORDS and leaves
    // every branch's words in, so a plural key is gated exactly like a flat one.
    for (const k of keys) {
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

/* ── co věstník zadržel, se počítá ──────────────────────────────────────────── */

describe("limits.* — fronta u brány a tři degradace, které mlčely", () => {
  it("declares every sentence the pure module can emit, in both locales", () => {
    // Klíč bez věty by přiznanou mez vykreslil prázdnou — tedy zas potichu.
    for (const k of [
      "limits.withheld",
      "limits.forensicUnread",
      "limits.tieSourcesUnread",
      "limits.labelsUnread",
      "limits.nothingWithheld",
      "section.sourceNoForensic",
    ]) {
      expect(cs[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
    }
  });

  it("the withheld sentence carries its COUNT as a value, never as a literal", () => {
    // 141 posudků je dnešní stav korpusu, ne konstanta produktu.
    expect(variables(cs["limits.withheld"])).toEqual(["n", "nFmt", "states"]);
    expect(variables(en["limits.withheld"])).toEqual(["n", "nFmt", "states"]);
    expect(cs["limits.withheld"]).not.toMatch(/\b141\b/);
    expect(en["limits.withheld"]).not.toMatch(/\b141\b/);
  });

  it("the Czech withheld sentence agrees with its numeral (one/few/other)", () => {
    // Bez plurálu by věta byla „čeká 2 forenzních posudků" — a je to nejčastěji
    // čtená disclosure věta téhle plochy.
    for (const cat of ["one", "few", "other"]) {
      expect(cs["limits.withheld"], cat).toMatch(new RegExp(`\\b${cat}\\s*\\{`));
    }
  });

  it("an unread layer says which FIDELITY was lost, not that nothing exists", () => {
    // „Nepodařilo se přečíst" a „žádný není" jsou dvě různá tvrzení.
    expect(cs["limits.forensicUnread"]).toMatch(/nepodařilo/);
    expect(cs["limits.forensicUnread"]).toMatch(/není to tvrzení/);
    expect(cs["limits.tieSourcesUnread"]).toMatch(/nepodařilo/);
    expect(cs["limits.labelsUnread"]).toMatch(/nepodařilo/);
    expect(en["limits.forensicUnread"]).toMatch(/could not be read/i);
    expect(en["limits.forensicUnread"]).toMatch(/not a claim that none exists/i);
  });

  it("the source line has a variant that does NOT cite an unread layer", () => {
    expect(cs["section.source"]).toMatch(/bill\.forensic/);
    expect(cs["section.sourceNoForensic"]).toMatch(/nepodařilo/);
    expect(en["section.sourceNoForensic"]).toMatch(/could not be read/i);
    expect(variables(cs["section.sourceNoForensic"])).toEqual(["rows"]);
    expect(variables(en["section.sourceNoForensic"])).toEqual(["rows"]);
  });

  it("the empty state no longer asserts that nothing is suppressed", () => {
    // Tenhle absolutní literál byl vyvrácen vlastním požadavkem stránky.
    expect(cs["empty.note"]).not.toMatch(/zamlčen/);
    expect(en["empty.note"]).not.toMatch(/suppressed/i);
    // Počet řádků je teď hodnota, ne natvrdo napsaná nula.
    expect(variables(cs["empty.note"])).toEqual(["rows"]);
    expect(variables(en["empty.note"])).toEqual(["rows"]);
    expect(cs["empty.note"]).not.toMatch(/—\s*0\s/);
  });

  it("the ONLY sentence claiming nothing is withheld is the derived one", () => {
    const claims = keys.filter((k) => /zamlčen|nezadržuje/.test(cs[k]));
    expect(claims).toEqual(["limits.nothingWithheld"]);
  });
});

/* ── řetěz brány: pořadí a nedotčenost, ne správnost ────────────────────────── */

describe("chain.* — publikovaný řetěz a to, co NEDOKAZUJE", () => {
  it("declares the position, the unchained sentence and the note in both locales", () => {
    for (const k of ["chain.pos", "chain.unchained", "chain.note"]) {
      expect(cs[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
    }
    expect(variables(cs["chain.pos"])).toEqual(["pos"]);
    expect(variables(en["chain.pos"])).toEqual(["pos"]);
  });

  it("says what the fingerprint proves — and, explicitly, what it does not", () => {
    expect(cs["chain.note"]).toMatch(/POŘADÍ|pořadí/);
    expect(cs["chain.note"]).toMatch(/Nedokazuje/);
    expect(cs["chain.note"]).toMatch(/správn/);
    expect(en["chain.note"]).toMatch(/order/i);
    expect(en["chain.note"]).toMatch(/does not prove/i);
  });

  it("an unchained row is stated, never given an invented position", () => {
    expect(cs["chain.unchained"]).toMatch(/místo nemá/);
    expect(en["chain.unchained"]).toMatch(/no place/i);
  });
});

/* ── kudy se dá rozhodnutí ověřit ───────────────────────────────────────────── */

describe("verification affordances — nikdy do konzole za tokenem", () => {
  it("the method paragraph points at the PUBLIC data page, not /admin", () => {
    // /admin je za ADMIN_TOKENem a robots.ts ho zakazuje procházet — jako cesta
    // k ověření to byla slepá ulička.
    expect(richTags(cs["method.body"])).toEqual(["data"]);
    expect(richTags(en["method.body"])).toEqual(["data"]);
    for (const k of keys) {
      expect(cs[k], k).not.toMatch(/\/admin/);
      expect(en[k], k).not.toMatch(/\/admin/);
    }
  });

  it("the machine-readable chain head is offered through a rich tag", () => {
    expect(richTags(cs["chain.note"])).toEqual(["manifest"]);
    expect(richTags(en["chain.note"])).toEqual(["manifest"]);
  });

  it("the per-record receipt and company file name their subject in the a11y name", () => {
    // Bez subjektu by čtečka přečetla desítky totožných „trvalá účtenka".
    for (const k of ["entry.receiptAria", "entry.companyFileAria"]) {
      expect(variables(cs[k]), k).toEqual(["subject"]);
      expect(variables(en[k]), k).toEqual(["subject"]);
    }
    expect(cs["entry.receipt"]).toBeTruthy();
    expect(cs["entry.companyFile"]).toBeTruthy();
    expect(cs["entry.receipt"]).not.toBe(cs["entry.companyFile"]);
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
