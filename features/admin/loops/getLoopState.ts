// Server-only loader velína smyček (6E) — tenká IO slupka nad čistou derivací
// loopState.ts. Skládá VÝHRADNĚ už existující čtecí cesty (konvence
// getTripwireData): pass hlavičky z graph-log.md, postup case-smyček přes
// loadLoopProgress (getAdminData — týž parser, žádná druhá pravda), ingest
// běhy přes store.listIngestRuns a akční žurnál přes readDriveLog. Každý
// pramen smí selhat sám za sebe („degrade to partial, never crash“) — bez
// store se ingest smyčky prostě nevykreslí, case-smyčky žijí dál.
//
// cache(): /admin stránka i /admin/loops.json v jednom requestu čtou týž
// dokument, žádné dvojí IO.

import "server-only";
import { cache } from "react";
import { existsSync, readFileSync } from "node:fs";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { loadLoopProgress, LOOPS_PAUSED, LOOPS_PAUSED_LABEL } from "../getAdminData";
import {
  deriveLoopState,
  parsePassLog,
  type CaseLoopIn,
  type IngestRunIn,
  LOOPS_SCHEMA,
} from "./loopState";
import { DRIVE_CHAIN_NOTE_CS, type LoopsDoc } from "./loopsJson";
import { driveLogDisplayPath, readDriveLog } from "./driveLog";

/** Relativní cesta (fs čte vůči cwd, jako getAdminData.readTextSafe) — bez
 *  join(process.cwd(), …), ať Turbopack NFT trace nestopuje celý projekt. */
const GRAPH_LOG = "docs/data-analysis/graph-log.md";

/** Kolik posledních ingest běhů se čte — stačí na sérii selhání i čerstvost. */
const INGEST_RUNS_LIMIT = 500;

function loadCasePasses() {
  try {
    if (!existsSync(GRAPH_LOG)) return [];
    return parsePassLog(readFileSync(GRAPH_LOG, "utf8"));
  } catch (err) {
    reportLoaderFailure("getLoopState.loadCasePasses", err);
    return [];
  }
}

async function loadIngestRuns(): Promise<IngestRunIn[]> {
  try {
    const store = await getStore();
    if (!store) return [];
    const rows = await store.listIngestRuns(INGEST_RUNS_LIMIT);
    return rows.map((r) => ({
      source: r.source,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      status: r.status,
      rowsWritten: r.rowsWritten,
      note: r.note,
    }));
  } catch (err) {
    reportLoaderFailure("getLoopState.loadIngestRuns", err);
    return [];
  }
}

export const getLoopsDoc = cache(async function getLoopsDoc(): Promise<LoopsDoc> {
  const caseLoops: CaseLoopIn[] = loadLoopProgress().map((p) => ({
    id: p.case,
    labelCs: p.labelCs,
    batchesCompleted: p.batchesCompleted,
    unitsProcessed: p.unitsProcessed,
    unitsTotal: p.unitsTotal,
    openFrontier: p.openFrontier,
  }));
  const [ingestRuns] = await Promise.all([loadIngestRuns()]);
  const drive = readDriveLog();

  const { loops, alerts } = deriveLoopState({
    now: new Date().toISOString(),
    loopsPaused: LOOPS_PAUSED,
    caseLoops,
    casePasses: loadCasePasses(),
    ingestRuns,
  });

  return {
    schema: LOOPS_SCHEMA,
    generatedAt: new Date().toISOString(),
    pausedNoteCs: LOOPS_PAUSED ? LOOPS_PAUSED_LABEL : null,
    loops,
    alerts: alerts.map((a) => ({
      ...a,
      acknowledged: a.id in drive.state.acks,
      acknowledgedAt: drive.state.acks[a.id] ?? null,
    })),
    drive: {
      pending: drive.state.pending,
      log: {
        path: driveLogDisplayPath(),
        entries: drive.state.entryCount,
        skipped: drive.skipped,
        chainOk: drive.chain.ok,
        chainNoteCs: DRIVE_CHAIN_NOTE_CS,
      },
    },
  };
});
