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
 *    pravidla neexistuje.
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

/**
 * Deklarovaná kadence obnovy per zdroj, ve dnech. Je to OČEKÁVÁNÍ politicas
 * (jak často má smysl znovu nasypat), ne SLA vydavatele — publikuje se s tímto
 * přiznáním. Zdroj bez deklarované kadence má čerstvost „nehodnoceno“.
 */
export const SOURCE_CADENCE_DAYS: Readonly<Record<string, number>> = {
  "psp-poslanci": 7,
  "psp-hlasovani": 7,
  "pumper-psp-opendata": 1,
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
      "≤ kadence, pak lineárně k 0 při stáří = 3× kadence. Slovně: ≤ kadence „čerstvé“, ≤ 2× kadence " +
      "„stárnoucí“, nad 2× kadence „zastaralé“. Kadence je deklarované očekávání politicas, ne SLA " +
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
      "100 minus 10 bodů za každou přiznanou mezeru upstreamu (KNOWN ISSUES v kontextu zdroje, " +
      "lib/analysis/context-model.ts), nejméně 0. Nízké skóre je výpověď o datech vydavatele, ne o " +
      "zpracování politicas — mezery se přiznávají, neschovávají. Zdroj bez zpracovaného kontextu " +
      "= nehodnoceno (nedokumentováno ≠ úplné).",
  },
};

export const COMPLETENESS_POINTS_PER_ISSUE = 10;

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
  };
  /** Řazeno podle klíče zdroje vzestupně (normalizace kvůli determinismu). */
  sources: AtlasSourceCard[];
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
    },
    sources,
  };
}
