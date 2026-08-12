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

  /* ── firma bez vazby dostane spis, ne popření ─────────────────────────────
   * Blok vlastnictví odkazuje na každou protistranu s kanonickým IČEM (Město
   * Plzeň, HLAVNÍ MĚSTO PRAHA, Ministerstvo financí, předchůdci AGROFERTu), a
   * loader do 2026-08-12 na `ties.length === 0` končil DŘÍV, než se na
   * vlastnictví podíval — takže všechny ty odkazy dopadly na větu „graf nevede
   * pro tohle IČO žádnou vazbu na poslance". Jména klíčů jsou kontrakt mezi
   * `CompanyCaseFilePage.tsx` a katalogem. */
  const REGISTRY_ONLY_KEYS = [
    "companyFile.registryOnlyEyebrow",
    "companyFile.registryOnlyEyebrowNoPass",
    "companyFile.registryOnlyLead",
    "companyFile.registryOnlyNotEmpty",
    "companyFile.registryOnlySource",
    "companyFile.registryOnlyDisclaimer",
  ];

  it("the register-only company file declares every sentence it renders, in both catalogs", () => {
    for (const k of REGISTRY_ONLY_KEYS) {
      expect(cs[k], `cs.${k}`).toBeTruthy();
      expect(en[k], `en.${k}`).toBeTruthy();
    }
    // Průchod je ARGUMENT, a druhá věta ho NETVRDÍ VŮBEC — vlastnické hrany se na
    // jednom průchodu shodnout nemusí a `ties[0].provenance.pass` (= 0) se sem
    // dosadit nesmí.
    expect(placeholders(cs["companyFile.registryOnlyEyebrow"])).toEqual(["pass"]);
    expect(placeholders(en["companyFile.registryOnlyEyebrow"])).toEqual(["pass"]);
    expect(placeholders(cs["companyFile.registryOnlyEyebrowNoPass"])).toEqual([]);
    expect(placeholders(en["companyFile.registryOnlyEyebrowNoPass"])).toEqual([]);
    // A ta věta pro „graf o tomhle IČU neví vůbec nic" zůstává — jsou to dvě
    // různá tvrzení a jedno se nesmí sázet místo druhého.
    expect(cs["companyFile.noTie"]).toBeTruthy();
    expect(en["companyFile.noTie"]).toBeTruthy();
  });

  it("the register-only file promises no money — not even a zero", () => {
    // Bez vazby neexistuje třída vazby, bez ní pravidlo přiřazení: tahle varianta
    // nesází žádnou částku, takže ji nesmí ani slibovat copy.
    for (const [locale, ns] of [
      ["cs", cs],
      ["en", en],
    ] as const) {
      for (const k of REGISTRY_ONLY_KEYS) {
        expect(ns[k], `${locale}.${k} prints a CZK figure`).not.toMatch(/\bK[čc]\b|\bCZK\b|\bmld\b|\bmil\b/i);
      }
    }
    // Dolní odhad má vlastní větu a vlastní důvod: strop ČTENÍ, ne korpusová
    // heuristika — a proto v ní nesmí stát žádné číslo stropu.
    for (const ns of [cs, en]) {
      expect(ns["companyFile.reachReadCapped"]).toBeTruthy();
      expect(placeholders(ns["companyFile.reachReadCapped"])).toEqual([]);
    }
    expect(cs["shared.atLeast"]).toBeTruthy();
    expect(en["shared.atLeast"]).toBeTruthy();
  });

  it("the register-only sentences stay Czech in the Czech catalog", () => {
    for (const k of [...REGISTRY_ONLY_KEYS, "companyFile.reachReadCapped"]) {
      expect(looksEnglish(cs[k]), `cs.${k} reads as English`).toBe(false);
      expect(cs[k], `${k} is not translated`).not.toEqual(en[k]);
    }
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
  // \d+ schválně, ne \d{2,}: jednociferný literál („0 ověřených") prošel
  // dvouciferným tvarem přímo do katalogu a přežil tam jako mrtvý klíč
  // s nepravdivým tvrzením — falzifikace 2026-08-12.
  const LITERAL_COUNT = /(?<![\p{L}\p{N}])\d+\s+\p{L}/u;

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

  /* ── kniha vazeb mluví z katalogu ─────────────────────────────────────────
   * Do 2026-08-12 nesla `TiesLedger.tsx` pětadvacet dvojjazyčných ternárů
   * `en ? "…" : "…"` — každý filtr, každá hlavička sloupce, placeholder
   * hledání, prázdný stav i stránkování. Katalog o nich nevěděl, takže je
   * neviděla ani jazyková brána, ani kontrola parity: kniha byla jediná plocha
   * /penize mimo všechny audity, které pro ni vznikly. Jména klíčů jsou teď
   * kontrakt mezi komponentou a katalogem. */
  const LEDGER_CHROME_KEYS = [
    "real.ledger.searchPlaceholder",
    "real.ledger.filterAllClasses",
    "real.ledger.filterCorrAll",
    "real.ledger.filterCorrConfirmed",
    "real.ledger.filterCorrUnconfirmed",
    "real.ledger.filterCorrConflicting",
    "real.ledger.filterCorrUnchecked",
    "real.ledger.filterStatusAll",
    "real.ledger.filterStatusCurrent",
    "real.ledger.filterStatusEnded",
    "real.ledger.filterStatusWarn",
    "real.ledger.filterStatusUnknown",
    "real.ledger.filterAllClubs",
    "real.ledger.colMp",
    "real.ledger.colCompany",
    "real.ledger.colEvidence",
    "real.ledger.colStatus",
    "real.ledger.emptyFilters",
    "real.ledger.prevPage",
    "real.ledger.nextPage",
    "real.ledger.evidenceRule",
    "sections.ledger.asideReal",
  ];

  it("the ledger chrome is catalog copy in both locales, and translated", () => {
    for (const k of LEDGER_CHROME_KEYS) {
      expect(cs[k], `cs.${k}`).toBeTruthy();
      expect(en[k], `en.${k}`).toBeTruthy();
      expect(cs[k], `${k} is not translated`).not.toEqual(en[k]);
    }
  });

  it("the ledger chrome stays Czech in the Czech catalog", () => {
    for (const k of LEDGER_CHROME_KEYS) {
      expect(looksEnglish(cs[k]), `cs.${k} reads as English`).toBe(false);
    }
  });

  it("the two shadow literals reuse the LIVE keys instead of duplicating them", () => {
    // `shared.rejected` a `shared.howToReadTieClass` stály v knize znovu jako
    // literály, znak po znaku shodné s klíči, které katalog už nesl.
    expect(cs["shared.rejected"]).toBe("zamítnuto");
    expect(en["shared.rejected"]).toBe("rejected");
    expect(cs["shared.howToReadTieClass"]).toBe("jak číst třídu vazby");
    expect(en["shared.howToReadTieClass"]).toBe("how to read the tie class");
    // …a nevznikla pro ně druhá, ledgerová kopie.
    for (const k of ["real.ledger.rejected", "real.ledger.howToReadTieClass"]) {
      expect(cs[k], `${k} is a duplicate of a live shared key`).toBeUndefined();
      expect(en[k], `${k} is a duplicate of a live shared key`).toBeUndefined();
    }
  });

  it("the result count is an ICU plural over the counted noun, not a formatted string", () => {
    // „3 z 211 vazeb" se sázelo šablonovým řetězcem v komponentě, takže české
    // skloňování bylo zafixované na „vazeb" pro každý počet.
    for (const ns of [cs, en]) {
      expect(placeholders(ns["real.ledger.resultCount"])).toEqual(["shownFmt", "total", "totalFmt"]);
      expect(ns["real.ledger.resultCount"]).toMatch(/\{total, plural,/);
    }
    for (const form of ["one", "few", "other"]) {
      expect(cs["real.ledger.resultCount"], `cs plural category ${form}`).toContain(`${form} {`);
    }
    // Čeština má tři kategorie a jednotné číslo se od nich MUSÍ lišit —
    // „1 vazby" a „5 vazeb" nejsou totéž.
    const one = /one \{\{totalFmt\} ([^}]+)\}/.exec(cs["real.ledger.resultCount"])![1];
    const other = /other \{\{totalFmt\} ([^}]+)\}/.exec(cs["real.ledger.resultCount"])![1];
    expect(one).not.toEqual(other);
  });

  it("the sort control's header names what it sorts BY, not what the cell shows", () => {
    // Komparátor je `reviewRank` — korroborace nejdřív, peníze až uvnitř úrovně
    // (reviewTypes.ts) — a hlavička nad ním četla „třída".
    expect(cs["real.ledger.colEvidence"]).toBe("síla důkazu");
    expect(en["real.ledger.colEvidence"]).toBe("evidence strength");
    expect(cs["real.ledger.colEvidence"]).not.toMatch(/^třída$/);
    // A pravidlo se na ploše VYPISUJE: korroborace před penězi, obojí pojmenované.
    for (const [locale, ns] of [
      ["cs", cs],
      ["en", en],
    ] as const) {
      const rule = ns["real.ledger.evidenceRule"];
      expect(rule, `${locale}.evidenceRule names corroboration`).toMatch(/korrobora|rejstřík|corroborat|registry/i);
      expect(rule, `${locale}.evidenceRule names money`).toMatch(/peníz|částk|money|amount/i);
    }
  });

  it("the reach note stops claiming the column and the tiles sum the same way", () => {
    // Sloupec je dosah JEDNÉ vazby a firma vázaná víc poslanci se opakuje na víc
    // řádcích; dlaždice počítají firmu jednou. Věta tvrdila „táž definice".
    expect(cs["real.ledger.reachNote"]).not.toMatch(/táž definice/);
    expect(en["real.ledger.reachNote"]).not.toMatch(/the same definition the tiles/);
    expect(cs["real.ledger.reachNote"]).toMatch(/sečíst|opakuje/);
    expect(en["real.ledger.reachNote"]).toMatch(/summed|repeats/);
    // …a to bez vysázeného počtu firem: disclosure se počítá, nepíše.
    for (const ns of [cs, en]) expect(ns["real.ledger.reachNote"]).not.toMatch(LITERAL_COUNT);
  });

  it("the real ledger's aside describes the real ledger", () => {
    // `sections.ledger.aside` („seskupeno po poslancích") popisuje MOCK; reálná
    // kniha je plochá, filtrovatelná, řaditelná a stránkovaná.
    expect(cs["sections.ledger.aside"]).toContain("seskupeno po poslancích");
    expect(cs["sections.ledger.asideReal"]).not.toContain("seskupeno po poslancích");
    for (const [locale, v] of [
      ["cs", cs["sections.ledger.asideReal"]],
      ["en", en["sections.ledger.asideReal"]],
    ] as const) {
      expect(v, `${locale}.asideReal names the real controls`).toMatch(
        /filtr|řaz|stránkov|filter|sort|pagination/i,
      );
    }
  });

  it("six dead keys are gone from BOTH catalogs", () => {
    // Mrtvý klíč s tvrzením je pozvánka, aby ho někdo zase někam vysázel.
    for (const k of [
      "real.stats.ownerSub",
      "real.stats.ownerSource",
      "real.stats.reachableSub",
      "real.ledger.reachLabel",
      "real.ledger.contractsLabel",
      "real.ledger.noReach",
    ]) {
      expect(cs[k], `cs.${k} is dead`).toBeUndefined();
      expect(en[k], `en.${k} is dead`).toBeUndefined();
    }
    // …a jejich živí jmenovci zůstávají, protože je někdo vykresluje.
    for (const k of ["companyFile.reachLabel", "caseFile.contractsLabel", "packet.noReach"]) {
      expect(cs[k], `cs.${k}`).toBeTruthy();
      expect(en[k], `en.${k}`).toBeTruthy();
    }
  });

  it("the sample tile's ratio is an argument, never a typed pair of numbers", () => {
    // „u 3 z 5 sledovaných poslanců" byl literál nad vzorkem, který ten poměr
    // nese sám (MONEY_TIES × MPS) — přidaná ukázková vazba by z něj udělala lež.
    for (const ns of [cs, en]) {
      expect(placeholders(ns["stats.sampleTies.sub"])).toEqual(["total", "totalFmt", "withTiesFmt"]);
      expect(ns["stats.sampleTies.sub"]).not.toMatch(LITERAL_COUNT);
    }
  });

  it("no step cadence claims a number nobody in this repo measures", () => {
    // „500 dotazů za minutu" byla necitovaná vlastnost cizího API.
    for (const ns of [cs, en]) {
      for (const k of STEP_KEYS) {
        expect(ns[`method.steps.${k}.cadence`], `${k}.cadence quotes a rate limit`).not.toMatch(
          /\b\d+\s*(dotaz|požadav|request|call)/i,
        );
      }
    }
  });

  it("the featured graph can say it is a crop, in both locales", () => {
    for (const ns of [cs, en]) {
      expect(placeholders(ns["real.graphCap"])).toEqual(["shownFmt", "total", "totalFmt"]);
      expect(ns["real.graphCap"]).toMatch(/\{total, plural,/);
    }
    expect(looksEnglish(cs["real.graphCap"]), "cs.real.graphCap").toBe(false);
  });

  it("strety and kauzy name each other, and the labels are catalog copy", () => {
    for (const k of ["strety.leadDossiers", "kauzy.voteCollisions"]) {
      expect(cs[k], `cs.${k}`).toBeTruthy();
      expect(en[k], `en.${k}`).toBeTruthy();
      expect(cs[k], `${k} is not translated`).not.toEqual(en[k]);
    }
    expect(cs["strety.leadDossiers"]).toContain("/penize/kauzy");
    expect(cs["kauzy.voteCollisions"]).toContain("/penize/strety");
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
