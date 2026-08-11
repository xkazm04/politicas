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
