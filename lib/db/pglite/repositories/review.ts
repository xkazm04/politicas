// ReviewRepository — the human-review write path for `linked_to` ties (Case ①
// FollowTheMoney verification console). THE ONLY code path allowed to write
// kg_edge.props.review_state. Every decision is audited FIRST (review_audit),
// then the edge is updated — see `Store.ReviewRepository` for the full contract.

import { randomUUID } from "node:crypto";
import type { ReviewRepository } from "../../store";
import type { ReviewAuditRow } from "../../types";
import {
  isoTs,
  json,
  num,
  numOrNull,
  str,
  strOrNull,
  warnIfTruncated,
  type Pglite,
  type PgTransaction,
} from "../internals";
import { GENESIS_HASH, computeAuditRowHash } from "../ledger";

const LINKED_TO = "linked_to";

function mapAuditRow(r: Record<string, unknown>): ReviewAuditRow {
  return {
    id: str(r.id),
    src: str(r.src),
    rel: str(r.rel),
    dst: str(r.dst),
    decision: str(r.decision) as ReviewAuditRow["decision"],
    reviewer: str(r.reviewer),
    note: strOrNull(r.note),
    decidedAt: isoTs(r.decided_at) ?? "",
    priorState: strOrNull(r.prior_state),
    // The chain columns were SELECTed (`select *`) and dropped here since the
    // chain was written — so the one public surface of these rows (/dukazy)
    // could not publish a single verifiable field. Passed through as-is:
    // `null` for rows written before the chain existed, never a fabricated
    // position. Nothing is recomputed and no verification runs on this path.
    chainPos: numOrNull(r.chain_pos),
    prevHash: strOrNull(r.prev_hash),
    rowHash: strOrNull(r.row_hash),
  };
}

