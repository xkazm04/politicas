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
import { isoTs, num, str, strOrNull, type Pglite } from "@/lib/db/pglite/internals";
import {
  summarizeLoaderDegradations,
  type LoaderDegradationSummary,
} from "@/lib/db/loaderFailureLog";
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
 * [G5] One `linked_to` tie, reduced to what the money-rank invariant needs.
 *
 * `tie_class` is a JUDGEMENT an analyst wrote and is honoured; `review_tier` /
 * `review_rank` are a pass-24 SNAPSHOT of a pure function of class ×
 * corroboration × reachable CZK. 153 of 208 ranks and 4 of 208 tiers stopped
 * matching the tie they sit on after batch-012, and nothing anywhere noticed
 * for weeks (memory/money-stored-review-rank-is-a-stale-cache.md). This is the
 * population that makes that visible the day it happens.
 */
export interface MoneyTieFact {
  key: string;
  tieClass: string | null;
  corroboration: string | null;
  /** `props.review_tier` as stored; null = never stamped (NOT the same as wrong). */
  storedTier: number | null;
  storedRank: number | null;
  contractCzk: number;
  subsidiesCzk: number;
}

/** [G5] One layer's provenance stamps, bucketed. The unit of "uniform or not". */
export interface ProvenanceLayerFact {
  /** The layer as a reader would name it: a node kind, an edge rel, or a track. */
  layer: string;
  /** `pass ? / ref ? / writer ?` → how many rows carry exactly that. */
  buckets: Array<{ key: string; count: number }>;
  rows: number;
}

