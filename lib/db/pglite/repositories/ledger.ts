// LedgerRepository — the tamper-evident ledger's data API (read/verify/seal).
//
// The WRITE side of the chain lives in review.ts (setTieReviewState appends the
// chained audit row inside its existing transaction); this repository exposes:
//  • the current chain head + one-pass O(n) verification with first-divergence,
//  • Merkle sealing of an ingest run (root over every row the run wrote),
//  • the combined "heads" view — the data an admin surface (VaultHeadsPanel or a
//    public /integrita page) renders. Rendering is NOT this module's job; features
//    consume this API only. All pure crypto lives in ../ledger.ts.
//
// This repository is deliberately additive and self-contained: it is not folded
// into the `Store` facade (lib/db/store.ts is shared substrate), so existing
// consumers are untouched. Server-side callers use `getLedgerRepo()`.

import {
  EMPTY_MERKLE_ROOT,
  merkleLeafHash,
  merkleRoot,
  verifyAuditChain,
  type ChainVerification,
  type ChainedAuditRow,
} from "../ledger";
import { isoTs, num, numOrNull, open, str, strOrNull, type Pglite } from "../internals";

/**
 * Tables an ingest run writes rows into (every one carries `ingest_run_id`).
 * Sealing hashes each of the run's rows AS STORED/SERVED (the full row, `raw`
 * included), in this pinned table order, each table's rows ordered by `id` —
 * so the same database state always produces the same root.
 */
const RUN_TABLES = [
  "person",
  "organ",
  "mandate",
  "membership",
  "vote_event",
  "vote_ballot",
  "absence",
  "source_release",
] as const;

export interface ReviewChainHead {
  chainPos: number;
  rowHash: string;
  id: string;
  decidedAt: string;
}

export interface SealedRunHead {
  runId: number;
  source: string;
  status: string;
  merkleRoot: string;
  leafCount: number;
  sealedAt: string | null;
  finishedAt: string | null;
}

export interface LedgerHeads {
  reviewChain: (ReviewChainHead & { length: number }) | null;
  sealedRuns: SealedRunHead[];
}

export interface LedgerRepository {
  /** Newest chained audit row, or null while the chain is empty. */
  getReviewChainHead(): Promise<ReviewChainHead | null>;
  /**
   * Re-hash every chained audit row in one O(n) ascending pass and report the
   * first divergence (tampered row, broken link, or deleted row). Rows written
   * before the chain existed (NULL chain_pos) are outside the chain by design.
   */
  verifyReviewChain(): Promise<ChainVerification>;
  /**
   * Compute + store the Merkle root over every row `ingest_run_id = runId` wrote
   * (see RUN_TABLES). Idempotent: re-sealing the same unchanged data yields the
   * same root. A run that wrote nothing seals to the pinned EMPTY_MERKLE_ROOT.
   */
  sealIngestRun(
    runId: number,
  ): Promise<{ ok: true; merkleRoot: string; leafCount: number } | { ok: false; error: string }>;
  /** Everything a heads panel needs: chain head+length and sealed-run roots (newest first). */
  getLedgerHeads(): Promise<LedgerHeads>;
}

function mapChainedRow(r: Record<string, unknown>): ChainedAuditRow {
  return {
    chainPos: num(r.chain_pos),
    prevHash: str(r.prev_hash),
    rowHash: str(r.row_hash),
    id: str(r.id),
    src: str(r.src),
    rel: str(r.rel),
    dst: str(r.dst),
    decision: str(r.decision),
    reviewer: str(r.reviewer),
    note: strOrNull(r.note),
    decidedAt: isoTs(r.decided_at) ?? "",
    priorState: strOrNull(r.prior_state),
  };
}

export function makeLedgerRepo(pg: Pglite): LedgerRepository {
  async function getReviewChainHead(): Promise<ReviewChainHead | null> {
    const { rows } = await pg.query<Record<string, unknown>>(
      `select chain_pos, row_hash, id, decided_at from review_audit
        where chain_pos is not null order by chain_pos desc limit 1`,
    );
    const r = rows[0];
    if (!r) return null;
    return {
      chainPos: num(r.chain_pos),
      rowHash: str(r.row_hash),
      id: str(r.id),
      decidedAt: isoTs(r.decided_at) ?? "",
    };
  }

  return {
    getReviewChainHead,

    async verifyReviewChain() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from review_audit where chain_pos is not null order by chain_pos asc`,
      );
      return verifyAuditChain(rows.map(mapChainedRow));
    },

    async sealIngestRun(runId) {
      const { rows: runRows } = await pg.query<Record<string, unknown>>(
        `select id from ingest_run where id = $1`,
        [runId],
      );
      if (!runRows[0]) return { ok: false, error: "ingest run not found" };

      const leaves: string[] = [];
      for (const table of RUN_TABLES) {
        const { rows } = await pg.query<Record<string, unknown>>(
          `select * from ${table} where ingest_run_id = $1 order by id asc`,
          [runId],
        );
        for (const row of rows) leaves.push(merkleLeafHash(table, row));
      }
      const root = leaves.length === 0 ? EMPTY_MERKLE_ROOT : merkleRoot(leaves);
      await pg.query(
        `update ingest_run
            set merkle_root = $2, merkle_leaf_count = $3, merkle_sealed_at = now()
          where id = $1`,
        [runId, root, leaves.length],
      );
      return { ok: true, merkleRoot: root, leafCount: leaves.length };
    },

    async getLedgerHeads() {
      const head = await getReviewChainHead();
      let reviewChain: LedgerHeads["reviewChain"] = null;
      if (head) {
        const { rows } = await pg.query<Record<string, unknown>>(
          `select count(*)::int as n from review_audit where chain_pos is not null`,
        );
        reviewChain = { ...head, length: num(rows[0]?.n) };
      }
      const { rows: sealed } = await pg.query<Record<string, unknown>>(
        `select id, source, status, merkle_root, merkle_leaf_count, merkle_sealed_at, finished_at
           from ingest_run where merkle_root is not null
          order by merkle_sealed_at desc, id desc limit 50`,
      );
      return {
        reviewChain,
        sealedRuns: sealed.map((r) => ({
          runId: num(r.id),
          source: str(r.source),
          status: str(r.status),
          merkleRoot: str(r.merkle_root),
          leafCount: numOrNull(r.merkle_leaf_count) ?? 0,
          sealedAt: isoTs(r.merkle_sealed_at),
          finishedAt: isoTs(r.finished_at),
        })),
      };
    },
  };
}

/** Server-side entry point: the ledger over the app's live PGlite connection. */
export async function getLedgerRepo(): Promise<LedgerRepository> {
  return makeLedgerRepo(await open());
}
