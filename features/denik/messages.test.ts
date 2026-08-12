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
import { createTranslator } from "next-intl";

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

/**
 * ICU plural/select SCAFFOLDING removed, branch prose kept.
 *
 * The six `limits.*` counters became ICU plurals on 2026-08-12 (they were
 * ungrammatical at n=1 in both locales, and at 2–4 in Czech). Six other feature
 * suites answer a plural key by SKIPPING the Czech-language gate — the markup
 * keywords (`plural`, `one`, `few`, `other`) are English by spec. Skipping here
 * would have retired the gate over six of the journal's most load-bearing
 * disclosure sentences on the very day they were rewritten, so the scaffolding
 * is stripped instead and every branch still has to read as Czech.
 *
 * Only the keywords ICU itself defines are removed; a branch's words are not.
 */
const stripIcuScaffolding = (s: string) =>
  s
    // `{n, plural, ` / `{kind, select, ` openers
    .replace(/\{\s*\w+\s*,\s*(?:plural|selectordinal|select)\s*,\s*/g, " ")
    // category labels that introduce a branch: `one {`, `few {`, `=0 {`
    .replace(/(?:^|[\s}])(?:=\d+|zero|one|two|few|many|other)\s*\{/g, " ");

/** The RENDERED words of a Czech sentence: ICU markup stripped (the reader sees
 *  „1 234", never „rows") and machine identifiers stripped too — `review_audit`,
 *  `change_event`, `kg_node bill.forensic_*` are the record's OWN column names,
 *  cited verbatim in both locales, and the stopword classifier scores tokens
 *  like `bill` and `node` as English. Nothing that could hide English prose is
 *  removed: an identifier must carry a `.` or `_` between two word characters. */
const prose = (s: string) =>
  stripIcuScaffolding(s)
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[\p{L}\d]+(?:[._][\p{L}\d]+)+/gu, " ");

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
    // No plural/select escape hatch: `prose` strips the ICU KEYWORDS and leaves
    // every branch's words in, so a plural key is gated exactly like a flat one.
    for (const k of keys) expect(isCzechSafe(prose(cs[k])), k).toBe(true);
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

/* ── shoda s číslovkou: věta o mezi se sází, ne skládá ──────────────────────── */

