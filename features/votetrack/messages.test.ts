// Katalog kopie VoteTracku (a kompasu), připíchnutý — táž kázeň, jakou zavedl
// features/money/messages.test.ts a po něm /zakony a spis.
//
// VoteTrack byl do 2026-08-10 největší plocha aplikace BEZ testu zpráv, a přitom
// právě tady se od téhož dne tisknou dvě věty, které jdou datově vyvrátit:
// kontrola přepočtu proti zveřejněným součtům sněmovny (record/reconcile.ts) a
// zveřejněný práh jistoty tématu v kompasu (kompas/select.ts). Obě musí být
// v obou jazycích, obě musí být česky psané a ani jedna nesmí slíbit opravu.
//
// Sekce lišty se sem přidávají schválně: PAGE_SECTIONS["/hlasovani"] ukazuje na
// klíče, které NEJSOU v tomhle souboru vidět, a dokud je nikdo neověřil proti
// katalogu, mohl rail vypisovat prázdné položky.
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { isCzechSafe } from "@/lib/analysis/language-gate";
import { PAGE_SECTIONS } from "@/features/shell/navModel";

type Ns = Record<string, unknown>;

/** Flattens `votetrack.kompas.selectionRule` → one dotted key per leaf string. */
function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.votetrack as Ns);
const en = flatten(enCatalog.votetrack as Ns);
const csAll = flatten(csCatalog as unknown as Ns);
const enAll = flatten(enCatalog as unknown as Ns);

/** Named ICU variables only (`{name}` / `{name, plural, …}`) — never the word
 *  content of a plural's category branches, which the two locales legitimately
 *  word differently (the lawwatch/profile precedent). */
function variables(s: string): string[] {
  return [...new Set([...s.matchAll(/\{\s*(\w+)[,}]/g)].map((m) => m[1]))].sort();
}

/** `t.rich` tag names — a tag present in one locale and not the other throws at
 *  render time, not at build time. */
function richTags(s: string): string[] {
  return [...new Set([...s.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();
}

const keys = Object.keys(cs).sort();

describe("votetrack message catalog", () => {
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
      // ICU plural/select markup is English BY SPEC (`one`/`few`/`other`); a short
      // message built out of it scores as English however Czech its branches are.
      if (/,\s*(plural|select|selectordinal)\s*,/.test(cs[k])) continue;
      // Placeholder NAMES are not prose — the reader sees „1 234", never „tagged".
      // Left in, `kompas.rulesSource` scores as English purely on `{tagged}` and
      // `{from}` (measured: 2 EN hits of 39 tokens = 5,1 %, exactly at the rate
      // threshold), which would be a finding about our identifiers, not about the
      // sentence. So the gate runs on the rendered words: markup is stripped,
      // every real Czech word still counts.
      expect(isCzechSafe(cs[k].replace(/\{[^{}]*\}/g, " ")), k).toBe(true);
    }
  });

  it("carries no internal pipeline jargon in reader-facing copy", () => {
    for (const k of keys) {
      expect(cs[k], k).not.toMatch(/\bdávka\s*\d/i);
      expect(cs[k], k).not.toMatch(/\bbatch\b|\bpass\s*\d/i);
    }
  });
});

/* ── sněmovna kontroluje sama sebe ─────────────────────────────────────────── */

