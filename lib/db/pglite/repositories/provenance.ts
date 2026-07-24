// ProvenanceRepository — ingest runs + the Pumper-mirrored release manifest.

import type { ProvenanceRepository } from "../../store";
import type { IngestRunRow, SourceReleaseRow } from "../../types";
import { isoTs, num, str, strOrNull, upsertMany, type Pglite } from "../internals";
import { RELEASE_COLS, mapRelease } from "../mappers";

export function makeProvenanceRepo(pg: Pglite): ProvenanceRepository {
  return {
    async startIngestRun(input) {
      const { rows } = await pg.query<{ id: number }>(
        `insert into ingest_run (source, source_url, source_last_modified, note)
         values ($1,$2,$3,$4) returning id`,
        [input.source, input.sourceUrl, input.sourceLastModified, input.note ?? null],
      );
      return num(rows[0]?.id);
    },
    async finishIngestRun(id, status, rowsWritten, note) {
      await pg.query(
        `update ingest_run
            set status = $2, rows_written = $3, finished_at = now(),
                note = coalesce($4, note)
          where id = $1`,
        [id, status, rowsWritten, note ?? null],
      );
    },
    async listIngestRuns(limit = 200) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from ingest_run order by started_at desc limit ${Math.max(1, Math.min(1000, limit))}`,
      );
      return rows.map((r) => ({
        id: num(r.id),
        source: str(r.source),
        startedAt: isoTs(r.started_at) ?? "",
        finishedAt: isoTs(r.finished_at),
        status: (str(r.status) as IngestRunRow["status"]) || "running",
        sourceUrl: strOrNull(r.source_url),
        sourceLastModified: strOrNull(r.source_last_modified),
        rowsWritten: num(r.rows_written),
        note: strOrNull(r.note),
      }));
    },
    upsertSourceReleases: (rows) =>
      upsertMany(pg, "source_release", RELEASE_COLS, rows, (r: SourceReleaseRow) => [
        r.id, r.pumperApp, r.pumperDataset, r.recordKey, r.fileName, r.fileUrl, r.description,
        r.pageTitle, r.contentSha256, r.observedChars, r.observedAt,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    async listSourceReleases() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from source_release order by id`,
      );
      return rows.map(mapRelease);
    },
  };
}
