/*
 * LIVE-GRAPH SENTINEL — fact collection (batch-7 item 7E).
 *
 * STRICTLY READ-ONLY: every query here is a SELECT; nothing in this module may
 * write. The sentinel never opens the live `./.pglite` handle — the runner
 * (scripts/sentinel/run.ts) copies the data dir first and points PGLITE_PATH
 * at the copy (PGlite is single-connection; see lib/db/config.ts).
 *
 * Ground truths this collection feeds (evaluated in ./invariants.ts):
 *   • features/data-releases/manifest.ts — the released-manifest derivation
 *     (ReleaseStats is ITS input shape; we collect exactly what the /data
 *     loader collects, so the sentinel judges the same numbers the site
 *     publishes).
 *   • lib/db/readiness.ts CARDINALITY_FLOORS — the readiness floors.
 *   • lib/analysis/atlas.ts SOURCE_CADENCE_DAYS — the freshness cadences.
 *   • lib/db/pglite/ledger.ts — the audit-chain verification.
 *
 * The per-source run stats + per-entity coverage mirror the read-only SQL of
 * features/atlas/getAtlasData.ts. Deliberately duplicated, not imported: that
 * loader is `server-only` (unimportable from a tsx script) and reads through
 * getStore()'s env plumbing; the sentinel reads a handle it was given.
 */

import type { AtlasEntityCoverage, AtlasSourceRunStats } from "@/lib/analysis/atlas";
import { EFFORT_VERDICT_FIELDS, readVerdictRung } from "@/lib/analysis/verdict-provenance";
import { isoTs, json, num, str, strOrNull, type Pglite } from "@/lib/db/pglite/internals";
import type { ChainVerification } from "@/lib/db/pglite/ledger";
import { makeLedgerRepo, type ReviewAuditCounts } from "@/lib/db/pglite/repositories/ledger";
import type { IngestRunRow } from "@/lib/db/types";
import type { ReleaseStats } from "@/features/data-releases/manifest";

/**
 * The stored props the contribution formula consumes, verbatim off the person node.
 * `null` = the prop is absent or non-numeric — MISSING IS NOT ZERO, so an invariant that
 * needs an input says it cannot be evaluated rather than scoring a fabricated 0.
 */
export interface PersonInputFacts {
  committeeCount: number | null;
  leadershipCount: number | null;
  participationRate: number | null;
  absenceRate: number | null;
  billsAuthored: number | null;
  interpellations: number | null;
  speechTurns: number | null;
}

/**
 * One person node's published score AND the evidence needed to judge it.
 *
 * It used to be `{id, score}` only, and that is exactly why the sentinel could not see
 * the 2026-07-29 → 2026-08-04 divergence: a score is finite whether or not the formula
 * that produced it still exists. The provenance says WHICH formula authored it; the
 * inputs let the sentinel re-run that formula (lib/analysis/contribution.ts) over the
 * store's own numbers instead of comparing the store to itself.
 */
export interface PersonScoreFact {
  id: string;
  score: number | null;
  /** `contribution_provenance.pass` / `.ref` as stored; null = absent or malformed. */
  provenancePass: number | null;
  provenanceRef: string | null;
  inputs: PersonInputFacts;
}

export interface OrphanEdgeFacts {
  count: number;
  /** Up to 5 offending edges, "src -rel-> dst", for the report detail. */
  sample: string[];
}

/**
 * One claim kind's population and how much of it a human has decided
 * (G2, 2026-09-04). Counts only — a rate without its denominator is the exact
 * shape this project refuses to print, and the finding behind this whole check
 * is that three populations were in the hundreds with a decided count of zero.
 */
export interface ReviewKindFacts {
  kind: string;
  total: number;
  decided: number;
  pending: number;
}

/**
 * Effort verdicts specifically, because they are the ones that name a PERSON.
 *
 * `claimedDecided` is every claim whose stored rung says a human decided it —
 * `verified` or `rejected`. `auditedSubjectIds` is what the tamper-evident chain
 * actually holds. The invariant is that the first is a subset of the second: a
 * verdict that CLAIMS a human decision with no audit row behind it is either a
 * script that promoted its own verdict or a hand-edited node, and both are the
 * thing the door exists to make impossible.
 */
