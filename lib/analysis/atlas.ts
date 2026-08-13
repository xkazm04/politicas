/*
 * ATLAS KVALITY OTEVŘENÝCH DAT (batch-6 item 6D) — čistá derivace publikovaných
 * skóre kvality per zdroj. Zdrojový návrh: data-layer.md § Knowledge Graph
 * Domain Model M2 („federate the context catalog“) — institucionální paměť
 * z lib/analysis/context-model.ts (SOURCE_DOCS) se stává veřejnou stránkou
 * /atlas + strojově čitelným /atlas/atlas.json.
 *
 * ── Disciplína (stejná jako features/data-releases/manifest.ts) ────────────
 * 1. ČISTOTA: žádný store, žádný fetch, žádné Date.now() — okamžik hodnocení
 *    (`now`) je vstup, takže tytéž vstupy dají vždy týž report (determinismus
 *    je testovaný).
 * 2. PRAVIDLO JE SOUČÁST SKÓRE: každá dimenze nese své pravidlo jako text
 *    (ATLAS_RULES) a report ho publikuje vedle čísla — skóre bez vytištěného
 *    pravidla neexistuje. Pravidlo existuje DVAKRÁT: tady (a odsud v
 *    /atlas/atlas.json) a jako katalogová věta `atlas.dimension.*.rule`, kterou
 *    sází lidská stránka. Do 2026-08-13 je nedrželo pohromadě NIC — jediný test
 *    porovnával report sám se sebou. Drží je teď features/atlas/messages.test.ts
 *    (bajtová shoda české věty s ATLAS_RULES po dosazení ICU parametrů); rozejít
 *    se tiše už nemohou. Prahy pravidla se dosazují z konstant
 *    (ATLAS_RULE_PARAMS), ne přepisují — jinak by změna konstanty pohnula skórem
 *    a ne větou, která ho vysvětluje.
 * 3. POCTIVÉ NEZNÁMÉ: dimenze bez podkladu je „nehodnoceno“ s důvodem, nikdy
 *    0 — nula je tvrzení o kvalitě, nehodnoceno je tvrzení o podkladu.
 * 4. SLOVNÍK KADENCE je sdílený s /admin smyčkami (batch-6 §6E, koherence přes
 *    znění, ne importy): „kadence“ = deklarovaný očekávaný interval obnovy;
 *    stáří ≤ kadence → „čerstvé“; ≤ 2× kadence → „stárnoucí“; > 2× kadence →
 *    „zastaralé“ (týž práh kadence×2, kterým smyčky hlásí „stalled“).
 */

import { SOURCE_DOCS } from "@/lib/analysis/context-model";

export const ATLAS_SCHEMA = "politicas.atlas/1";

export type AtlasDimension = "coverage" | "freshness" | "integrity" | "completeness";

export const ATLAS_DIMENSIONS: readonly AtlasDimension[] = [
  "coverage",
  "freshness",
  "integrity",
  "completeness",
] as const;

/** Stáří poslední obnovy vůči deklarované kadenci — sdílený slovník s 6E. */
export type Staleness = "čerstvé" | "stárnoucí" | "zastaralé";

/** Hranice „zastaralé“: stáří > kadence × 2 (týž násobek jako „stalled“ u smyček). */
export const STALE_CADENCE_MULTIPLIER = 2;
/** Skóre čerstvosti klesá lineárně k 0 při stáří = kadence × 3. */
export const ZERO_CADENCE_MULTIPLIER = 3;
/** Srážka úplnosti za jednu přiznanou mezeru upstreamu. */
export const COMPLETENESS_POINTS_PER_ISSUE = 10;

/**
 * Deklarovaná kadence obnovy per zdroj, ve dnech. Je to OČEKÁVÁNÍ politicas
 * (jak často má smysl znovu nasypat), ne SLA vydavatele — publikuje se s tímto
 * přiznáním. Zdroj bez deklarované kadence má čerstvost „nehodnoceno“.
 */
