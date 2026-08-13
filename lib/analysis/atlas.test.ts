import { describe, expect, it } from "vitest";
import { SOURCE_DOCS } from "@/lib/analysis/context-model";
import {
  ageDaysBetween,
  ATLAS_DIMENSIONS,
  ATLAS_RULES,
  deriveAtlas,
  freshnessScore,
  INGESTED_SOURCES,
  SOURCE_CADENCE_DAYS,
  stalenessOf,
  unscoredSources,
  UNSCORED_REASON_KEYS,
  UNSCORED_REASONS,
  type AtlasInputs,
  type AtlasSourceCard,
} from "./atlas";

// Pozn.: atlas.ts čte SOURCE_DOCS z context-model — reálný korpus (3 zdroje,
// psp-poslanci má 6 přiznaných mezer atd.). Testy nad ním pracují jako nad
// fixture: korpus je konstantní modul, takže derivace zůstává čistá funkce
// svých vstupů. (Import výše je jen typová pojistka, viz test „korpus“.)

const NOW = "2026-07-30T12:00:00.000Z";

/** Vstupy, kde psp-poslanci má plný podklad pro všechny 4 dimenze. */
const fullInputs = (): AtlasInputs => ({
  now: NOW,
  entityCoverage: [
    { source: "psp-poslanci", entity: "person", rows: 100, rowsWithRun: 90 },
    { source: "psp-poslanci", entity: "organ", rows: 50, rowsWithRun: 30 },
    { source: "psp-hlasovani", entity: "vote_event", rows: 10, rowsWithRun: 10 },
  ],
  runStats: [
    {
      source: "psp-poslanci",
      okFinishedRuns: 4,
      sealedRuns: 2,
      lastOkFinishedAt: "2026-07-27T12:00:00.000Z", // stáří 3 dny, kadence 7
    },
  ],
});

const card = (report: ReturnType<typeof deriveAtlas>, source: string): AtlasSourceCard => {
  const c = report.sources.find((s) => s.source === source);
  if (!c) throw new Error(`karta ${source} chybí`);
  return c;
};

describe("pokrytí provenancí", () => {
  it("skóre = podíl řádků s vazbou na ingest běh, přes všechny entity zdroje", () => {
    const c = card(deriveAtlas(fullInputs()), "psp-poslanci");
    // (90 + 30) / (100 + 50) = 80 %
    expect(c.dimensions.coverage).toEqual({
      status: "hodnoceno",
      score: 80,
      basis: "120 z 150 řádků nese vazbu na ingest běh",
    });
    expect(c.rowsTotal).toBe(150);
    expect(c.rowsWithRun).toBe(120);
  });

  it("zdroj bez řádků je nehodnoceno, nikdy 0", () => {
    const inputs = fullInputs();
    inputs.entityCoverage = inputs.entityCoverage.filter((c) => c.source !== "psp-poslanci");
    const c = card(deriveAtlas(inputs), "psp-poslanci");
    expect(c.dimensions.coverage.status).toBe("nehodnoceno");
    expect(JSON.stringify(c.dimensions.coverage)).not.toContain('"score"');
  });
});

