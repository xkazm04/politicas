/**
 * The persistence boundary for the civic entity graph.
 *
 * Every consumer (ingest adapters, analysis scripts, and — once the mock layer
 * in `lib/civic/` is retired — the feature surfaces) talks ONLY to this `Store`
 * interface. The concrete driver is chosen by `lib/db/config.ts` and imported
 * lazily below, so the ~3 MB PGlite WASM never enters a client bundle.
 *
 * `Store` is composed from four narrow repositories, one per bounded concern.
 * A consumer that only needs one may depend on the narrow interface.
 *
 * To add a backend: implement `Store`, wire it into `getStore()`. No call-site
 * changes. To add domain data: extend a repository here and implement it in
 * every driver.
 */

import { dbDriver } from "./config";
import type {
  AbsenceRow,
  IngestRunRow,
  KgEdgeRow,
  KgNodeRow,
  MandateRow,
  MembershipRow,
  OrganRow,
  PersonRow,
  ReviewAuditRow,
  SliceQualityRow,
  SourceReleaseRow,
  VoteBallotRow,
  VoteEventRow,
  VoteTagRow,
} from "./types";

export interface ListOptions {
  limit?: number;
  /** Restrict to one electoral term, e.g. `PSP10`. */
  termCode?: string;
}

/** person ↔ party/committee ↔ mandate — the static side of the graph. */
export interface GraphRepository {
  upsertPersons(rows: PersonRow[]): Promise<number>;
  upsertOrgans(rows: OrganRow[]): Promise<number>;
  upsertMandates(rows: MandateRow[]): Promise<number>;
  upsertMemberships(rows: MembershipRow[]): Promise<number>;
  listPersons(opts?: ListOptions): Promise<PersonRow[]>;
  listOrgans(opts?: ListOptions): Promise<OrganRow[]>;
  listMandates(opts?: ListOptions): Promise<MandateRow[]>;
  listMemberships(opts?: ListOptions): Promise<MembershipRow[]>;
  /**
   * The club (poslanecký klub) each mandate belonged to, resolved through
   * `membership` → `organ` where the organ's parent is the term's chamber and
   * its type is "Klub". Returns mandatePspId → club abbreviation.
   */
  clubByMandate(termCode: string): Promise<Map<number, string>>;
}

/** roll calls, per-MP ballots, excused absences — the temporal side. */
export interface VoteRepository {
  upsertVoteEvents(rows: VoteEventRow[]): Promise<number>;
  upsertVoteBallots(rows: VoteBallotRow[]): Promise<number>;
  upsertAbsences(rows: AbsenceRow[]): Promise<number>;
  listVoteEvents(opts?: ListOptions): Promise<VoteEventRow[]>;
  listVoteBallots(opts?: ListOptions): Promise<VoteBallotRow[]>;
  listAbsences(opts?: ListOptions): Promise<AbsenceRow[]>;
  countVoteBallots(termCode?: string): Promise<number>;
  /** Per-MP ballot tallies for a term: mandatePspId → {choice → count}. */
  ballotTallies(termCode: string): Promise<Map<number, Record<string, number>>>;
}

/** ingest runs + the Pumper-mirrored release manifest. */
export interface ProvenanceRepository {
  startIngestRun(input: {
    source: string;
    sourceUrl: string | null;
    sourceLastModified: string | null;
    note?: string | null;
  }): Promise<number>;
  finishIngestRun(
    id: number,
    status: "ok" | "failed",
    rowsWritten: number,
    note?: string | null,
  ): Promise<void>;
  listIngestRuns(limit?: number): Promise<IngestRunRow[]>;
  upsertSourceReleases(rows: SourceReleaseRow[]): Promise<number>;
  listSourceReleases(): Promise<SourceReleaseRow[]>;
}

/** Deterministic quality snapshots per slice (the promoted verdict target). */
export interface AnalysisRepository {
  upsertSliceQuality(row: SliceQualityRow): Promise<void>;
  listSliceQuality(): Promise<SliceQualityRow[]>;
  clearAllAnalysis(): Promise<void>;
}

/**
 * Derived theme tags on roll calls — the Silver-layer output of the hybrid
 * `sem_classify` enrichment (benchmarked in docs/hybrid-benchmark-plan.md).
 * DERIVED, recomputable metadata; the materialize script is the only writer.
 */
export interface VoteTagRepository {
  upsertVoteTags(rows: VoteTagRow[]): Promise<number>;
  listVoteTags(opts?: { theme?: string; limit?: number }): Promise<VoteTagRow[]>;
  /** theme slug → tagged-vote count, for a theme filter / breakdown. */
  voteTagCountsByTheme(): Promise<Record<string, number>>;
}

/**
 * The derived knowledge graph (tier 2 of the self-expanding KG loop). Typed nodes
 * and typed, weighted, provenanced edges the app's features read directly. Like
 * `AnalysisRepository` this is DERIVED, recomputable metadata — the deterministic
 * `kg-compute` layer and (later) gated verdicts are the only writers.
 */