describe("limits.* — počítané meze se shodují s číslovkou (ICU plurál)", () => {
  // Do 2026-08-12 nesl celý namespace `denik.*` NULA ICU plurálů, takže šest
  // přiznaných mezí bylo při n=1 (a česky i při 2–4) negramatických v OBOU
  // jazycích: „u 1 firem", „1 vazeb nese". Přiznání meze je věta, kterou čtenář
  // dostane právě ve chvíli, kdy má produktu věřit nejmíň — a ta věta se musí
  // číst jako věta. Tenhle popis se proto SÁZÍ skutečným překladačem
  // (next-intl / use-intl `createTranslator`, týž ICU engine jako plocha), ne
  // porovnáním tvaru: kontrola tvaru by přežila i překlep uvnitř větve.
  const COUNTED = [
    "limits.companiesEdgeTruncated",
    "limits.malformedIco",
    "limits.changesUndisplayable",
    "limits.changesFromGate",
    "limits.mergedContractRows",
    "limits.contractAmountConflicts",
  ] as const;

  /** Sázení jednoho klíče. Typy katalogu se tu záměrně nemodelují: klíče jsou
   *  spočítané za běhu (seznam `COUNTED`), takže by literálová inference
   *  next-intl vedla na `never` a test by musel klíče vypsat dvakrát. */
  type Render = (key: string, values?: Record<string, string | number>) => string;
  const tFor = (locale: "cs" | "en"): Render =>
    createTranslator({
      locale,
      messages: locale === "cs" ? csCatalog : enCatalog,
      namespace: "denik",
    }) as unknown as Render;

  /** Hodnoty, které plocha posílá (limitNotes): syrové `n` + zformátované. */
  const values = (n: number) => ({ n, nFmt: String(n), cap: "5 000" });

  it("všech šest počítaných mezí je v obou katalozích ICU plurál", () => {
    for (const k of COUNTED) {
      expect(cs[k], k).toMatch(/\{\s*n\s*,\s*plural\s*,/);
      expect(en[k], k).toMatch(/\{\s*n\s*,\s*plural\s*,/);
    }
  });

  it("čeština deklaruje one/few/other, angličtina one/other", () => {
    for (const k of COUNTED) {
      for (const cat of ["one", "few", "other"]) expect(cs[k], `${k}/${cat}`).toContain(`${cat} {`);
      for (const cat of ["one", "other"]) expect(en[k], `${k}/${cat}`).toContain(`${cat} {`);
    }
  });

  it("se sází a při n=1 i n=3 dá česky JINOU a neprázdnou větu", () => {
    const t = tFor("cs");
    for (const k of COUNTED) {
      const one = t(k, values(1));
      const few = t(k, values(3));
      expect(one, k).toBeTruthy();
      expect(few, k).toBeTruthy();
      // Kdyby se do plurálu poslal zformátovaný ŘETĚZEC, obě čísla by spadla do
      // `other` a věty by byly totožné — právě to tenhle rozdíl hlídá.
      expect(one, k).not.toBe(few);
      // Číslo ve větě opravdu je (jinak by přiznání nic nepřiznávalo).
      expect(one, k).toContain("1");
      expect(few, k).toContain("3");
      // A žádná větev nesmí propustit syrové ICU zpátky na plochu.
      for (const rendered of [one, few]) {
        expect(rendered, k).not.toContain("plural");
        expect(rendered, k).not.toMatch(/[{}]/);
      }
    }
  });

  it("angličtina rozlišuje jednotné a množné číslo", () => {
    const t = tFor("en");
    for (const k of COUNTED) {
      const one = t(k, values(1));
      const many = t(k, values(3));
      expect(one, k).not.toBe(many);
      expect(one, k).not.toMatch(/[{}]/);
      expect(many, k).not.toMatch(/[{}]/);
    }
  });

  it("česká jednotná větev nedrží množné tvary, které ji dělaly negramatickou", () => {
    const t = tFor("cs");
    // Přesně ty tvary, kvůli kterým se tahle oprava dělala.
    expect(t("limits.companiesEdgeTruncated", values(1))).toContain("firmy");
    expect(t("limits.companiesEdgeTruncated", values(1))).not.toContain("firem se dosáhlo");
    expect(t("limits.malformedIco", values(1))).toContain("vazba nese");
    expect(t("limits.malformedIco", values(3))).toContain("vazby nesou");
    expect(t("limits.malformedIco", values(5))).toContain("vazeb nese");
  });
});

/* ── čestný prázdný stav a neplatný klíč ────────────────────────────────────── */

describe("prázdný stav entity — tři příčiny, ne dvě", () => {
  it("třetí příčinu (tmavá vrstva) katalog vyslovuje v obou jazycích", () => {
    // `emptyEntity.body` je uzavřená disjunkce dvou příčin; třetí — vrstva,
    // která by takové zápisy nesla, je právě nečitelná — v ní chyběla, ačkoli
    // pokrytí má plocha na vstupu.
    expect(cs["emptyEntity.dark"]).toBeTruthy();
    expect(en["emptyEntity.dark"]).toBeTruthy();
    expect(cs["emptyEntity.dark"]).toMatch(/nečiteln/);
    expect(en["emptyEntity.dark"]).toMatch(/unreadable/i);
  });

  it("neplatný tvar klíče má vlastní větu — a není to „nic se nenašlo“", () => {
    for (const k of ["emptyEntity.invalidBody", "filter.invalidKey"] as const) {
      expect(cs[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
      expect(variables(cs[k]), k).toEqual(["key"]);
      expect(variables(en[k]), k).toEqual(["key"]);
    }
    // Věta u filtru jmenuje držené tvary, aby čtenář uměl adresu opravit.
    for (const shape of ["poslanec", "tisk", "firma", "obec"]) {
      expect(cs["filter.invalidKey"], shape).toContain(shape);
      expect(en["filter.invalidKey"], shape).toContain(shape);
    }
  });
});

describe("korpusová počítadla se ve filtrovaném pohledu označí", () => {
  it("obě věty existují ve variantě pro filtr a říkají „celý deník“", () => {
    expect(cs["empty.noteEntity"]).toMatch(/v celém deníku/);
    expect(cs["daysNote.droppedEntity"]).toMatch(/v celém deníku/);
    expect(en["empty.noteEntity"]).toMatch(/whole journal/i);
    expect(en["daysNote.droppedEntity"]).toMatch(/whole journal/i);
    // Táž proměnná jako nefiltrovaná varianta — jinak by se rozešly.
    expect(variables(cs["empty.noteEntity"])).toEqual(variables(cs["empty.note"]));
    expect(variables(cs["daysNote.droppedEntity"])).toEqual(variables(cs["daysNote.dropped"]));
  });

  it("meze pod filtrem přiznávají svůj rozsah", () => {
    expect(cs["limits.corpusScope"]).toMatch(/celého deníku/);
    expect(en["limits.corpusScope"]).toMatch(/whole journal/i);
  });
});

describe("daysNote.truncated — strojové podoby řežou po zápisech, ne po dnech", () => {
  it("jmenuje strop dnů i strop zápisů, oba jako hodnotu", () => {
    // Do 2026-08-12 věta tvrdila, že „starší dny nese filtr entity a strojové
    // podoby". Feed ale řeže po ZÁPISECH (FEED_ENTRIES) — sto nejnovějších
    // zápisů je zpravidla míň dnů, než ukazuje stránka.
    expect(variables(cs["daysNote.truncated"])).toEqual(["cap", "feedCap", "shown", "total"]);
    expect(variables(en["daysNote.truncated"])).toEqual(["cap", "feedCap", "shown", "total"]);
  });

  it("neslibuje, že strojové podoby nesou starší dny", () => {
    expect(cs["daysNote.truncated"]).toMatch(/zápis/);
    expect(en["daysNote.truncated"]).toMatch(/entries/i);
    expect(cs["daysNote.truncated"]).not.toMatch(/starší dny nese[^.]*strojové/);
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