export const SOURCE_CADENCE_DAYS: Readonly<Record<string, number>> = {
  "psp-poslanci": 7,
  "psp-hlasovani": 7,
  // Sentinel finding 2026-07-31: the original 1-day expectation assumed Pumper
  // runs as an always-on daemon. In reality Pumper (localhost:8088) is started
  // alongside ingest sessions, and this source is mirrored on the same rhythm
  // as the other psp snapshot pulls — so 1 day declared a promise nobody keeps
  // and the freshness score measured an aspiration, not the operation. 7 days
  // matches how the mirror is actually operated; cadences remain politicas'
  // declared expectations, not publisher SLAs (see ATLAS_RULES.freshness).
  "pumper-psp-opendata": 7,
};

/**
 * Prahy, které pravidla CITUJÍ. Vytištěné pravidlo nesmí opsat číslo, které
 * jinde v tomhle souboru žije jako konstanta — jinak se změna konstanty
 * projeví ve skóre a NE v pravidle, které to skóre vysvětluje. Táž mapa je
 * ICU parametrizací katalogových vět (`atlas.dimension.*.rule`), takže se
 * strojový report i lidská stránka přeformulují jedním zápisem.
 *
 * `String()`, ne `lib/format.ts`: tenhle modul je čistý a bez Intl (verze ICU
 * se v repu už jednou rozešla a shodila hydrataci). Že se obě podoby čísla
 * shodují pro DNEŠNÍ hodnoty, drží test (features/atlas/messages.test.ts) —
 * konstanta ≥ 1000 ho shodí a někdo o tom musí rozhodnout, ne ji protlačit.
 */
export const ATLAS_RULE_PARAMS: Readonly<Record<"stale" | "zero" | "points", string>> = {
  stale: String(STALE_CADENCE_MULTIPLIER),
  zero: String(ZERO_CADENCE_MULTIPLIER),
  points: String(COMPLETENESS_POINTS_PER_ISSUE),
};

/** Pravidlo každé dimenze — publikuje se VEDLE skóre, doslova. */
export const ATLAS_RULES: Readonly<Record<AtlasDimension, { label: string; rule: string }>> = {
  coverage: {
    label: "pokrytí provenancí",
    rule:
      "100 × (řádky zdroje s vazbou na ingest běh / všechny řádky zdroje ve store), zaokrouhleno. " +
      "Řádek bez ingest_run_id nese jen částečný původ (source + url + fetched_at), řádek s ním je " +
      "dohledatelný až k běhu, který ho zapsal. Zdroj bez řádků = nehodnoceno.",
  },
  freshness: {
    label: "čerstvost",
    rule:
      "Stáří = dnešek minus dokončení posledního úspěšného ingest běhu zdroje. Skóre 100 při stáří " +
      `≤ kadence, pak lineárně k 0 při stáří = ${ATLAS_RULE_PARAMS.zero}× kadence. Slovně: ≤ kadence „čerstvé“, ≤ ${ATLAS_RULE_PARAMS.stale}× kadence ` +
      `„stárnoucí“, nad ${ATLAS_RULE_PARAMS.stale}× kadence „zastaralé“. Kadence je deklarované očekávání politicas, ne SLA ` +
      "vydavatele. Bez deklarované kadence nebo bez úspěšného běhu = nehodnoceno.",
  },
  integrity: {
    label: "integrita",
    rule:
      "100 × (dokončené úspěšné běhy zdroje zapečetěné Merkle kořenem / všechny dokončené úspěšné " +
      "běhy zdroje), zaokrouhleno. Pečeť přikládá LedgerRepository.sealIngestRun nad každým řádkem, " +
      "který běh zapsal. Zdroj bez dokončeného úspěšného běhu = nehodnoceno.",
  },
  completeness: {
    label: "úplnost",
    rule:
      `100 minus ${ATLAS_RULE_PARAMS.points} bodů za každou přiznanou mezeru upstreamu (KNOWN ISSUES v kontextu zdroje, ` +
      "lib/analysis/context-model.ts), nejméně 0. Nízké skóre je výpověď o datech vydavatele, ne o " +
      "zpracování politicas — mezery se přiznávají, neschovávají. Zdroj bez zpracovaného kontextu " +
      "= nehodnoceno (nedokumentováno ≠ úplné).",
  },
};