export interface KnowledgeGraphRepository {
  upsertKgNodes(rows: KgNodeRow[]): Promise<number>;
  upsertKgEdges(rows: KgEdgeRow[]): Promise<number>;
  listKgNodes(opts?: { kind?: string; limit?: number }): Promise<KgNodeRow[]>;
  listKgEdges(opts?: { rel?: string; limit?: number }): Promise<KgEdgeRow[]>;
  /** Batch fetch by id, e.g. to re-hydrate a `kgNeighbours()` edge set. Order is not significant. */
  getKgNodes(ids: string[]): Promise<KgNodeRow[]>;
  /**
   * One node's incident edges (both directions) plus the distinct nodes at the
   * far end of those edges — the primitive a graph explorer expands a node with.
   */
  kgNeighbours(opts: {
    id: string;
    /** Omit = all relations. */
    rels?: string[];
    /** Cap on returned EDGES (default 500). */
    limit?: number;
  }): Promise<{ edges: KgEdgeRow[]; nodes: KgNodeRow[] }>;
  countKgNodes(): Promise<number>;
  countKgEdges(): Promise<number>;
  /** rel → edge count, for the ledger's graph-metrics block. */
  countKgEdgesByRel(): Promise<Record<string, number>>;
  /** kind → node count, node census (highest-count kind first). */
  kgKindCounts(): Promise<Array<{ kind: string; count: number }>>;
  clearKg(): Promise<void>;
  /**
   * Delete specific edges by their composite key. Narrow, targeted counterpart
   * to `clearKg()` — for case-loop purges of a confirmed-bad edge set (e.g. a
   * false-match class caught by review), never a bulk wipe. Returns the number
   * of edges actually deleted (a key with no matching row does not error).
   */
  deleteKgEdges(keys: readonly { src: string; rel: string; dst: string }[]): Promise<number>;
  /**
   * Delete specific nodes by id. Callers must verify a node has no remaining
   * edges referencing it before deleting (kg_edge has no FK-cascade by design —
   * this is a plain row delete, not an integrity-checked operation).
   */
  deleteKgNodes(ids: readonly string[]): Promise<number>;
}

/**
 * The human-review write path for `linked_to` ties (Case ① FollowTheMoney
 * verification console). THIS is the only code path in the app that is ever
 * allowed to write `kg_edge.props.review_state` — every other consumer
 * (including `kg-compute`) only reads it. Every decision is audited to
 * `review_audit` BEFORE the edge is touched (see `ReviewAuditRow`).
 */
export interface ReviewRepository {
  /**
   * Record a human decision on the `linked_to` tie `src → dst` and update its
   * review state accordingly:
   *  - `confirm`     → `props.review_state = "verified"`.
   *  - `reject`      → `props.review_state = "rejected"` (terminal, D7/batch 004:
   *    a rejected tie must not be re-served in the pending queue forever).
   *  - `needs-more`  → `review_state` stays/returns to `"pending_review"`. On an
   *    already-decided tie this IS the reversal path: the tie goes back into the
   *    queue and the reversal appends its own row to the audit chain. Neither
   *    `reject` nor `needs-more` may ever flip `review_state` to `"verified"`.
   * In every case the decision + reviewer + note are recorded on the edge
   * (`props.last_decision`, `props.last_reviewer`, `props.last_reviewed_at`,
   * `props.review_note`) and the pre-flip edge version is archived into
   * `kg_edge_history`.
   *
   * REVERSING a decided tie (prior state `verified`/`rejected`) REQUIRES a note —
   * it errors with `"reversal requires a note"` and writes nothing at all,
   * because the reason a published judgement was overturned only survives in the
   * audit row (`props.review_note` is overwritten by the next decision).
   *
   * Errors (rather than throwing) when the tie doesn't exist, so callers can
   * render an honest message instead of a stack trace.
   */
  setTieReviewState(
    src: string,
    dst: string,
    decision: "confirm" | "reject" | "needs-more",
    reviewer: string,
    note: string | null,
  ): Promise<{ ok: true; reviewState: string } | { ok: false; error: string }>;
  /** The audit trail, newest first; filter by edge endpoint for one tie's history. */
  listReviewAudit(opts?: { src?: string; dst?: string; limit?: number }): Promise<ReviewAuditRow[]>;
}

export interface Store
  extends GraphRepository,
    VoteRepository,
    ProvenanceRepository,
    AnalysisRepository,
    VoteTagRepository,
    KnowledgeGraphRepository,
    ReviewRepository {
  /** Release the underlying connection (PGlite is single-connection). */
  close(): Promise<void>;
}

let cached: Promise<Store | null> | undefined;

/**
 * Resolve the active store, lazily importing only the chosen driver.
 *
 * The PROMISE is cached (and assigned synchronously before any await) so two
 * concurrent cold-start callers cannot both open PGlite over the same data dir
 * — which, being single-connection, would fail the second one.
 */
export async function getStore(): Promise<Store | null> {
  if (cached !== undefined) return cached;
  cached = (async (): Promise<Store | null> => {
    if (dbDriver() === "pglite") {
      const store = await (await import("./pglite-store")).getPgliteStore();
      // The bootstrap layer (pglite/internals.ts) has its own connection memo,
      // reset when `store.close()` runs — but that never touched THIS cache.
      // Without clearing `cached` here too, a caller that does
      // getStore() -> close() -> getStore() in one process got back the same
      // already-resolved Store object whose methods close over a `pg` handle
      // that had just been closed, failing every call with no clue why.
      // Wrapping close() to clear `cached` first keeps both caches in lockstep.
      const realClose = store.close.bind(store);
      return {
        ...store,
        async close() {
          cached = undefined;
          await realClose();
        },
      };
    }
    return null;
  })();
  cached.catch(() => {
    cached = undefined;
  });
  return cached;
}

/** Test/CLI helper: forget the cached store so the next getStore() re-opens. */
export function resetStoreCache(): void {
  cached = undefined;
}