export function makeReviewRepo(pg: Pglite): ReviewRepository {
  return {
    async setTieReviewState(src, dst, decision, reviewer, note) {
      // The whole read → audit-insert → update sequence runs inside one transaction.
      // PGlite serializes transactions against every other query on the single shared
      // connection, so two concurrent decisions on the same tie can no longer both read
      // the same `props` before either writes — the second call's transaction only
      // starts once the first has fully committed, closing the lost-update race where
      // whichever `update` landed last used to silently discard the other decision.
      return pg.transaction(async (tx: PgTransaction) => {
        const { rows } = await tx.query<Record<string, unknown>>(
          `select props from kg_edge where src = $1 and rel = $2 and dst = $3`,
          [src, LINKED_TO, dst],
        );
        const edgeRow = rows[0];
        if (!edgeRow) return { ok: false, error: "tie not found" };

        const props = json(edgeRow.props);
        const priorState = strOrNull((props.review_state ?? props.state) as unknown);

        // confirm → verified; reject → rejected (D7, batch 004: a terminal state so a
        // rejected tie is not re-served in the pending queue forever); needs-more
        // legitimately stays — or, on a decided tie, RETURNS to — pending_review ("come
        // back to this"). Neither reject nor needs-more may ever flip to verified.
        const nextReviewState =
          decision === "confirm" ? "verified" : decision === "reject" ? "rejected" : "pending_review";

        // REVERSAL RULE. Overturning an already-decided tie ("verified"/"rejected") into a
        // DIFFERENT state is the one write on this platform that undoes a human's earlier
        // published judgement. It must state why, and the reason belongs in the audit row:
        // the chain is the only place it survives, since `props.review_note` is overwritten
        // by the next decision. Checked BEFORE the audit insert, so a reasonless reversal
        // writes NOTHING AT ALL — no audit row, no edge update — rather than leaving a bare
        // row in the chain. Re-affirming the SAME state (confirm on an already-verified
        // tie) is not a reversal and is unaffected.
        const isReversal =
          (priorState === "verified" || priorState === "rejected") && nextReviewState !== priorState;
        if (isReversal && !note?.trim()) {
          return { ok: false, error: "reversal requires a note" };
        }

        // 1) audit row FIRST — the record of the decision must predate the state flip.
        // The row joins the tamper-evident hash chain (lib/db/pglite/ledger.ts): read
        // the current head INSIDE this transaction (PGlite serializes transactions, so
        // two decisions can never race for the same chain position), then store
        // prev_hash + row_hash over the pinned canonical serialization. decided_at is
        // generated HERE (not by now() in SQL) so the hashed instant and the stored
        // instant are the same value by construction.
        const id = randomUUID();
        const { rows: headRows } = await tx.query<Record<string, unknown>>(
          `select chain_pos, row_hash from review_audit
            where chain_pos is not null order by chain_pos desc limit 1`,
        );
        const head = headRows[0];
        const chainPos = head ? num(head.chain_pos) + 1 : 1;
        const prevHash = head ? str(head.row_hash) : GENESIS_HASH;
        const decidedAt = new Date().toISOString();
        const rowHash = computeAuditRowHash(prevHash, {
          id,
          src,
          rel: LINKED_TO,
          dst,
          decision,
          reviewer,
          note,
          decidedAt,
          priorState,
        });
        await tx.query(
          `insert into review_audit
             (id, src, rel, dst, decision, reviewer, note, decided_at, prior_state, chain_pos, prev_hash, row_hash)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, src, LINKED_TO, dst, decision, reviewer, note, decidedAt, priorState, chainPos, prevHash, rowHash],
        );

        // 2) only THEN update the edge (`nextReviewState` computed above, before the
        // reversal gate that needs it).
        const nextProps: Record<string, unknown> = {
          ...props,
          review_state: nextReviewState,
          last_decision: decision,
          last_reviewer: reviewer,
          last_reviewed_at: new Date().toISOString(),
        };
        if (note != null) nextProps.review_note = note;

        // The flip SUPERSEDES the prior edge version rather than overwriting it
        // (bitemporal write discipline — see repositories/kg.ts): archive the
        // pre-flip version and stamp the new one, in ONE statement so the
        // closed span and the new recorded_at are the same instant. This is
        // what makes "this tie sat in pending_review for 4 months" a queryable
        // fact (edge history joined with the audit chain), not a lost one.
        // The hash-chain serialization above is untouched.
        await tx.query(
          `with archived as (
             insert into kg_edge_history (src, rel, dst, weight, props, provenance, valid_from, valid_to, recorded_at, superseded_at)
             select src, rel, dst, weight, props, provenance, valid_from, valid_to, recorded_at, now()
             from kg_edge where src = $1 and rel = $2 and dst = $3
           )
           update kg_edge set props = $4, recorded_at = now() where src = $1 and rel = $2 and dst = $3`,
          [src, LINKED_TO, dst, JSON.stringify(nextProps)],
        );

        return { ok: true, reviewState: nextReviewState };
      });
    },

    async listReviewAudit(opts) {
      const lim = Math.max(1, Math.min(10_000, opts?.limit ?? 1_000));
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (opts?.src) {
        params.push(opts.src);
        clauses.push(`src = $${params.length}`);
      }
      if (opts?.dst) {
        params.push(opts.dst);
        clauses.push(`dst = $${params.length}`);
      }
      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from review_audit ${where} order by decided_at desc, id desc limit ${lim}`,
        params,
      );
      // /dukazy renders `audit.length` AS A COUNT of gate decisions and /admin
      // sums it by reviewer — so a truncated read does not degrade a list, it
      // publishes a wrong number. Five call sites request exactly the 10 000
      // hard cap, which is the shape this guard exists to catch.
      warnIfTruncated(
        "listReviewAudit",
        rows.length,
        lim,
        clauses.length ? `${opts?.src ?? "*"}→${opts?.dst ?? "*"}` : undefined,
      );
      return rows.map(mapAuditRow);
    },
  };
}