/* ── Zdroje, které atlas změřit NEUMÍ (a přesto o nich musí mluvit) ──────────── */

/**
 * Kam řádky zdroje dopadají — a tím i jestli je atlas UMÍ ohodnotit.
 *
 * `entity`  — do osmi tabulek s provenance kvartetem (source, source_url,
 *             fetched_at, ingest_run_id). Jediná krajina, kterou atlas měří.
 * `graph`   — do kg_node / kg_edge. Ty NEMAJÍ sloupec `source` ani
 *             `ingest_run_id` (lib/db/pglite/ddl.ts, lib/db/pglite/mappers.ts):
 *             původ je volný text v `provenance.ref`, takže mezi řádkem a
 *             tabulkou `ingest_run` nevede žádný spojovací klíč.
 * `generated-module` — do generovaného modulu v repozitáři, který plocha čte
 *             přímo; do úložiště nedopadne nic.
 * `none`    — nikam: adaptér existuje a je otestovaný, ale v produktu ho nic
 *             nečte.
 */
export type AtlasLanding = "entity" | "graph" | "generated-module" | "none";

/** Krajiny, ve kterých atlas nemá co měřit — doplněk `entity`. */
export type AtlasUnscorableLanding = Exclude<AtlasLanding, "entity">;

/** Deklarovaný zdroj: klíč, modul, který ho čte, a kam jeho řádky dopadají. */
export interface AtlasIngestedSource {
  source: string;
  /** Modul, který zdroj čte — vysází se DOSLOVA jako dohledatelný důkaz. */
  adapter: string;
  landing: AtlasLanding;
}

/**
 * VŠECHNY zdroje, se kterými tenhle repozitář pracuje — ne jen ty tři, které
 * atlas umí ohodnotit.
 *
 * PROČ TENHLE SEZNAM VZNIKL (2026-08-13). Množina zdrojů atlasu byla sjednocením
 * tří pohledů (SOURCE_DOCS ∪ řádky ∪ běhy), jenže všechny tři vracely TYTÉŽ TŘI
 * klíče — takže stránka o kvalitě dat mlčky tvrdila, že platforma má tři zdroje.
 * Devět dalších se na svou vlastní stránku kvality nikdy nedostalo, mezi nimi
 * OBA, které nesou celé /penize (registr smluv a bulk ISVR z dataor.justice.cz).
 * Čtenář, který si přišel ověřit kvalitu dat pod modulem jmenujícím firmy a
 * smlouvy, nenašel ani řádek. Mlčení o devíti z dvanácti je jediný výsledek,
 * který si tahle stránka nesmí dovolit.
 *
 * SEZNAM SE NEHODNOTÍ, JEN POJMENOVÁVÁ. Zdroj odsud nedostane žádné skóre —
 * dostane větu, kam jeho řádky dopadají a proč to atlas neumí změřit. Rozšířit
 * atlas tak, aby SKÓROVAL kg_node/kg_edge, je vědomě mimo: pravidlo integrity
 * tiskne, že zapečetěná a hodnocená množina tabulek je táž, a to je změna
 * ingestu a ledgeru, ne renderu. Mez se pojmenuje, netlačí se přes vytištěné
 * pravidlo.
 *
 * KAŽDÝ ŘÁDEK JE OVĚŘENÝ NAD STROMEM (2026-08-13), ne opsaný z návrhu:
 *  · `psp-tisky` / `psp-interp` / `psp-steno` — konstanty existují
 *    (lib/ingest/sources/psp-activity.ts:20-22), ale do store je nerazí nikdo;
 *    kg-contribution-ingest.ts slučuje props na hotové `psp:person:*` uzly a
 *    provenienci uzlu ZÁMĚRNĚ zachovává,
 *  · `psp-tisky-law` — kg-legislation-ingest.ts:115 razí `ref: "psp-tisky"`,
 *    tedy JINÝ řetězec, než modul exportuje; hlášeno, neopravuje se odsud
 *    (lib/ingest a scripts nejsou tahle plocha),
 *  · `kiosek-uredni-deska` — jediný, jehož konstanta se vůbec používá, a i tak
 *    jen do struktury v paměti; přes JSON payload do kg_node se `source`
 *    ztrácí (memory/kg-has-no-source-urls.md tu mezeru popisuje),
 *  · `smlouvy-gov-cz` a `dataor-justice-cz` — adaptéry NEEXPORTUJÍ žádný klíč,
 *    takže klíč tady je deklarace atlasu, ne řetězec ze store; dohledatelné je
 *    `adapter` a `provenance.ref` na řádcích,
 *  · `monitor-statni-pokladna` — z monitor.ts se importují jen čisté pomocné
 *    funkce; čísla žijí v features/budget/data/*.generated.ts,
 *  · `volby-ps2025-candidates` — modul nemá v celém stromě JINÉHO importéra než
 *    vlastní test. Uvádí se právě proto, že se NENASYPÁVÁ: tvrdit o něm opak by
 *    byla nepravda na stránce, jejímž předmětem je nepravdy netvrdit.
 */
