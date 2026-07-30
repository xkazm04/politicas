/*
 * Server-only loader /atlas (batch-6 item 6D) — čte store STRIKTNĚ jen pro
 * čtení a předává čisté derivaci lib/analysis/atlas.ts. Tři čtení:
 *
 *   1. Per-entita pokrytí provenancí: count(*) vs count(ingest_run_id) přes
 *      pevný seznam entitních tabulek (týž seznam běhových tabulek, který
 *      pečetí LedgerRepository — provenance kvartet nese každá z nich).
 *   2. Statistika běhů per zdroj z ingest_run: dokončené úspěšné běhy,
 *      z nich zapečetěné Merkle kořenem (merkle_root zapisuje výhradně
 *      LedgerRepository.sealIngestRun), okamžik poslední úspěšné obnovy.
 *   3. Okamžik hodnocení (`now`) se derivaci PŘEDÁVÁ — derivace sama je čistá
 *      a deterministická (testy lib/analysis/atlas.test.ts).
 *
 * Degrade kontrakt zrcadlí getDataReleasesData: store nedostupný → null
 * (stránka vykreslí čestné „nečitelné, ne prázdné“); prázdný, ale čitelný
 * store je regulérní atlas, kde dimenze bez podkladu jsou „nehodnoceno“.
 */

import "server-only";
import {
  deriveAtlas,
  type AtlasEntityCoverage,
  type AtlasReport,
  type AtlasSourceRunStats,
} from "@/lib/analysis/atlas";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { isoTs, num, open, str, type Pglite } from "@/lib/db/pglite/internals";
import { getStore } from "@/lib/db/store";

/**
 * Entitní tabulky s provenance kvartetem (source, source_url, fetched_at,
 * ingest_run_id) — pevný seznam, týž jako RUN_TABLES v repositories/ledger.ts.
 * Pevný proto, aby atlas nikdy nesáhl na tabulku, o které to neplatí.
 */
const ENTITY_TABLES = [
  "person",
  "organ",
  "mandate",
  "membership",
  "vote_event",
  "vote_ballot",
  "absence",
  "source_release",
] as const;

async function readEntityCoverage(pg: Pglite): Promise<AtlasEntityCoverage[]> {
  const out: AtlasEntityCoverage[] = [];
  for (const table of ENTITY_TABLES) {
    const { rows } = await pg.query<Record<string, unknown>>(
      `select source, count(*)::int as rows, count(ingest_run_id)::int as rows_with_run
         from ${table} group by source`,
    );
    for (const r of rows) {
      out.push({
        source: str(r.source),
        entity: table,
        rows: num(r.rows),
        rowsWithRun: num(r.rows_with_run),
      });
    }
  }
  return out;
}

async function readRunStats(pg: Pglite): Promise<AtlasSourceRunStats[]> {
  const { rows } = await pg.query<Record<string, unknown>>(
    `select source,
            count(*) filter (where status = 'ok' and finished_at is not null)::int as ok_finished,
            count(*) filter (where status = 'ok' and finished_at is not null
                               and merkle_root is not null)::int as sealed,
            max(finished_at) filter (where status = 'ok' and finished_at is not null) as last_ok
       from ingest_run group by source`,
  );
  return rows.map((r) => ({
    source: str(r.source),
    okFinishedRuns: num(r.ok_finished),
    sealedRuns: num(r.sealed),
    // PGlite vrací timestamptz jako Date/string — isoTs normalizuje na ISO.
    lastOkFinishedAt: isoTs(r.last_ok),
  }));
}

/** Atlas nad aktuálním store; null jen když je store nečitelný. */
export async function getAtlasReport(): Promise<AtlasReport | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const pg = await open();
    // PGlite je single-connection — čtení běží záměrně sekvenčně.
    const entityCoverage = await readEntityCoverage(pg);
    const runStats = await readRunStats(pg);
    return deriveAtlas({ now: new Date().toISOString(), entityCoverage, runStats });
  } catch (err) {
    reportLoaderFailure("getAtlasReport", err);
    return null;
  }
}