describe("record.reconcile* — the recount checked against the published tallies", () => {
  const reconcile = keys.filter((k) => k.startsWith("record.reconcile"));

  it("declares a sentence for every state the summary can be in", () => {
    // agreement · discrepancy · nothing comparable · the two gap categories, plus
    // the method and the citation. A state without a sentence renders silence.
    for (const k of [
      "record.reconcileTitle",
      "record.reconcileMethod",
      "record.reconcileAgree",
      "record.reconcileDiff",
      "record.reconcileWorstLink",
      "record.reconcileNone",
      "record.reconcileGaps",
      "record.reconcileSource",
    ]) {
      expect(reconcile, k).toContain(k);
    }
  });

  it("states the bucket mapping the comparison actually uses", () => {
    // Compare like with like: pro↔ano, proti↔ne, the merged K slot against the SUM
    // of the two published columns. If the copy does not say it, the reader cannot
    // check what was compared.
    const m = cs["record.reconcileMethod"];
    expect(m).toMatch(/zdržel se/);
    expect(m).toMatch(/nehlasoval/);
    expect(m).toMatch(/součtu sloupců/);
    expect(en["record.reconcileMethod"]).toMatch(/sum of the abstained/i);
  });

  it("says the „nepřihlášen“ slot is deliberately NOT compared", () => {
    // The source publishes no column for it; comparing it would require estimating
    // how many MPs were supposed to be in the room.
    expect(cs["record.reconcileMethod"]).toMatch(/nepřihlášen/);
    expect(cs["record.reconcileMethod"]).toMatch(/neporovnává/);
    expect(en["record.reconcileMethod"]).toMatch(/not compared/i);
  });

  it("promises a finding, never a repair — on both sides of the difference", () => {
    expect(cs["record.reconcileMethod"]).toMatch(/nikdy neopravuje/);
    expect(cs["record.reconcileDiff"]).toMatch(/nález/);
    expect(cs["record.reconcileDiff"]).not.toMatch(/oprav(íme|eno|ili)/);
    expect(en["record.reconcileMethod"]).toMatch(/never repaired/i);
    expect(en["record.reconcileDiff"]).toMatch(/finding/i);
  });

  it("the discrepancy sentence names the count AND the worst example's vote id", () => {
    expect(variables(cs["record.reconcileDiff"])).toEqual([
      "compared",
      "discrepancies",
      "worstDistance",
      "worstId",
    ]);
    expect(variables(cs["record.reconcileWorstLink"])).toEqual(["worstId"]);
  });

  it("the agreement sentence names the compared count, never a bare „souhlasí“", () => {
    expect(variables(cs["record.reconcileAgree"])).toEqual(["buckets", "compared"]);
  });

  it("counts what was left out instead of quietly dropping it", () => {
    expect(variables(cs["record.reconcileGaps"])).toEqual(["uncompared", "withoutBallots"]);
    expect(cs["record.reconcileGaps"]).toMatch(/nedohaduje/);
    expect(en["record.reconcileGaps"]).toMatch(/guessed/i);
  });

  it("cites the source of both sides of the comparison", () => {
    expect(variables(cs["record.reconcileSource"])).toEqual(["ballots", "buckets", "compared"]);
    expect(cs["record.reconcileSource"]).toMatch(/psp\.cz/);
  });
});

/* ── metodická kopie nepřepisuje konstanty ─────────────────────────────────── */