export const INGESTED_SOURCES: readonly AtlasIngestedSource[] = [
  { source: "psp-poslanci", adapter: "lib/ingest/sources/psp.ts", landing: "entity" },
  { source: "psp-hlasovani", adapter: "lib/ingest/sources/psp.ts", landing: "entity" },
  { source: "pumper-psp-opendata", adapter: "lib/ingest/sources/pumper.ts", landing: "entity" },
  { source: "psp-tisky", adapter: "lib/ingest/sources/psp-activity.ts", landing: "graph" },
  { source: "psp-interp", adapter: "lib/ingest/sources/psp-activity.ts", landing: "graph" },
  { source: "psp-steno", adapter: "lib/ingest/sources/psp-activity.ts", landing: "graph" },
  { source: "psp-tisky-law", adapter: "lib/ingest/sources/psp-legislation.ts", landing: "graph" },
  { source: "kiosek-uredni-deska", adapter: "lib/ingest/sources/kiosek.ts", landing: "graph" },
  { source: "smlouvy-gov-cz", adapter: "lib/ingest/sources/smlouvy.ts", landing: "graph" },
  { source: "dataor-justice-cz", adapter: "lib/ingest/sources/dataor.ts", landing: "graph" },
  {
    source: "monitor-statni-pokladna",
    adapter: "lib/ingest/sources/monitor.ts",
    landing: "generated-module",
  },
  { source: "volby-ps2025-candidates", adapter: "lib/ingest/sources/volby.ts", landing: "none" },
] as const;

/**
 * Proč atlas tu kterou krajinu neumí ohodnotit — jedna věta na krajinu, DOSLOVA
 * publikovaná ve strojovém reportu (`methodology.unscoredReasons`).
 *
 * Věty mluví o NAŠÍ rouře, ne o vydavateli: „nemá to kdo změřit“ není totéž co
 * „vydavatel to nezveřejňuje“, a ani jedna z nich nesmí znít jako „ten zdroj
 * jsme nenasypali“. Katalogové věty (`atlas.unscored.reason.*`) jsou s těmihle
 * svázané bajtově — vzor pravidel dimenzí, drží features/atlas/messages.test.ts.
 */