/** [G5] The `amends` relation's closure — both ends resolve, verdicts have edges. */
export interface AmendsClosureFact {
  edges: number;
  danglingEnds: number;
  billsWithVerdict: number;
  billsWithVerdictAndNoAmends: string[];
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
  /** [G5] Every human-gated money tie + its stored order keys. */
  moneyTies: MoneyTieFact[];
  /** [G5] Per-layer provenance buckets for the graph's three annotated layers. */
  lawProvenance: ProvenanceLayerFact;
  graphProvenance: ProvenanceLayerFact[];
  /** [G5] Closure of the `amends` relation. */
  amends: AmendsClosureFact;
  /**
   * [G5] Loader degradations in the last 24 h, read from the JSONL sidecar.
   * `null` = the file is absent — which is `unevaluable`, never `ok`: "no file"
   * and "no degradations" are opposite findings and must not share a verdict.
   */
  loaderDegradations: LoaderDegradationSummary | null;
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

/** [G5] Human-gated money ties, with the two order keys as STORED. */
async function readMoneyTies(pg: Pglite): Promise<MoneyTieFact[]> {
  const { rows } = await pg.query<Record<string, unknown>>(
    `select src, rel, dst,
            props->>'tie_class'      as tie_class,
            props->>'corroboration'  as corroboration,
            props->>'review_tier'    as review_tier,
            props->>'review_rank'    as review_rank,
            props->>'contract_czk'   as contract_czk,
            props->>'subsidies_czk'  as subsidies_czk
       from kg_edge where rel = 'linked_to' order by src, dst`,
  );
  return rows.map((r) => ({
    key: `${str(r.src)} -linked_to-> ${str(r.dst)}`,
    tieClass: strOrNull(r.tie_class),
    corroboration: strOrNull(r.corroboration),
    storedTier: numOrNull(r.review_tier),
    storedRank: numOrNull(r.review_rank),
    contractCzk: numOrNull(r.contract_czk) ?? 0,
    subsidiesCzk: numOrNull(r.subsidies_czk) ?? 0,
  }));
}

/** Bucket a set of `{pass, ref, writer}` triples into "how many rows agree". */
function bucketize(layer: string, stamps: Array<{ pass: string; ref: string; writer: string }>): ProvenanceLayerFact {
  const counts = new Map<string, number>();
  for (const s of stamps) {
    const key = `pass ${s.pass} / ref ${s.ref} / writer ${s.writer}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    layer,
    rows: stamps.length,
    buckets: [...counts]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1)),
  };
}

const dash = (v: unknown): string => strOrNull(v) ?? "—";

/** [G5] The law layer: every bill carrying a forensic verdict, by its stamp. */
async function readLawProvenance(pg: Pglite): Promise<ProvenanceLayerFact> {
  const { rows } = await pg.query<Record<string, unknown>>(
    `select props->'forensic_provenance'->>'pass'   as pass,
            props->'forensic_provenance'->>'ref'    as ref,
            props->'forensic_provenance'->>'writer' as writer
       from kg_node
      where kind = 'bill' and props ? 'forensic_severity'`,
  );
  return bucketize(
    "law (forensic verdicts)",
    rows.map((r) => ({ pass: dash(r.pass), ref: dash(r.ref), writer: dash(r.writer) })),
  );
}

/**
 * [G5] The graph's own identity provenance, per EDGE RELATION.
 *
 * The unit is the relation, not the store: different relations legitimately come
 * from different passes and writers, and calling that a violation would make the
 * check fire permanently and mean nothing. Mixed WITHIN one relation is the
 * alarm — that is what a half-applied pass looks like.
 */
async function readGraphProvenance(pg: Pglite): Promise<ProvenanceLayerFact[]> {
  const { rows } = await pg.query<Record<string, unknown>>(
    `select rel,
            provenance->>'pass'   as pass,
            provenance->>'ref'    as ref,
            provenance->>'writer' as writer,
            count(*)::int         as n
       from kg_edge group by rel, 2, 3, 4 order by rel`,
  );
  const byRel = new Map<string, Array<{ pass: string; ref: string; writer: string }>>();
  for (const r of rows) {
    const bucket = byRel.get(str(r.rel)) ?? [];
    for (let i = 0; i < num(r.n); i++) {
      bucket.push({ pass: dash(r.pass), ref: dash(r.ref), writer: dash(r.writer) });
    }
    byRel.set(str(r.rel), bucket);
  }
  return [...byRel]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([rel, stamps]) => bucketize(rel, stamps));
}

/** [G5] `amends` closure: both ends resolve, and a verdict implies an edge. */
async function readAmendsClosure(pg: Pglite): Promise<AmendsClosureFact> {
  const { rows: counts } = await pg.query<Record<string, unknown>>(
    `select count(*)::int as edges,
            count(*) filter (
              where not exists (select 1 from kg_node s where s.id = e.src)
                 or not exists (select 1 from kg_node d where d.id = e.dst)
            )::int as dangling
       from kg_edge e where rel = 'amends'`,
  );
  const { rows: bills } = await pg.query<Record<string, unknown>>(
    `select id from kg_node
      where kind = 'bill' and props ? 'forensic_severity'
        and not exists (select 1 from kg_edge e where e.rel = 'amends' and e.src = kg_node.id)
      order by id`,
  );
  const { rows: total } = await pg.query<Record<string, unknown>>(
    `select count(*)::int as n from kg_node where kind = 'bill' and props ? 'forensic_severity'`,
  );
  return {
    edges: num(counts[0]?.edges),
    danglingEnds: num(counts[0]?.dangling),
    billsWithVerdict: num(total[0]?.n),
    billsWithVerdictAndNoAmends: bills.map((r) => str(r.id)),
  };
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
  const moneyTies = await readMoneyTies(pg);
  const lawProvenance = await readLawProvenance(pg);
  const graphProvenance = await readGraphProvenance(pg);
  const amends = await readAmendsClosure(pg);
  // NOT a store read: the degradation log is a file beside the store, and the
  // sentinel reads a COPY of the store — so this is the live sidecar or nothing.
  const loaderDegradations = summarizeLoaderDegradations();
  return {
    releaseStats,
    chain,
    auditCounts,
    orphanEdges,
    runStats,
    entityCoverage,
    persons,
    moneyTies,
    lawProvenance,
    graphProvenance,
    amends,
    loaderDegradations,
  };
}