describe("record.* — naměřená hodnota se interpoluje, nikdy nevypisuje", () => {
  // Precedens je PUBLISHED_WEIGHTS_LABEL na /zebricek a `kompas.selectionRule`
  // níž: číslo vepsané do věty je tvrzení, které kód může kdykoli vyvrátit.
  // A vyvrátil: „posledních 12 hlasování", „disciplína pod 90 %" i „s ≥ 5
  // pozičními hlasy" žily v katalogu vedle konstant, ze kterých se ta plocha
  // opravdu kreslí (MATRIX_WINDOW, STRONG_DISCIPLINE_PCT, MIN_CLUB_POSITIONAL).
  //
  // Pravidlo je TVAROVÉ, ne seznam výjimek: ze zprávy se odečte to, co ve smyslu
  // naměřené hodnoty číslem není, a co zbude, nesmí nést číslici.
  const measured = (s: string): string =>
    s
      // ICU proměnná — právě sem hodnotu dosazuje kód, o to celé jde
      .replace(/\{[^{}]*\}/g, " ")
      // citace předpisu ve Sbírce („90/1995 Sb.", „90/1995 Coll.") — adresa zákona
      .replace(/\d+\/\d{4}\s*(Sb\.|Coll\.)/g, " ")
      // kód volebního období („PSP10") — identifikátor, ne množství
      .replace(/\bPSP\d+\b/g, " ");

  // Výjimka pro věty, které o sobě říkají, že jejich čísla jsou smyšlená, tu
  // stála do 2026-08-12 kvůli JEDINÉMU klíči — `record.fallbackSource`
  // („smyšlený vzorek 5 hlasování"). Ten svou délku vzorku od té doby cituje
  // z `ROLL_CALLS.length`, takže pravidlo platí bez jediné výjimky: i o fikci
  // se tvrdí jen to, co kód opravdu nese.
  const recordKeys = keys.filter((k) => k.startsWith("record."));

  it("is scoped over the whole real-record namespace", () => {
    for (const k of ["record.matrixNote", "record.matrixFootnote", "record.methodBody", "record.seismoScale"]) {
      expect(recordKeys, k).toContain(k);
    }
  });

  it("carries no bare numeral in either locale — no exemptions", () => {
    for (const k of recordKeys) {
      for (const [locale, catalog] of [
        ["cs", cs],
        ["en", en],
      ] as const) {
        expect(measured(catalog[k]), `${locale} ${k}`).not.toMatch(/\d/);
      }
    }
  });

  it("the three corrected sentences take their value as a variable", () => {
    expect(variables(cs["record.matrixNote"])).toContain("window");
    expect(variables(cs["record.matrixFootnote"])).toContain("threshold");
    expect(variables(cs["record.methodBody"])).toContain("minClubPositional");
    expect(variables(en["record.methodBody"])).toContain("minClubPositional");
    // I označená ukázka cituje rozsah své fikce (ROLL_CALLS.length), místo aby
    // ho tvrdila — proto pravidlo výš žádnou výjimku nepotřebuje.
    expect(variables(cs["record.fallbackSource"])).toContain("sample");
    expect(variables(en["record.fallbackSource"])).toContain("sample");
  });
});

/* ── seismograf přiznává své stupnice ──────────────────────────────────────── */

describe("record.seismoScale — the instrument discloses its own clipping", () => {
  // Obě stupnice jsou useknuté `Math.min(1, …)`: den s 80 rebelskými hlasy kreslí
  // totéž co den se 40. Do 2026-08-12 tvrdil komentář v Seismograf.tsx, že to
  // „zveřejňují popisky osy" — jediný popisek pod pruhem je řada měsíců a ta je
  // aria-hidden. Mez tedy nikde nestála.
  it("names both full scales as variables, never as typed numbers", () => {
    expect(variables(cs["record.seismoScale"])).toEqual(["deviationScale", "rebelsScale"]);
    expect(variables(en["record.seismoScale"])).toEqual(["deviationScale", "rebelsScale"]);
  });

  it("says out loud that a bigger day draws the same picture", () => {
    expect(cs["record.seismoScale"]).toMatch(/useknut/);
    expect(cs["record.seismoScale"]).toMatch(/dvojnásobkem kreslí totéž/);
    expect(en["record.seismoScale"]).toMatch(/clipped/i);
    expect(en["record.seismoScale"]).toMatch(/draws the same/i);
  });
});

/* ── mez se nikdy nevydává za počet ────────────────────────────────────────── */

