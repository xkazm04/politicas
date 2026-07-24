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
  SliceQualityRow,
  SourceReleaseRow,
  VoteBallotRow,
  VoteEventRow,
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
  countKgNodes(): Promise<number>;
  countKgEdges(): Promise<number>;
  /** rel → edge count, for the ledger's graph-metrics block. */
  countKgEdgesByRel(): Promise<Record<string, number>>;
  clearKg(): Promise<void>;
}

export interface Store
  extends GraphRepository,
    VoteRepository,
    ProvenanceRepository,
    AnalysisRepository,
    KnowledgeGraphRepository {
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
      return await (await import("./pglite-store")).getPgliteStore();
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