export const UNSCORED_REASONS: Readonly<Record<AtlasUnscorableLanding, string>> = {
  graph:
    "Řádky tohoto zdroje dopadají do kg_node/kg_edge. Ty nemají sloupec source ani ingest_run_id — " +
    "původ v nich je volný text v poli provenance.ref, takže mezi řádkem a tabulkou ingest_run nevede " +
    "žádný spojovací klíč. Pokrytí provenancí, čerstvost ani Merkle pečeť se u nich proto změřit nedají. " +
    "Je to mez NAŠÍ roury, ne výpověď o vydavateli: data ve store jsou, jen k nim atlas nevede měřitelnou vazbu.",
  "generated-module":
    "Sklizeň tohoto zdroje je zamrazená do generovaného modulu v repozitáři, který plocha čte přímo — do " +
    "úložiště nedopadá nic. Bez řádku ve store a bez ingest běhu není co měřit; datum stažení nese ten modul " +
    "sám a plocha ho tiskne. Je to mez NAŠÍ roury, ne výpověď o vydavateli.",
  none:
    "Adaptér tohoto zdroje je napsaný a otestovaný, ale v produktu ho nečte nic — nenasypává se. Atlas tu " +
    "neměří proto, že tu měřit není co. Uvádí se, aby seznam zdrojů nezamlčel, co v repozitáři leží nezapojené.",
};

/** Táž věta jako klíč katalogu — plocha sází ji, strojový report prózu výše. */
export const UNSCORED_REASON_KEYS: Readonly<Record<AtlasUnscorableLanding, string>> = {
  graph: "unscored.reason.graph",
  "generated-module": "unscored.reason.generatedModule",
  none: "unscored.reason.none",
};

/** Deklarovaný zdroj, který atlas STRUKTURÁLNĚ neumí ohodnotit — bez skóre. */
export interface AtlasUnscoredSource {
  source: string;
  adapter: string;
  landing: AtlasUnscorableLanding;
}

/**
 * Zdroje mimo dosah atlasu. `carded` = klíče, které v tomhle reportu kartu
 * DOSTALY; zdroj s kartou tady nikdy není (jinak by jeden zdroj stál na stránce
 * dvakrát a ještě si protiřečil).
 *
 * Seznam je DERIVOVANÝ, ne opsaný: až `smlouvy-gov-cz` začne psát do entitní
 * tabulky s ingest během, ze seznamu sám vypadne a stane se kartou. Nezávisí na
 * store — proto ho stránka umí vypsat i ve chvíli, kdy je úložiště nečitelné
 * (tehdy je `carded` prázdné a to je přesně správně: kartu nedostal nikdo).
 */
export function unscoredSources(carded: ReadonlySet<string> = new Set()): AtlasUnscoredSource[] {
  return INGESTED_SOURCES.filter(
    (s): s is AtlasIngestedSource & { landing: AtlasUnscorableLanding } =>
      s.landing !== "entity" && !carded.has(s.source),
  )
    .map(({ source, adapter, landing }) => ({ source, adapter, landing }))
    .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));
}

/* ── Vstupy (posbírá server loader, jen čtení) ──────────────────────────────── */

export interface AtlasEntityCoverage {
  source: string;
  /** Entita grafu (tabulka: person, organ, …, source_release). */
  entity: string;
  rows: number;
  /** Řádky s vazbou na ingest běh (ingest_run_id není null). */
  rowsWithRun: number;
}

export interface AtlasSourceRunStats {
  source: string;
  /** Dokončené běhy se stavem ok. */
  okFinishedRuns: number;
  /** Z nich zapečetěné Merkle kořenem (ingest_run.merkle_root). */
  sealedRuns: number;
  /** ISO dokončení nejnovějšího úspěšného běhu; null bez takového běhu. */
  lastOkFinishedAt: string | null;
}

export interface AtlasInputs {
  /** Okamžik hodnocení (ISO) — vstup, ne Date.now(); drží determinismus. */
  now: string;
  entityCoverage: ReadonlyArray<AtlasEntityCoverage>;
  runStats: ReadonlyArray<AtlasSourceRunStats>;
}

/* ── Výstup ─────────────────────────────────────────────────────────────────── */