export interface EffortVerdictFacts {
  total: number;
  byRung: Record<string, number>;
  /** `psp:person:<id>#<prop>` for every claim whose rung is verified or rejected. */
  claimedDecided: string[];
  /** `subject_id` of every `effort_verdict` row in review_audit. */
  auditedSubjectIds: string[];
}

export interface SentinelFacts {
  /** Exactly the input shape of deriveReleaseManifest (ground truth: manifest.ts). */
  releaseStats: ReleaseStats;
  /** O(n) re-verification of the review_audit hash chain (ground truth: ledger.ts). */
  chain: ChainVerification;
  /**
   * Rows in `review_audit` vs. rows the chain covers. WITHOUT this the chain
   * invariant could not tell "nobody has decided anything yet" from "somebody
   * dropped every chain_pos": `verifyReviewChain` reads only chained rows, so
   * both stores hand it an empty list. Tampering with one row is a violation;
   * erasing the whole chain used to be a PASS.
   */
  auditCounts: ReviewAuditCounts;
  orphanEdges: OrphanEdgeFacts;
  /** Per-source ingest-run stats — freshness input (ground truth: atlas.ts cadences). */
  runStats: AtlasSourceRunStats[];
  /** Per-entity provenance coverage — atlas determinism input. */
  entityCoverage: AtlasEntityCoverage[];
  /** Every person node's score, provenance and stored formula inputs, ordered by id. */
  persons: PersonScoreFact[];
  /** Per claim kind: how big the population is and how much of it is decided. */
  reviewCoverage: ReviewKindFacts[];
  /** The person-level verdicts, and what the chain holds about them. */
  effortVerdicts: EffortVerdictFacts;
}

/** Same cap the /data loader uses (features/data-releases/getDataReleasesData.ts). */
export const INGEST_RUN_LIMIT = 500;

/**
 * Entity tables carrying the provenance quartet — the SAME pinned list as
 * RUN_TABLES in lib/db/pglite/repositories/ledger.ts and ENTITY_TABLES in
 * features/atlas/getAtlasData.ts. Pinned so the sentinel never touches a table
 * the quartet contract does not cover.
 */
export const SENTINEL_ENTITY_TABLES = [
  "person",
  "organ",
  "mandate",
  "membership",
  "vote_event",
  "vote_ballot",
  "absence",
  "source_release",
] as const;

