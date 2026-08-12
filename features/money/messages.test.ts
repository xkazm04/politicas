// The /penize copy catalog, pinned — the same discipline `features/civicscore/
// messages.test.ts` established. Two of the failures this file exists to catch were
// live: a banner asserting that EVERY tie was still pending (a literal the review
// console can falsify with one click), and „9. období" printed over a loader that reads
// PSP10, the tenth.
import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import { reviewSummary, type ReviewPhase } from "./reviewSummary";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

type Ns = Record<string, unknown>;

/** Flattens `money.real.stats.ownerLabel` → one dotted key per leaf string. */
function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.money as Ns);
const en = flatten(enCatalog.money as Ns);

function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

describe("money message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("each key declares the same ICU placeholders in both locales", () => {
    for (const k of Object.keys(cs)) {
      expect(placeholders(en[k]), k).toEqual(placeholders(cs[k]));
    }
  });

  it("states the term the money loader actually reads (PSP10 = the tenth), not the ninth", () => {
    expect(cs["real.stats.mpsSub"]).toContain("10. období");
    expect(en["real.stats.mpsSub"]).toContain("10th term");
    for (const ns of [cs, en]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} still claims the 9th term`).not.toMatch(/9\. období|9th term/);
      }
    }
  });

  it("has a sentence for every review phase the data can be in", () => {
    for (const ns of [cs, en]) {
      for (const phase of ["allPending", "mixed", "allDecided"]) {
        expect(ns[`real.review.${phase}`], phase).toBeTruthy();
        expect(ns[`real.graph.${phase}`], `graph.${phase}`).toBeTruthy();
      }
      // …and it cites where the counts come from, like every other rendered figure.
      expect(ns["real.review.source"]).toBeTruthy();
    }
  });

  it("the mock graph footer no longer certifies its own sample edges", () => {
    // `graph.allEdgesVerified` used to render „● všechny hrany datované + doložené" in
    // the CONFIRMED colour, over invented edges, beside a real graph whose whole point
    // is that nothing is confirmed until a human says so.
    expect(cs["graph.allEdgesVerified"]).toBeUndefined();
    expect(cs["graph.sampleNotice"]).toContain("ukázková data");
    expect(en["graph.sampleNotice"]).toContain("sample data");
  });

  it("the ownership block declares every sentence it can render, in both catalogs", () => {
    // Jména klíčů jsou kontrakt mezi `OwnershipBlock.tsx` a katalogem: překlep tady
    // se na ploše projeví syrovým klíčem místo věty, a to zrovna v bloku, který má
    // říkat „tenhle uzel nelze ověřit v registru".
    const KEYS = [
      "title",
      "rule",
      "ownersHeading",
      "subsidiariesHeading",
      "stateOwnerCurrent",
      "stateOwnerFormer",
      "stateSubsidiaryCurrent",
      "stateSubsidiaryFormer",
      "sharePeriodPrefix",
      "shareUnknown",
      "periodOpen",
      "periodOpenNoStart",
      "periodClosed",
      "periodClosedNoStart",
      "periodUnknown",
      "roleLabel",
      "multiPeriod",
      "droppedUnresolved",
      "nameHistoryHeading",
      "verbatimNote",
      "source",
      "sourceWithPass",
      "rowSourceLabel",
      "rowSourceMissing",
      "recorded",
      "unresolvableBadge",
      "notRegistryVerified",
      "extinctionReasonLabel",
      "mergedIntoLabel",
      "mergedOnLabel",
      "successorLabel",
      "checkResultLabel",
      "checkedEndpointsLabel",
      "endpointOrdinal",
      "notAnomaly",
      "analystNoteHeading",
      "annotationSource",
      "annotationSourceDated",
    ];
    for (const k of KEYS) {
      expect(cs[`ownership.${k}`], `cs.ownership.${k}`).toBeTruthy();
      expect(en[`ownership.${k}`], `en.ownership.${k}`).toBeTruthy();
    }
  });

  it("the ownership block keeps its tenses apart and presents no inference", () => {
    for (const ns of [cs, en]) {
      // Otevřený a ukončený zápis nesmějí znít stejně: jinak stránka tvrdí dnešní
      // vlastnictví nad zápisem, který rejstřík uzavřel (u AGROFERTu jsou takové
      // všechny čtyři).
      expect(ns["ownership.stateOwnerCurrent"]).not.toEqual(ns["ownership.stateOwnerFormer"]);
      expect(ns["ownership.stateSubsidiaryCurrent"]).not.toEqual(
        ns["ownership.stateSubsidiaryFormer"],
      );
      // Blok ukazuje zapsané vlastnictví, nikdy „stopu" nebo „odhalení" —
      // dvoukrokové sousedství se v něm nepočítá a copy to nesmí naznačovat.
      for (const [k, v] of Object.entries(ns)) {
        if (!k.startsWith("ownership.")) continue;
        expect(v, `${k} reads as an exposure finding`).not.toMatch(
          /nová stopa|odhaluj|odhalen|reveals|exposure|uncovers/i,
        );
      }
    }
    // A česká věta zůstává česká (memory/reader-facing-loaders-need-the-language-gate.md).
    for (const [k, v] of Object.entries(cs)) {
      if (!k.startsWith("ownership.")) continue;
      // Bez zástupných symbolů: „{from} → {to}" je v obou katalozích totéž a
      // není na něm co překládat.
      const prose = v.replace(/\{[^}]*\}/g, " ");
      if (!/\p{L}{3}/u.test(prose)) continue;
      expect(looksEnglish(v), `cs.${k}`).toBe(false);
      expect(v, `${k} is not translated`).not.toEqual(en[k]);
    }
  });

  // Klíče, které sází OBA obrázky (reálný i označený vzorek) — jména jsou
  // kontrakt mezi MoneyGraph.tsx / MockMoneyGraph.tsx a katalogem. Překlep se
  // na ploše projeví syrovým klíčem, a to zrovna v popisku pro odečítačku,
  // který nikdo neuvidí.
  it("graf peněz deklaruje celou klávesovou a popisnou sadu v obou katalozích", () => {
    const KEYS = [
      "keyboardHint",
      "nodePosition",
      "nodeOpens",
      "openCaseFile",
      "tieFallback",
      "sampleNoCaseFiles",
      "kind.person",
      "kind.company",
      "kind.money",
      "kind.party",
    ];
    for (const k of KEYS) {
      expect(cs[`graph.${k}`], `cs.graph.${k}`).toBeTruthy();
      expect(en[`graph.${k}`], `en.graph.${k}`).toBeTruthy();
    }
    // Pozice uzlu je ICU věta o dvou měřených hodnotách, ne text s číslem.
    expect(placeholders(cs["graph.nodePosition"])).toEqual(["index", "total"]);
    expect(placeholders(en["graph.nodePosition"])).toEqual(["index", "total"]);
  });

  it("česká klávesová nápověda i názvy druhů uzlů projdou jazykovou branou", () => {
    for (const k of [
      "graph.keyboardHint",
      "graph.nodeOpens",
      "graph.openCaseFile",
      "graph.sampleNoCaseFiles",
      "graph.kind.person",
      "graph.kind.company",
      "graph.kind.money",
      "graph.kind.party",
    ]) {
      expect(looksEnglish(cs[k]), `cs.${k}`).toBe(false);
      expect(cs[k], `${k} is not translated`).not.toEqual(en[k]);
    }
  });

  it("popisek hrany bez role je katalogová věta, ne české slovo v kódu", () => {
    // Do 2026-08-12 stálo v MoneyGraph.tsx `c.role || "vazba"` — jediné české
    // slovo v obrázku, které anglický čtenář dostal nepřeložené.
    expect(cs["graph.tieFallback"]).toBe("vazba");
    expect(en["graph.tieFallback"]).toBe("tie");
  });

  it("the lower-bound explainer is reachable copy, not a dead key", () => {
    // It sat unused in both catalogs while the "nejméně" prefix rendered without it.
    expect(placeholders(cs["real.stats.reachableSubCapped"])).toEqual(["cap", "companies"]);
    expect(placeholders(en["real.stats.reachableSubCapped"])).toEqual(["cap", "companies"]);
  });

  /* ── kniha vazeb mluví o bráně tolik, kolik brána rozhodla ─────────────────
   * Do 2026-08-12 stála pod knihou JEDNA věta: „Všechny záznamy nesou štítek
   * «čeká na kontrolu»" — literál, který první potvrzení v /penize/kontrola
   * vyvrátí. Věta teď čte `ReviewSummary`, takže katalog musí mít větu pro
   * KAŽDOU fázi, ve které ta data mohou být. Mapa je `Record<ReviewPhase, …>`:
   * nová fáze se bez rozhodnutí o copy ani nezkompiluje. */
  const LEDGER_DISCLAIMER: Record<ReviewPhase, string> = {
    empty: "real.ledger.disclaimerEmpty",
    "all-pending": "real.ledger.disclaimerAllPending",
    mixed: "real.ledger.disclaimerMixed",
    "all-decided": "real.ledger.disclaimerAllDecided",
  };

  it("the ledger has a sentence for every phase the gate can actually be in", () => {
    // Fáze se nevypisují ručně — projedou se skutečnou `reviewSummary()`, takže
    // test tvrdí totéž co komponenta, ne totéž co komentář.
    const cases = [
      { verified: 0, pending: 0, rejected: 0 },
      { verified: 0, pending: 211, rejected: 0 },
      { verified: 3, pending: 208, rejected: 0 },
      { verified: 3, pending: 0, rejected: 208 },
    ];
    const reached = new Set<ReviewPhase>();
    for (const c of cases) {
      const { phase } = reviewSummary(c);
      reached.add(phase);
      const key = LEDGER_DISCLAIMER[phase];
      expect(cs[key], `cs.${key} (phase ${phase})`).toBeTruthy();
      expect(en[key], `en.${key} (phase ${phase})`).toBeTruthy();
    }
    expect(reached.size, "every declared phase is exercised").toBe(
      Object.keys(LEDGER_DISCLAIMER).length,
    );
  });

  it("each disclaimer declares exactly the arguments TiesLedger hands it", () => {
    // Jméno parametru je kontrakt mezi komponentou a katalogem; překlep se na
    // ploše projeví syrovým `{total}` uprostřed věty o lidské bráně.
    const ARGS: Record<string, string[]> = {
      "real.ledger.disclaimerAllPending": ["pendingLabel", "total"],
      "real.ledger.disclaimerAllDecided": ["rejected", "total", "verified"],
      "real.ledger.disclaimerMixed": ["decided", "pending", "pendingLabel", "total"],
      "real.ledger.disclaimerEmpty": [],
    };
    for (const [k, args] of Object.entries(ARGS)) {
      expect(placeholders(cs[k]), `cs.${k}`).toEqual(args);
      expect(placeholders(en[k]), `en.${k}`).toEqual(args);
    }
    // A ta jedna věta, kterou nahradily, je pryč z OBOU katalogů — mrtvý klíč
    // s nepravdivým tvrzením je pozvánka, aby ho někdo zase někam vysázel.
    expect(cs["real.ledger.disclaimer"], "the retired all-pending literal").toBeUndefined();
    expect(en["real.ledger.disclaimer"], "the retired all-pending literal").toBeUndefined();
  });

  /* ── žádná dlaždice nesmí mít vlastní sněmovnu ─────────────────────────────
   * „z 207 mandátů" byl literál nad loaderem, který mandátový rejstřík CELOU
   * DOBU četl a zahazoval; jeden doplňovací mandát z něj dělá lež. Pravidlo je
   * záměrně TVAROVÉ, ne seznam zakázaných čísel: zakázán je „<číslo> <slovo>",
   * tedy počet vysázený do věty. Kód období („PSP10") ani řadová číslovka
   * („10. období") tím netrpí — číslice tam nestojí samostatně před podstatným
   * jménem. Regex, který by hledal jen „207", je přesně to, čím poslední takový
   * literál proklouzl. */
  const LITERAL_COUNT = /(?<![\p{L}\p{N}])\d{2,}\s+\p{L}/u;

  it("no stats sentence writes a count into the copy — denominators are arguments", () => {
    for (const [locale, ns] of [
      ["cs", cs],
      ["en", en],
    ] as const) {
      for (const [k, v] of Object.entries(ns)) {
        if (!k.startsWith("real.stats.")) continue;
        expect(v, `${locale}.${k} states a count as a literal`).not.toMatch(LITERAL_COUNT);
      }
    }
    // …a ta jedna dlaždice, kde jmenovatel opravdu stojí, ho bere jako argument.
    expect(placeholders(cs["real.stats.mpsSub"])).toEqual(["total"]);
    expect(placeholders(en["real.stats.mpsSub"])).toEqual(["total"]);
    // Když se mandátový rejstřík nepřečte, věta jmenovatel NETVRDÍ VŮBEC —
    // ani jako argument (nula by byla horší lež než mlčení).
    for (const ns of [cs, en]) {
      expect(ns["real.stats.mpsSubNoTotal"]).toBeTruthy();
      expect(ns["real.stats.mpsSourceNoTotal"]).toBeTruthy();
      expect(placeholders(ns["real.stats.mpsSubNoTotal"])).toEqual([]);
      expect(placeholders(ns["real.stats.mpsSourceNoTotal"])).toEqual([]);
    }
  });

  /* ── čí je ta kadence ──────────────────────────────────────────────────────
   * „téměř real-time", „denně / čtvrtletně", „průběžně" stály pod dlaždicemi
   * BEZ PODMĚTU, takže se četly jako kadence NAŠEHO čtení — a nad tímhle
   * repozitářem neběží plánovač. Pin je tvarový a odvozený: podmět, který
   * kadence musí pojmenovat, se bere z NÁZVU vlastního kroku, takže tohle není
   * seznam schválených frází — je to požadavek, aby věta měla podmět. */
  const STEP_KEYS = ["ares", "registers", "watchdog", "resolution"] as const;
  /** Kmeny slov názvu kroku — čtyři znaky kvůli české flexi (rejstřík/rejstříku). */
  const subjectStems = (title: string): string[] => [
    ...new Set(
      (title.toLowerCase().match(/\p{L}+/gu) ?? [])
        .filter((w) => w.length >= 4)
        .map((w) => w.slice(0, 4)),
    ),
  ];
  /** Věta, která ZAČÍNÁ frekvencí, je holá kadence bez podmětu — přesně ten tvar. */
  const BARE_CADENCE =
    /^\s*(téměř\s+|near\s+|zhruba\s+|about\s+)?(real[-\s]?time|denně|týdně|měsíčně|čtvrtletně|ročně|průběžně|nepřetržitě|daily|weekly|monthly|quarterly|annually|continuous|continuously|ongoing|hourly|nightly)\b/i;
  /** Kadenci registru nesmí vlastnit první osoba — to je celá ta nepravda. */
  const FIRST_PERSON =
    /\b(čteme|stahujeme|načítáme|sbíráme|aktualizujeme|synchronizujeme|obnovujeme|naše|náš|našeho|našem|we|our|us)\b/i;
  const FREQUENCY =
    /\b(real[-\s]?time|denně|týdně|měsíčně|čtvrtletně|ročně|průběžně|nepřetržitě|daily|weekly|monthly|quarterly|annually|continuous|continuously|hourly|nightly)\b/i;

  it("every step cadence names the REGISTER it speaks for, never our reading", () => {
    for (const [locale, ns] of [
      ["cs", cs],
      ["en", en],
    ] as const) {
      for (const k of STEP_KEYS) {
        const title = ns[`method.steps.${k}.title`];
        const cadence = ns[`method.steps.${k}.cadence`];
        expect(title, `${locale}.${k}.title`).toBeTruthy();
        expect(cadence, `${locale}.${k}.cadence`).toBeTruthy();
        expect(cadence, `${locale}.${k}.cadence is a bare frequency, with no subject`).not.toMatch(
          BARE_CADENCE,
        );
        expect(cadence, `${locale}.${k}.cadence claims OUR cadence`).not.toMatch(FIRST_PERSON);
        const named = subjectStems(title).some((s) => cadence.toLowerCase().includes(s));
        expect(named, `${locale}.${k}.cadence names no subject from its own title`).toBe(true);
      }
    }
  });

  it("our own reading claims no cadence — nothing schedules it", () => {
    for (const ns of [cs, en]) {
      for (const k of ["method.readCadence", "method.readCadenceUnknown"]) {
        expect(ns[k], k).toBeTruthy();
        expect(ns[k], `${k} asserts a reading cadence no scheduler delivers`).not.toMatch(FREQUENCY);
      }
    }
    // Jediné datum, které o vlastním čtení známe, je průchod — a je to argument.
    expect(placeholders(cs["method.readCadence"])).toEqual(["pass"]);
    expect(placeholders(en["method.readCadence"])).toEqual(["pass"]);
    expect(placeholders(cs["method.readCadenceUnknown"])).toEqual([]);
    expect(placeholders(en["method.readCadenceUnknown"])).toEqual([]);
  });

  it("the kauzy teaser cites where its count comes from, and claims none without it", () => {
    for (const ns of [cs, en]) {
      expect(ns["kauzy.teaserSource"]).toBeTruthy();
      expect(ns["kauzy.teaserSourceNoCount"]).toBeTruthy();
      // Počet je DISKOVANÁ populace — citace musí ukázat na adresář, ne na graf.
      expect(ns["kauzy.teaserSource"]).toContain("case-money/payloads");
      expect(ns["kauzy.teaserSourceNoCount"]).toContain("case-money/payloads");
      // Bez počtu se žádný počet netvrdí — ani argumentem, ani číslicí.
      expect(placeholders(ns["kauzy.teaserSourceNoCount"])).toEqual([]);
      expect(ns["kauzy.teaserSourceNoCount"]).not.toMatch(LITERAL_COUNT);
    }
  });

  it("every sentence this pass added stays Czech in the Czech catalog", () => {
    // memory/reader-facing-loaders-need-the-language-gate.md — a copy set that
    // nobody gates drifts into English one honest correction at a time.
    const ADDED = [
      "real.ledger.disclaimerAllPending",
      "real.ledger.disclaimerAllDecided",
      "real.ledger.disclaimerMixed",
      "real.ledger.disclaimerEmpty",
      "real.stats.mpsSub",
      "real.stats.mpsSubNoTotal",
      "real.stats.mpsSource",
      "real.stats.mpsSourceNoTotal",
      "kauzy.teaserSource",
      "kauzy.teaserSourceNoCount",
      "method.readCadence",
      "method.readCadenceUnknown",
      ...STEP_KEYS.map((k) => `method.steps.${k}.cadence`),
    ];
    for (const k of ADDED) {
      expect(cs[k], `cs.${k} missing`).toBeTruthy();
      expect(looksEnglish(cs[k]), `cs.${k} reads as English`).toBe(false);
      expect(cs[k], `${k} is not translated`).not.toEqual(en[k]);
    }
  });
});