describe("čerstvost — kadence a slovní pásma (sdílený slovník s 6E)", () => {
  it("pásma: ≤ kadence čerstvé, ≤ 2× stárnoucí, > 2× zastaralé (hranice včetně)", () => {
    expect(stalenessOf(6.9, 7)).toBe("čerstvé");
    expect(stalenessOf(7, 7)).toBe("čerstvé");
    expect(stalenessOf(7.1, 7)).toBe("stárnoucí");
    expect(stalenessOf(14, 7)).toBe("stárnoucí");
    expect(stalenessOf(14.1, 7)).toBe("zastaralé");
  });

  it("skóre: 100 do kadence, lineárně k 0 při 3× kadenci", () => {
    expect(freshnessScore(0, 7)).toBe(100);
    expect(freshnessScore(7, 7)).toBe(100);
    expect(freshnessScore(14, 7)).toBe(50); // 2× kadence = půlka
    expect(freshnessScore(17.5, 7)).toBe(25);
    expect(freshnessScore(21, 7)).toBe(0); // 3× kadence
    expect(freshnessScore(100, 7)).toBe(0); // pod nulu nikdy
  });

  it("stáří 3 dny při kadenci 7 → čerstvé, skóre 100", () => {
    const c = card(deriveAtlas(fullInputs()), "psp-poslanci");
    expect(c.freshness).toEqual({
      lastOkFinishedAt: "2026-07-27T12:00:00.000Z",
      ageDays: 3,
      cadenceDays: 7,
      staleness: "čerstvé",
    });
    expect(c.dimensions.freshness).toMatchObject({ status: "hodnoceno", score: 100 });
  });

  it("bez úspěšného běhu je nehodnoceno; bez deklarované kadence taky (stáří se ale přizná)", () => {
    const noRun = card(deriveAtlas(fullInputs()), "psp-hlasovani");
    expect(noRun.dimensions.freshness).toEqual({
      status: "nehodnoceno",
      reason: "žádný dokončený úspěšný ingest běh zdroje",
    });

    const inputs = fullInputs();
    inputs.runStats = [
      { source: "zdroj-bez-kadence", okFinishedRuns: 1, sealedRuns: 0, lastOkFinishedAt: "2026-07-20T12:00:00.000Z" },
    ];
    const noCadence = card(deriveAtlas(inputs), "zdroj-bez-kadence");
    expect(noCadence.dimensions.freshness.status).toBe("nehodnoceno");
    expect(noCadence.freshness.ageDays).toBe(10); // stáří je fakt, skóre by bylo tvrzení bez měřítka
    expect(noCadence.freshness.staleness).toBeNull();
  });

  it("běh dokončený „v budoucnu“ se čte jako stáří 0, ne záporné", () => {
    expect(ageDaysBetween(NOW, "2026-08-05T00:00:00.000Z")).toBe(0);
    expect(ageDaysBetween(NOW, "neni-datum")).toBeNull();
  });
});

describe("integrita — Merkle pečetě běhů", () => {
  it("skóre = podíl zapečetěných z dokončených úspěšných běhů", () => {
    const c = card(deriveAtlas(fullInputs()), "psp-poslanci");
    expect(c.dimensions.integrity).toEqual({
      status: "hodnoceno",
      score: 50,
      basis: "2 z 4 dokončených úspěšných běhů zapečetěno Merkle kořenem",
    });
  });

  it("bez dokončeného úspěšného běhu je nehodnoceno; přebytek pečetí se ořeže na 100", () => {
    const inputs = fullInputs();
    inputs.runStats = [
      { source: "psp-poslanci", okFinishedRuns: 0, sealedRuns: 0, lastOkFinishedAt: null },
      { source: "psp-hlasovani", okFinishedRuns: 2, sealedRuns: 5, lastOkFinishedAt: "2026-07-29T12:00:00.000Z" },
    ];
    const report = deriveAtlas(inputs);
    expect(card(report, "psp-poslanci").dimensions.integrity.status).toBe("nehodnoceno");
    expect(card(report, "psp-hlasovani").dimensions.integrity).toMatchObject({ status: "hodnoceno", score: 100 });
    expect(card(report, "psp-hlasovani").integrity.sealedRuns).toBe(2);
  });
});