describe("record.chronicleNote / topRebelsNote — a cap ships with its population", () => {
  // `CHRONICLE_CAP` = 24 a `TOP_REBELS_CAP` = 12 jsou PREZENTAČNÍ okna. Bez
  // denominátoru se „12 nejvyšších měr" čte jako „rebelovalo dvanáct poslanců",
  // což je nad živým záznamem (188 z 207) nepravda o dvou řádech.
  it("both sentences carry the shown count AND the population it was cut from", () => {
    for (const k of ["record.chronicleNote", "record.topRebelsNote"]) {
      expect(variables(cs[k]), k).toContain("shown");
      expect(variables(cs[k]), k).toContain("total");
      expect(variables(en[k]), k).toContain("shown");
      expect(variables(en[k]), k).toContain("total");
    }
  });

  it("the matrix states the row count it really drew when the ledger is shorter", () => {
    expect(variables(cs["record.matrixNoteShort"])).toEqual(["shown", "window"]);
    expect(variables(en["record.matrixNoteShort"])).toEqual(["shown", "window"]);
  });
});

/* ── práh jistoty tématu v kompasu ─────────────────────────────────────────── */

describe("kompas selection rule — the tag-confidence floor", () => {
  it("the published rule states the floor, with the live value passed in", () => {
    // A literal percentage in the catalog would drift from the constant the code
    // filters on (the PUBLISHED_WEIGHTS_LABEL lesson) — hence a variable.
    expect(variables(cs["kompas.selectionRule"])).toContain("minConfidence");
    expect(variables(en["kompas.selectionRule"])).toContain("minConfidence");
    expect(cs["kompas.selectionRule"]).toMatch(/jistot/);
  });

  it("says a MISSING confidence is not a low confidence", () => {
    expect(cs["kompas.selectionRule"]).toMatch(/bez uvedené jistoty|nevyřazuje/);
    expect(en["kompas.selectionRule"]).toMatch(/no stated confidence/i);
  });

  it("the data-basis line carries the floor's live value", () => {
    expect(variables(cs["kompas.rulesSource"])).toContain("minConfidence");
    expect(variables(en["kompas.rulesSource"])).toContain("minConfidence");
  });
});

/* ── každý práh výběru má své číslo ────────────────────────────────────────── */

describe("kompas.selectionFloors — every floor counts its casualties", () => {
  // Do 2026-08-11 se počítal JEDINÝ ze čtyř prahů. `MIN_POSITIONAL` a
  // `EXCLUDED_THEMES` zahazovaly kandidáty bez čísla, přestože obojí je součástí
  // ZVEŘEJNĚNÉHO pravidla — tj. plocha tiskla pravidlo, jehož dopad nešlo ověřit.
  it("names all four floors plus the two counts that are not a drop", () => {
    for (const v of [
      "droppedByTheme",
      "withoutBallots",
      "droppedByPositional",
      "minPositional",
      "droppedByConfidence",
      "withoutConfidence",
      "minConfidence",
    ]) {
      expect(variables(cs["kompas.selectionFloors"]), v).toContain(v);
      expect(variables(en["kompas.selectionFloors"]), v).toContain(v);
    }
  });

  it("states that the floors are ordered, so the counts are a loss and not an overlap", () => {
    expect(cs["kompas.selectionFloors"]).toMatch(/pořadí/);
    expect(cs["kompas.selectionFloors"]).toMatch(/překryv/);
    expect(en["kompas.selectionFloors"]).toMatch(/overlap/i);
  });

  it("says a roll call with no stored ballots was not measured, not that nobody voted", () => {
    expect(cs["kompas.selectionFloors"]).toMatch(/nedržíme ani jeden/);
    expect(en["kompas.selectionFloors"]).toMatch(/not a single named ballot/i);
  });
});

/* ── prázdný výběr ≠ výpadek ───────────────────────────────────────────────── */