/** Skóre dimenze: buď hodnocené číslo 0–100 s podkladem, nebo poctivé nehodnoceno. */
export type AtlasScore =
  | { status: "hodnoceno"; score: number; basis: string }
  | { status: "nehodnoceno"; reason: string };

export interface AtlasSourceCard {
  source: string;
  /** Má zdroj zpracovaný kontext (SOURCE_DOCS)? */
  documented: boolean;
  summary: string | null;
  knownIssues: string[];
  /** Provenance řádek kontextu (odkud přiznané mezery pocházejí). */
  contextProvenance: string | null;
  /** Per-entita pokrytí, řazeno podle entity (normalizace kvůli determinismu). */
  entities: Array<{ entity: string; rows: number; rowsWithRun: number }>;
  rowsTotal: number;
  rowsWithRun: number;
  freshness: {
    lastOkFinishedAt: string | null;
    /** Stáří ve dnech (1 desetinné místo), ohraničené zdola nulou; null bez běhu. */
    ageDays: number | null;
    cadenceDays: number | null;
    staleness: Staleness | null;
  };
  integrity: { okFinishedRuns: number; sealedRuns: number };
  dimensions: Record<AtlasDimension, AtlasScore>;
  /**
   * Souhrn = průměr HODNOCENÝCH dimenzí. Nehodnocená dimenze do průměru
   * nevstupuje (nikdy se nepočítá jako 0); méně než 4 hodnocené dimenze
   * ⇒ „částečné“.
   */
  composite: {
    status: "hodnoceno" | "částečné" | "nehodnoceno";
    score: number | null;
    evaluated: number;
    of: 4;
  };
}

export interface AtlasReport {
  schema: typeof ATLAS_SCHEMA;
  generatedAt: string;
  methodology: {
    rules: typeof ATLAS_RULES;
    cadenceDays: typeof SOURCE_CADENCE_DAYS;
    staleCadenceMultiplier: number;
    zeroCadenceMultiplier: number;
    stalenessVocabulary: { fresh: Staleness; aging: Staleness; stale: Staleness };
    unknowns: string;
    /** Proč atlas tu kterou krajinu neumí ohodnotit — jedna věta na krajinu. */
    unscoredReasons: typeof UNSCORED_REASONS;
  };
  /** Řazeno podle klíče zdroje vzestupně (normalizace kvůli determinismu). */
  sources: AtlasSourceCard[];
  /**
   * Deklarované zdroje, které atlas ohodnotit NEUMÍ — bez jediného skóre, jen
   * s krajinou a modulem. Prázdný seznam by znamenal, že platforma pracuje jen
   * s tím, co umí změřit; dnes to není pravda a stránka to říká nahlas.
   */
  unscored: AtlasUnscoredSource[];
}

const UNKNOWNS_NOTE =
  "Dimenze bez podkladu je „nehodnoceno“ s uvedeným důvodem, nikdy 0 — nula je tvrzení o kvalitě, " +
  "nehodnoceno je tvrzení o podkladu. Souhrn průměruje jen hodnocené dimenze.";

const MS_PER_DAY = 86_400_000;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Stáří ve dnech mezi dvěma ISO okamžiky, ohraničené zdola nulou (běh dokončený
 *  „v budoucnu“ — např. posun hodin — se čte jako čerstvý, ne záporný). */
export function ageDaysBetween(nowIso: string, thenIso: string): number | null {
  const now = Date.parse(nowIso);
  const then = Date.parse(thenIso);
  if (Number.isNaN(now) || Number.isNaN(then)) return null;
  return Math.max(0, (now - then) / MS_PER_DAY);
}

/** Slovní pásmo stáří vůči kadenci — sdílený slovník s /admin smyčkami (6E). */
export function stalenessOf(ageDays: number, cadenceDays: number): Staleness {
  if (ageDays <= cadenceDays) return "čerstvé";
  if (ageDays <= cadenceDays * STALE_CADENCE_MULTIPLIER) return "stárnoucí";
  return "zastaralé";
}

