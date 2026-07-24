// AnalysisRepository — deterministic quality snapshots per slice (the promoted
// verdict target).

import type { AnalysisRepository } from "../../store";
import type { SliceQualityRow } from "../../types";
import { isoTs, num, str, type Pglite } from "../internals";

export function makeAnalysisRepo(pg: Pglite): AnalysisRepository {
  return {
    async upsertSliceQuality(row) {
      await pg.query(
        `insert into slice_quality
           (slice, source, term, entity, completeness, freshness, categorization,
            validity, richness, volume, composite, rows_total, rows_valid,
            taxonomy_version, analyzed_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         on conflict (slice) do update set
           source = excluded.source, term = excluded.term, entity = excluded.entity,
           completeness = excluded.completeness, freshness = excluded.freshness,
           categorization = excluded.categorization, validity = excluded.validity,
           richness = excluded.richness, volume = excluded.volume,
           composite = excluded.composite, rows_total = excluded.rows_total,
           rows_valid = excluded.rows_valid, taxonomy_version = excluded.taxonomy_version,
           analyzed_at = excluded.analyzed_at`,
        [
          row.slice, row.source, row.term, row.entity,
          row.scores.completeness, row.scores.freshness, row.scores.categorization,
          row.scores.validity, row.scores.richness, row.scores.volume,
          row.composite, row.rowsTotal, row.rowsValid, row.taxonomyVersion, row.analyzedAt,
        ],
      );
    },
    async listSliceQuality() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from slice_quality order by composite asc, slice asc`,
      );
      return rows.map((r): SliceQualityRow => ({
        slice: str(r.slice),
        source: str(r.source),
        term: str(r.term),
        entity: str(r.entity),
        scores: {
          completeness: num(r.completeness),
          freshness: num(r.freshness),
          categorization: num(r.categorization),
          validity: num(r.validity),
          richness: num(r.richness),
          volume: num(r.volume),
        },
        composite: num(r.composite),
        rowsTotal: num(r.rows_total),
        rowsValid: num(r.rows_valid),
        taxonomyVersion: str(r.taxonomy_version),
        analyzedAt: isoTs(r.analyzed_at) ?? "",
      }));
    },
    async clearAllAnalysis() {
      await pg.query(`delete from slice_quality`);
    },
  };
}