describe("kompas.empty* — an honest empty selection is not an outage", () => {
  it("declares both sentences in both locales", () => {
    for (const k of ["kompas.emptyTitle", "kompas.emptyBody"]) {
      expect(cs[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
    }
  });

  it("says out loud that the record WAS read — an outage claim would be false", () => {
    expect(cs["kompas.emptyBody"]).toMatch(/přečetl/);
    expect(cs["kompas.emptyBody"]).toMatch(/není to výpadek/i);
    expect(en["kompas.emptyBody"]).toMatch(/not an outage/i);
    // …and it must not read like the unavailable state next door.
    expect(cs["kompas.emptyBody"]).not.toBe(cs["kompas.unavailableWhat"]);
  });
});

/* ── nikdy nespočítaná vrstva ≠ výpadek ────────────────────────────────────── */

describe("kompas.neverComputed* / themesNeverComputed — a layer that was never computed", () => {
  // `vote_tag` je NAŠE odvozená vrstva a na živém store má nula řádků. Do
  // 2026-08-12 na to /kompas odpovídal hláškou o nedostupném zdroji (tvrzení
  // o výpadku, který se nekonal) a /hlasovani sekci mlčky schovalo.
  const neverComputed = [
    "kompas.neverComputedBadge",
    "kompas.neverComputedTitle",
    "kompas.neverComputedBody",
    "kompas.neverComputedWhat",
    "kompas.neverComputedNoDate",
    "kompas.neverComputedSource",
    "kompas.neverComputedLedgerLink",
    "kompas.entryNeverComputed",
    "themesNeverComputed",
    "themesNeverComputedSource",
  ];

  it("declares a sentence for the third state in both locales", () => {
    for (const k of neverComputed) {
      expect(cs[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
    }
  });

  it("says out loud that this is NOT an outage", () => {
    expect(cs["kompas.neverComputedBody"]).toMatch(/není to výpadek|nedostupn/i);
    expect(cs["kompas.neverComputedBody"]).toMatch(/nikdy nespočítala/);
    expect(cs["themesNeverComputed"]).toMatch(/není to výpadek/i);
    expect(en["kompas.neverComputedBody"]).toMatch(/never been computed/i);
    expect(en["themesNeverComputed"]).toMatch(/not an outage/i);
  });

  it("reads differently from the unavailable state next door", () => {
    // Precedens kompas.emptyBody ≠ kompas.unavailableWhat: tři stavy, tři věty.
    for (const k of ["kompas.neverComputedBody", "kompas.neverComputedTitle", "themesNeverComputed"]) {
      expect(cs[k], k).not.toBe(cs["kompas.unavailableWhat"]);
      expect(cs[k], k).not.toBe(cs["kompas.emptyBody"]);
      expect(en[k], k).not.toBe(en["kompas.emptyBody"]);
    }
  });

  it("names WHAT the missing layer is, not just that it is missing", () => {
    expect(cs["kompas.neverComputedWhat"]).toMatch(/téma|štítek|štítk/i);
    expect(en["kompas.neverComputedWhat"]).toMatch(/theme|tag/i);
  });

  it("promises no delivery date", () => {
    expect(cs["kompas.neverComputedNoDate"]).toMatch(/neslibujeme/);
    expect(en["kompas.neverComputedNoDate"]).toMatch(/no date/i);
    // …and no sentence of the third state may smuggle one in.
    for (const k of neverComputed) {
      expect(cs[k], k).not.toMatch(/\bbrzy\b|\bpřipravujeme\b|\bdo konce\b/i);
      expect(en[k], k).not.toMatch(/\bsoon\b|\bcoming\b/i);
    }
  });

  it("the /hlasovani entry point does not advertise a compass with no questions", () => {
    // Pozvánka „spočítejte si shodu" nesmí nad prázdnou vrstvou stát bez věty.
    expect(cs["kompas.entryNeverComputed"]).toMatch(/nespočítala|nemá z čeho/);
    expect(cs["kompas.entryNeverComputed"]).not.toBe(cs["kompas.entryBody"]);
    expect(en["kompas.entryNeverComputed"]).not.toBe(en["kompas.entryBody"]);
  });

  it("cites the source of both halves of the claim", () => {
    for (const k of ["kompas.neverComputedSource", "themesNeverComputedSource"]) {
      expect(cs[k], k).toMatch(/psp\.cz/);
      expect(en[k], k).toMatch(/psp\.cz/);
    }
  });

  it("the loading shell no longer promises a long read unconditionally", () => {
    // Štítky se čtou první (jednotky ms); nad prázdnou vrstvou loader odpoví dřív,
    // než přečte jediný hlas — „čtení trvá řádově sekundy" tam pak byla nepravda.
    expect(cs["kompas.loadingBody"]).toMatch(/pokud|může/i);
    expect(en["kompas.loadingBody"]).toMatch(/\bif\b|\bmay\b/i);
  });
});

/* ── čerstvost říká, co se memoizuje a co ne ───────────────────────────────── */

describe("kompas.freshness — the bound the page actually has", () => {
  // Od 2026-08-11 je kompas projekcí memoizovaného ZÁZNAMU (otázky, součty,
  // linie klubů) plus čtení jmenovitých hlasů PŘI KAŽDÉM POŽADAVKU. Věta, která
  // by tvrdila, že „výsledek je memoizovaný", by o půlce plochy lhala.
  it("names the memo window and says what is read fresh instead", () => {
    expect(variables(cs["kompas.freshness"])).toEqual(["hours"]);
    expect(cs["kompas.freshness"]).toMatch(/při každém požadavku/);
    expect(en["kompas.freshness"]).toMatch(/on every request/i);
  });

  it("still names the shared bound the rest of the app declares", () => {
    expect(cs["kompas.freshness"]).toMatch(/penize/);
    expect(en["kompas.freshness"]).toMatch(/penize/);
  });
});

/* ── kotvy, které někam vedou ──────────────────────────────────────────────── */

describe("kompas.outsideWindow* — permalinks that land", () => {
  it("declares the sentence, the row tag and the counted note", () => {
    for (const k of ["kompas.outsideWindow", "kompas.outsideWindowTag", "kompas.outsideWindowNote"]) {
      expect(cs[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
    }
  });

  it("the note counts the rows and names the window they fall outside of", () => {
    expect(variables(cs["kompas.outsideWindowNote"])).toEqual(["n", "window"]);
  });

  it("points the reader at psp.cz rather than at nothing", () => {
    expect(cs["kompas.outsideWindow"]).toMatch(/psp\.cz/);
    expect(en["kompas.outsideWindow"]).toMatch(/psp\.cz/);
  });

  it("the ledger row can copy the permalink its tooltip promises", () => {
    expect(cs["record.copyPermalink"]).toBeTruthy();
    expect(cs["record.permalinkTitle"]).toMatch(/#h-/);
  });

  it("the theme list discloses its cap and links the roll call", () => {
    expect(variables(cs["themeListCount"])).toEqual(["cap", "matched", "shown"]);
    expect(cs["themeVoteLink"]).toMatch(/psp\.cz/);
    expect(variables(cs["themeVoteLinkAria"])).toEqual(["title"]);
  });
});

/* ── lišta „na této stránce" ───────────────────────────────────────────────── */

describe("/hlasovani section rail", () => {
  const sections = PAGE_SECTIONS["/hlasovani"];

  it("every declared section label resolves in BOTH catalogs", () => {
    for (const s of sections) {
      expect(csAll[s.labelKey], s.labelKey).toBeTruthy();
      expect(enAll[s.labelKey], s.labelKey).toBeTruthy();
    }
  });

  it("names the real page's sections — the Seismograf included", () => {
    // components/RealVoteTrack.tsx renders #seismograf, #denik, #linie, #rebelie;
    // VoteTrackPage adds #temata. The rail listed the MOCK titles and no hero.
    expect(sections.map((s) => s.id)).toEqual(["seismograf", "denik", "linie", "rebelie", "temata"]);
    expect(sections.map((s) => s.labelKey)).toEqual([
      "votetrack.record.seismoTitle",
      "votetrack.record.ledgerTitle",
      "votetrack.record.disciplineTitle",
      "votetrack.record.rebelsTitle",
      "votetrack.section4Title",
    ]);
  });
});