/** Skóre čerstvosti: 100 při stáří ≤ kadence, lineárně k 0 při 3× kadence. */
export function freshnessScore(ageDays: number, cadenceDays: number): number {
  const zeroAt = cadenceDays * ZERO_CADENCE_MULTIPLIER;
  const span = zeroAt - cadenceDays; // 2× kadence
  return Math.round(100 * clamp01((zeroAt - ageDays) / span));
}

/* ── Derivace per dimenze ───────────────────────────────────────────────────── */

function deriveCoverage(rowsTotal: number, rowsWithRun: number): AtlasScore {
  if (rowsTotal <= 0) {
    return { status: "nehodnoceno", reason: "zdroj nemá ve store žádné řádky — není co měřit" };
  }
  const score = Math.round((100 * rowsWithRun) / rowsTotal);
  return {
    status: "hodnoceno",
    score,
    basis: `${rowsWithRun} z ${rowsTotal} řádků nese vazbu na ingest běh`,
  };
}

function deriveFreshness(
  nowIso: string,
  lastOkFinishedAt: string | null,
  cadenceDays: number | null,
): { score: AtlasScore; ageDays: number | null; staleness: Staleness | null } {
  if (lastOkFinishedAt === null) {
    return {
      score: { status: "nehodnoceno", reason: "žádný dokončený úspěšný ingest běh zdroje" },
      ageDays: null,
      staleness: null,
    };
  }
  const age = ageDaysBetween(nowIso, lastOkFinishedAt);
  if (age === null) {
    return {
      score: { status: "nehodnoceno", reason: "okamžik posledního běhu nelze přečíst" },
      ageDays: null,
      staleness: null,
    };
  }
  const ageRounded = Math.round(age * 10) / 10;
  if (cadenceDays === null) {
    return {
      score: {
        status: "nehodnoceno",
        reason: `kadence zdroje není deklarována — stáří ${ageRounded} dne/dní bez měřítka není skóre`,
      },
      ageDays: ageRounded,
      staleness: null,
    };
  }
  const staleness = stalenessOf(age, cadenceDays);
  return {
    score: {
      status: "hodnoceno",
      score: freshnessScore(age, cadenceDays),
      basis: `stáří ${ageRounded} dne/dní proti kadenci ${cadenceDays} dne/dní — ${staleness}`,
    },
    ageDays: ageRounded,
    staleness,
  };
}

function deriveIntegrity(okFinishedRuns: number, sealedRuns: number): AtlasScore {
  if (okFinishedRuns <= 0) {
    return { status: "nehodnoceno", reason: "žádný dokončený úspěšný ingest běh — není co pečetit" };
  }
  const sealed = Math.min(sealedRuns, okFinishedRuns);
  return {
    status: "hodnoceno",
    score: Math.round((100 * sealed) / okFinishedRuns),
    basis: `${sealed} z ${okFinishedRuns} dokončených úspěšných běhů zapečetěno Merkle kořenem`,
  };
}

function deriveCompleteness(documented: boolean, knownIssueCount: number): AtlasScore {
  if (!documented) {
    return {
      status: "nehodnoceno",
      reason: "zdroj nemá zpracovaný kontext (SOURCE_DOCS) — nedokumentováno neznamená úplné",
    };
  }
  return {
    status: "hodnoceno",
    score: Math.max(0, 100 - COMPLETENESS_POINTS_PER_ISSUE * knownIssueCount),
    basis: `${knownIssueCount} přiznaných mezer upstreamu v kontextu zdroje`,
  };
}