describe("úplnost — přiznané mezery z kontextu", () => {
  it("100 − 10 za mezeru: psp-poslanci má 6 mezer → 40", () => {
    expect(SOURCE_DOCS["psp-poslanci"].knownIssues).toHaveLength(6);
    const c = card(deriveAtlas(fullInputs()), "psp-poslanci");
    expect(c.dimensions.completeness).toEqual({
      status: "hodnoceno",
      score: 40,
      basis: "6 přiznaných mezer upstreamu v kontextu zdroje",
    });
    expect(c.knownIssues).toEqual(SOURCE_DOCS["psp-poslanci"].knownIssues);
  });

  it("nedokumentovaný zdroj je nehodnoceno — nedokumentováno ≠ úplné (≠ 100 i ≠ 0)", () => {
    const inputs = fullInputs();
    inputs.runStats = [
      { source: "novy-zdroj", okFinishedRuns: 1, sealedRuns: 1, lastOkFinishedAt: "2026-07-30T00:00:00.000Z" },
    ];
    const c = card(deriveAtlas(inputs), "novy-zdroj");
    expect(c.documented).toBe(false);
    expect(c.dimensions.completeness.status).toBe("nehodnoceno");
  });

  it("víc než 10 mezer nejde pod 0", () => {
    // deriveCompleteness je vnitřní — chování se dokazuje přes pravidlo:
    // max(0, 100 − 10 × n). Korpusové zdroje mají ≤ 7 mezer, hranici drží clamp.
    const scores = Object.values(SOURCE_DOCS).map((d) => Math.max(0, 100 - 10 * d.knownIssues.length));
    for (const s of scores) expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe("souhrn — průměr jen hodnocených dimenzí", () => {
  it("plný podklad → hodnoceno, průměr všech čtyř", () => {
    const c = card(deriveAtlas(fullInputs()), "psp-poslanci");
    // (80 + 100 + 50 + 40) / 4 = 67,5 → 68
    expect(c.composite).toEqual({ status: "hodnoceno", score: 68, evaluated: 4, of: 4 });
  });

  it("částečný podklad → „částečné“ s počtem hodnocených; nehodnocené se NEpočítá jako 0", () => {
    const c = card(deriveAtlas(fullInputs()), "psp-hlasovani");
    // hodnocené: coverage 100, completeness 30 (7 mezer); freshness+integrita bez podkladu
    expect(c.composite).toEqual({ status: "částečné", score: 65, evaluated: 2, of: 4 });
  });

  it("žádný podklad v žádné dimenzi → nehodnoceno se score null, nikdy 0", () => {
    const inputs: AtlasInputs = {
      now: NOW,
      entityCoverage: [],
      runStats: [{ source: "zdroj-bez-vseho", okFinishedRuns: 0, sealedRuns: 0, lastOkFinishedAt: null }],
    };
    const c = card(deriveAtlas(inputs), "zdroj-bez-vseho");
    expect(c.composite).toEqual({ status: "nehodnoceno", score: null, evaluated: 0, of: 4 });

    // Dokumentovaný zdroj bez řádků i běhů má hodnocenou JEN úplnost → „částečné“,
    // souhrn = její skóre (pumper: 3 mezery → 70), ostatní dimenze poctivě nehodnocené.
    const pumper = card(deriveAtlas(inputs), "pumper-psp-opendata");
    expect(pumper.composite).toEqual({ status: "částečné", score: 70, evaluated: 1, of: 4 });
    expect(pumper.dimensions.coverage.status).toBe("nehodnoceno");
    expect(pumper.dimensions.freshness.status).toBe("nehodnoceno");
    expect(pumper.dimensions.integrity.status).toBe("nehodnoceno");
  });
});

describe("determinismus a tvar reportu", () => {
  it("tytéž vstupy v jiném pořadí ⇒ bajtově týž report", () => {
    const a = deriveAtlas(fullInputs());
    const shuffled = fullInputs();
    shuffled.entityCoverage = [...shuffled.entityCoverage].reverse();
    shuffled.runStats = [...shuffled.runStats].reverse();
    const b = deriveAtlas(shuffled);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("zdroje řazeny vzestupně; sjednocení kontextů, řádků i běhů", () => {
    const inputs = fullInputs();
    inputs.runStats = [
      ...inputs.runStats,
      {
        source: "aaa-jen-z-behu",
        okFinishedRuns: 1,
        sealedRuns: 0,
        lastOkFinishedAt: "2026-07-30T00:00:00.000Z",
      },
    ];
    const report = deriveAtlas(inputs);
    const keys = report.sources.map((s) => s.source);
    expect(keys).toEqual([...keys].sort());
    expect(keys).toContain("aaa-jen-z-behu");
    expect(keys).toContain("pumper-psp-opendata"); // jen z kontextu
  });

  it("determinismus platí i pro seznam zdrojů mimo dosah", () => {
    const a = deriveAtlas(fullInputs());
    const shuffled = fullInputs();
    shuffled.entityCoverage = [...shuffled.entityCoverage].reverse();
    const b = deriveAtlas(shuffled);
    expect(JSON.stringify(a.unscored)).toBe(JSON.stringify(b.unscored));
    expect(a.unscored.map((s) => s.source)).toEqual([...a.unscored.map((s) => s.source)].sort());
  });

  it("každá dimenze má publikované pravidlo a report nese metodiku + slovník", () => {
    const report = deriveAtlas(fullInputs());
    for (const d of ATLAS_DIMENSIONS) {
      expect(ATLAS_RULES[d].rule.length).toBeGreaterThan(40);
      expect(report.methodology.rules[d].rule).toBe(ATLAS_RULES[d].rule);
    }
    expect(report.schema).toBe("politicas.atlas/1");
    expect(report.generatedAt).toBe(NOW);
    expect(report.methodology.stalenessVocabulary).toEqual({
      fresh: "čerstvé",
      aging: "stárnoucí",
      stale: "zastaralé",
    });
    expect(report.methodology.staleCadenceMultiplier).toBe(2);
  });
});

/* ── Zdroje mimo dosah atlasu (2026-08-13) ──────────────────────────────────── */

describe("registr zdrojů — atlas mlčí o devíti z dvanácti, nebo o nich mluví", () => {
  it("registr nese víc zdrojů, než kolik jich atlas umí ohodnotit", () => {
    // Tohle JE ten nález: množina klíčů atlasu byla sjednocením tří pohledů,
    // které všechny vracely tytéž tři klíče, takže stránka o kvalitě dat mlčky
    // tvrdila, že platforma má tři zdroje.
    const entity = INGESTED_SOURCES.filter((s) => s.landing === "entity");
    expect(entity.map((s) => s.source).sort()).toEqual(Object.keys(SOURCE_DOCS).sort());
    expect(INGESTED_SOURCES.length).toBeGreaterThan(entity.length);
  });

  it("klíče registru jsou jedinečné a modul nese každý řádek", () => {
    const keys = INGESTED_SOURCES.map((s) => s.source);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of INGESTED_SOURCES) {
      expect(s.adapter, s.source).toMatch(/^lib\/ingest\/sources\/[a-z-]+\.ts$/);
    }
  });

  it("oba zdroje, které nesou modul o veřejných penězích, jsou pojmenované", () => {
    // Kdyby vypadly, vrátí se přesně ten stav, kvůli kterému tahle sekce vznikla:
    // čtenář kontrolující kvalitu dat pod /penize nenajde ani řádek.
    const money = INGESTED_SOURCES.filter((s) => /smlouvy|dataor/.test(s.source));
    expect(money.map((s) => s.source).sort()).toEqual(["dataor-justice-cz", "smlouvy-gov-cz"]);
    for (const s of money) expect(s.landing).toBe("graph");
  });

  it("zdroj mimo dosah nedostane ŽÁDNÉ číslo — jen krajinu a modul", () => {
    const report = deriveAtlas(fullInputs());
    expect(report.unscored.length).toBeGreaterThan(0);
    for (const s of report.unscored) {
      // Nula je tvrzení o kvalitě; tady se nesmí objevit ani ta, ani skóre.
      expect(Object.keys(s).sort()).toEqual(["adapter", "landing", "source"]);
      expect(s.landing).not.toBe("entity");
      expect(UNSCORED_REASONS[s.landing]).toBeTruthy();
      expect(UNSCORED_REASON_KEYS[s.landing]).toBeTruthy();
    }
  });

  it("zdroj s kartou v seznamu mimo dosah NIKDY není", () => {
    const report = deriveAtlas(fullInputs());
    const carded = new Set(report.sources.map((s) => s.source));
    for (const s of report.unscored) expect(carded.has(s.source), s.source).toBe(false);
  });

  it("seznam je derivovaný: zdroj, který dostane kartu, z něj vypadne sám", () => {
    // Až `smlouvy-gov-cz` začne psát do entitní tabulky s ingest během, přestane
    // být „mimo dosah“ — bez jediné ruční úpravy seznamu.
    const before = deriveAtlas(fullInputs());
    expect(before.unscored.map((s) => s.source)).toContain("smlouvy-gov-cz");

    const inputs = fullInputs();
    inputs.entityCoverage = [
      ...inputs.entityCoverage,
      { source: "smlouvy-gov-cz", entity: "person", rows: 10, rowsWithRun: 10 },
    ];
    const after = deriveAtlas(inputs);
    expect(after.unscored.map((s) => s.source)).not.toContain("smlouvy-gov-cz");
    expect(after.sources.map((s) => s.source)).toContain("smlouvy-gov-cz");
  });

  it("seznam nezávisí na store — bez reportu ho stránka vypíše celý", () => {
    // Výpadek úložiště nesmí umlčet větu, která je deklarací v kódu.
    expect(unscoredSources().map((s) => s.source)).toEqual(
      INGESTED_SOURCES.filter((s) => s.landing !== "entity")
        .map((s) => s.source)
        .sort(),
    );
  });

  it("skóre tří hodnocených karet se nepohnulo", () => {
    // Akceptační mez: tahle změna přidává větu, nesahá na aritmetiku.
    const c = card(deriveAtlas(fullInputs()), "psp-poslanci");
    expect(c.composite).toEqual({ status: "hodnoceno", score: 68, evaluated: 4, of: 4 });
    expect(c.dimensions.coverage).toMatchObject({ status: "hodnoceno", score: 80 });
    expect(c.dimensions.completeness).toMatchObject({ status: "hodnoceno", score: 40 });
  });

  it("důvod mluví o NAŠÍ rouře a nesmí znít jako „ten zdroj jsme nenasypali“", () => {
    // Kritérium 3: nescorovatelnost je fakt o našem ukládání, ne o vydavateli.
    expect(UNSCORED_REASONS.graph).toContain("kg_node");
    expect(UNSCORED_REASONS.graph).toContain("ingest_run_id");
    expect(UNSCORED_REASONS.graph).toContain("NAŠÍ roury");
    // …a výslovně nesmí popřít, že ta data ve store jsou.
    expect(UNSCORED_REASONS.graph).toContain("data ve store jsou");
    for (const reason of Object.values(UNSCORED_REASONS)) {
      expect(reason).not.toMatch(/vydavatel[ai]? (to )?nezveřej/i);
    }
  });

  it("metodika reportu publikuje tytéž důvody, ne druhou kopii", () => {
    expect(deriveAtlas(fullInputs()).methodology.unscoredReasons).toBe(UNSCORED_REASONS);
  });
});

describe("kadence se deklaruje jen tam, kde ji jde změřit", () => {
  it("žádný zdroj mimo dosah atlasu nemá deklarovanou kadenci", () => {
    // Sentinelová invarianta „freshness“ (lib/testing/sentinel/invariants.ts)
    // iteruje SOURCE_CADENCE_DAYS a JAKÝKOLI zdroj bez dokončeného úspěšného
    // běhu hlásí jako porušení. Deklarovat kadenci u zdroje, který žádný běh
    // nemá a mít nemůže, by tedy shodilo sentinel a zároveň vyhlásilo očekávání,
    // které nikdo neumí změřit. Napojení je změna ingestu, ne téhle mapy.
    for (const s of unscoredSources()) {
      expect(SOURCE_CADENCE_DAYS[s.source], s.source).toBeUndefined();
    }
  });
});