async function readReleaseStats(pg: Pglite): Promise<ReleaseStats> {
  // PGlite is single-connection — reads run sequentially on purpose.
  const kindRows = await pg.query<Record<string, unknown>>(
    `select kind, count(*)::int as count from kg_node group by kind order by kind`,
  );
  const relRows = await pg.query<Record<string, unknown>>(
    `select rel, count(*)::int as n from kg_edge group by rel order by rel`,
  );
  const nodeTotal = await pg.query<Record<string, unknown>>(`select count(*)::int as n from kg_node`);
  const edgeTotal = await pg.query<Record<string, unknown>>(`select count(*)::int as n from kg_edge`);
  const ballotTotal = await pg.query<Record<string, unknown>>(`select count(*)::int as n from vote_ballot`);
  const runRows = await pg.query<Record<string, unknown>>(
    `select * from ingest_run order by started_at desc limit ${INGEST_RUN_LIMIT}`,
  );
  const ledgerHeads = await makeLedgerRepo(pg).getLedgerHeads();

  const edgeRelCounts: Record<string, number> = {};
  for (const r of relRows.rows) edgeRelCounts[str(r.rel)] = num(r.n);

  const ingestRuns: IngestRunRow[] = runRows.rows.map((r) => ({
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

  return {
    kindCounts: kindRows.rows.map((r) => ({ kind: str(r.kind), count: num(r.count) })),
    edgeRelCounts,
    kgNodeTotal: num(nodeTotal.rows[0]?.n),
    kgEdgeTotal: num(edgeTotal.rows[0]?.n),
    voteBallotTotal: num(ballotTotal.rows[0]?.n),
    ingestRuns,
    ledgerHeads,
  };
}

async function readOrphanEdges(pg: Pglite): Promise<OrphanEdgeFacts> {
  const { rows } = await pg.query<Record<string, unknown>>(
    `select count(*)::int as n from kg_edge e
      where not exists (select 1 from kg_node s where s.id = e.src)
         or not exists (select 1 from kg_node d where d.id = e.dst)`,
  );
  const count = num(rows[0]?.n);
  if (count === 0) return { count: 0, sample: [] };
  const { rows: sampleRows } = await pg.query<Record<string, unknown>>(
    `select src, rel, dst from kg_edge e
      where not exists (select 1 from kg_node s where s.id = e.src)
         or not exists (select 1 from kg_node d where d.id = e.dst)
      order by src, rel, dst limit 5`,
  );
  return {
    count,
    sample: sampleRows.map((r) => `${str(r.src)} -${str(r.rel)}-> ${str(r.dst)}`),
  };
}

/**
 * Effort verdicts as the graph actually holds them, plus what the audit chain
 * holds about them. Read straight off `kg_node`/`review_audit` rather than
 * through a loader — the sentinel's job is to disagree with the loaders when
 * they are wrong.
 */
async function readEffortVerdicts(pg: Pglite): Promise<EffortVerdictFacts> {
  const { rows } = await pg.query<Record<string, unknown>>(
    `select id, props from kg_node where kind = 'person' order by id`,
  );
  const byRung: Record<string, number> = { machine: 0, pending: 0, verified: 0, rejected: 0, unrecorded: 0 };
  const claimedDecided: string[] = [];
  let total = 0;
  for (const r of rows) {
    const props = json(r.props);
    for (const field of EFFORT_VERDICT_FIELDS) {
      if (props[field] === undefined || props[field] === null) continue;
      total++;
      const v = readVerdictRung(props, field);
      if (v === null) {
        byRung.unrecorded++;
        continue;
      }
      byRung[v.rung]++;
      if (v.rung === "verified" || v.rung === "rejected") claimedDecided.push(`${str(r.id)}#${field}`);
    }
  }
  const { rows: auditRows } = await pg.query<Record<string, unknown>>(
    `select distinct subject_id from review_audit
      where subject_kind = 'effort_verdict' and subject_id is not null`,
  );
  return {
    total,
    byRung,
    claimedDecided: claimedDecided.sort(),
    auditedSubjectIds: auditRows.map((r) => str(r.subject_id)).sort(),
  };
}

/**
 * Per-kind population and decided counts. Ties and bill verdicts are counted
 * from the props the surfaces read; effort verdicts come from the facts above.
 *
 * A kind with NO population is still listed, with zeros: „0 of 0" and a missing
 * row are different findings, and only one of them is visible.
 */
async function readReviewCoverage(pg: Pglite, effort: EffortVerdictFacts): Promise<ReviewKindFacts[]> {
  const { rows: tieRows } = await pg.query<Record<string, unknown>>(
    `select count(*)::int as total,
            count(*) filter (
              where props->>'review_state' in ('verified','rejected')
            )::int as decided
       from kg_edge where rel = 'linked_to'`,
  );
  const { rows: billRows } = await pg.query<Record<string, unknown>>(
    `select count(*)::int as total,
            count(*) filter (
              where props->>'forensic_review_state' in ('verified','rejected')
            )::int as decided
       from kg_node
      where kind = 'bill' and (props ? 'forensic_review_state' or props ? 'forensic_severity')`,
  );
  const mk = (kind: string, total: number, decided: number): ReviewKindFacts => ({
    kind,
    total,
    decided,
    pending: total - decided,
  });
  return [
    mk("tie", num(tieRows[0]?.total), num(tieRows[0]?.decided)),
    mk("bill_verdict", num(billRows[0]?.total), num(billRows[0]?.decided)),
    mk("effort_verdict", effort.total, effort.claimedDecided.length),
  ];
}

async function readRunStats(pg: Pglite): Promise<AtlasSourceRunStats[]> {
  // Mirror of features/atlas/getAtlasData.ts readRunStats (see module header).
  const { rows } = await pg.query<Record<string, unknown>>(
    `select source,
            count(*) filter (where status = 'ok' and finished_at is not null)::int as ok_finished,
            count(*) filter (where status = 'ok' and finished_at is not null
                               and merkle_root is not null)::int as sealed,
            max(finished_at) filter (where status = 'ok' and finished_at is not null) as last_ok
       from ingest_run group by source order by source`,
  );
  return rows.map((r) => ({
    source: str(r.source),
    okFinishedRuns: num(r.ok_finished),
    sealedRuns: num(r.sealed),
    lastOkFinishedAt: isoTs(r.last_ok),
  }));
}

async function readEntityCoverage(pg: Pglite): Promise<AtlasEntityCoverage[]> {
  // Mirror of features/atlas/getAtlasData.ts readEntityCoverage (see module header).
  const out: AtlasEntityCoverage[] = [];
  for (const table of SENTINEL_ENTITY_TABLES) {
    const { rows } = await pg.query<Record<string, unknown>>(
      `select source, count(*)::int as rows, count(ingest_run_id)::int as rows_with_run
         from ${table} group by source order by source`,
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

/** JSON text → finite number, or null. Never NaN, never a silent 0. */
function numOrNull(raw: unknown): number | null {
  const s = strOrNull(raw);
  if (s === null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function readPersonScores(pg: Pglite): Promise<PersonScoreFact[]> {
  const { rows } = await pg.query<Record<string, unknown>>(
    `select id,
            props->>'contribution_score'              as score,
            props->'contribution_provenance'->>'pass' as prov_pass,
            props->'contribution_provenance'->>'ref'  as prov_ref,
            props->>'committee_count'                 as committee_count,
            props->>'leadership_count'                as leadership_count,
            props->>'participation_rate'              as participation_rate,
            props->>'absence_rate'                    as absence_rate,
            props->>'bills_authored'                  as bills_authored,
            props->>'interpellations'                 as interpellations,
            props->>'speech_turns'                    as speech_turns
       from kg_node where kind = 'person' order by id`,
  );
  return rows.map((r) => ({
    id: str(r.id),
    score: numOrNull(r.score),
    provenancePass: numOrNull(r.prov_pass),
    provenanceRef: strOrNull(r.prov_ref),
    inputs: {
      committeeCount: numOrNull(r.committee_count),
      leadershipCount: numOrNull(r.leadership_count),
      participationRate: numOrNull(r.participation_rate),
      absenceRate: numOrNull(r.absence_rate),
      billsAuthored: numOrNull(r.bills_authored),
      interpellations: numOrNull(r.interpellations),
      speechTurns: numOrNull(r.speech_turns),
    },
  }));
}

/** One full read-only pass over the store. Called TWICE by the runner —
 *  the determinism invariant compares the two passes' derivations. */
export async function collectSentinelFacts(pg: Pglite): Promise<SentinelFacts> {
  const releaseStats = await readReleaseStats(pg);
  const ledger = makeLedgerRepo(pg);
  const chain = await ledger.verifyReviewChain();
  const auditCounts = await ledger.countReviewAudit();
  const orphanEdges = await readOrphanEdges(pg);
  const runStats = await readRunStats(pg);
  const entityCoverage = await readEntityCoverage(pg);
  const persons = await readPersonScores(pg);
  const effortVerdicts = await readEffortVerdicts(pg);
  const reviewCoverage = await readReviewCoverage(pg, effortVerdicts);

  return {
    releaseStats,
    chain,
    auditCounts,
    orphanEdges,
    runStats,
    entityCoverage,
    persons,
    reviewCoverage,
    effortVerdicts,
  };
}