function deriveComposite(dimensions: Record<AtlasDimension, AtlasScore>): AtlasSourceCard["composite"] {
  const scored = ATLAS_DIMENSIONS.map((d) => dimensions[d]).filter(
    (s): s is Extract<AtlasScore, { status: "hodnoceno" }> => s.status === "hodnoceno",
  );
  if (scored.length === 0) return { status: "nehodnoceno", score: null, evaluated: 0, of: 4 };
  const mean = Math.round(scored.reduce((n, s) => n + s.score, 0) / scored.length);
  return {
    status: scored.length === ATLAS_DIMENSIONS.length ? "hodnoceno" : "částečné",
    score: mean,
    evaluated: scored.length,
    of: 4,
  };
}

/* ── Report ─────────────────────────────────────────────────────────────────── */

export function deriveAtlas(inputs: AtlasInputs): AtlasReport {
  // Množina zdrojů = sjednocení: dokumentované kontexty ∪ zdroje s řádky ∪
  // zdroje s běhy. Zdroj známý jen z jedné strany se ukazuje taky — s poctivým
  // „nehodnoceno“ tam, kde podklad chybí.
  const keys = new Set<string>(Object.keys(SOURCE_DOCS));
  for (const c of inputs.entityCoverage) keys.add(c.source);
  for (const r of inputs.runStats) keys.add(r.source);

  const sources = [...keys].sort().map((source): AtlasSourceCard => {
    const doc = SOURCE_DOCS[source] ?? null;
    const entities = inputs.entityCoverage
      .filter((c) => c.source === source)
      .map((c) => ({ entity: c.entity, rows: c.rows, rowsWithRun: c.rowsWithRun }))
      .sort((a, b) => (a.entity < b.entity ? -1 : a.entity > b.entity ? 1 : 0));
    const rowsTotal = entities.reduce((n, e) => n + e.rows, 0);
    const rowsWithRun = entities.reduce((n, e) => n + e.rowsWithRun, 0);
    const runs = inputs.runStats.find((r) => r.source === source) ?? {
      source,
      okFinishedRuns: 0,
      sealedRuns: 0,
      lastOkFinishedAt: null,
    };
    const cadenceDays = SOURCE_CADENCE_DAYS[source] ?? null;

    const fresh = deriveFreshness(inputs.now, runs.lastOkFinishedAt, cadenceDays);
    const dimensions: Record<AtlasDimension, AtlasScore> = {
      coverage: deriveCoverage(rowsTotal, rowsWithRun),
      freshness: fresh.score,
      integrity: deriveIntegrity(runs.okFinishedRuns, runs.sealedRuns),
      completeness: deriveCompleteness(doc !== null, doc?.knownIssues.length ?? 0),
    };

    return {
      source,
      documented: doc !== null,
      summary: doc?.summary ?? null,
      knownIssues: doc ? [...doc.knownIssues] : [],
      contextProvenance: doc?.provenance ?? null,
      entities,
      rowsTotal,
      rowsWithRun,
      freshness: {
        lastOkFinishedAt: runs.lastOkFinishedAt,
        ageDays: fresh.ageDays,
        cadenceDays,
        staleness: fresh.staleness,
      },
      integrity: {
        okFinishedRuns: runs.okFinishedRuns,
        sealedRuns: Math.min(runs.sealedRuns, runs.okFinishedRuns),
      },
      dimensions,
      composite: deriveComposite(dimensions),
    };
  });

  return {
    schema: ATLAS_SCHEMA,
    generatedAt: inputs.now,
    methodology: {
      rules: ATLAS_RULES,
      cadenceDays: SOURCE_CADENCE_DAYS,
      staleCadenceMultiplier: STALE_CADENCE_MULTIPLIER,
      zeroCadenceMultiplier: ZERO_CADENCE_MULTIPLIER,
      stalenessVocabulary: { fresh: "čerstvé", aging: "stárnoucí", stale: "zastaralé" },
      unknowns: UNKNOWNS_NOTE,
      unscoredReasons: UNSCORED_REASONS,
    },
    sources,
    // Zdroje s kartou se sem nesmí dostat podruhé — proto se předává množina
    // klíčů, které kartu dostaly, ne jen `INGESTED_SOURCES`.
    unscored: unscoredSources(keys),
  };
}
