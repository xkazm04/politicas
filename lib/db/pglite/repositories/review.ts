// ReviewRepository — the human-review write path for `linked_to` ties (Case ①
// FollowTheMoney verification console). THE ONLY code path allowed to write
// kg_edge.props.review_state. Every decision is audited FIRST (review_audit),
// then the edge is updated — see `Store.ReviewRepository` for the full contract.

import { randomUUID } from "node:crypto";
import type { ReviewRepository } from "../../store";
import type { ReviewAuditRow } from "../../types";
import { isoTs, json, str, strOrNull, type Pglite } from "../internals";

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
  };
}

export function makeReviewRepo(pg: Pglite): ReviewRepository {
  return {
    async setTieReviewState(src, dst, decision, reviewer, note) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select props from kg_edge where src = $1 and rel = $2 and dst = $3`,
        [src, LINKED_TO, dst],
      );
      const edgeRow = rows[0];
      if (!edgeRow) return { ok: false, error: "tie not found" };

      const props = json(edgeRow.props);
      const priorState = strOrNull((props.review_state ?? props.state) as unknown);

      // 1) audit row FIRST — the record of the decision must predate the state flip.
      const id = randomUUID();
      await pg.query(
        `insert into review_audit (id, src, rel, dst, decision, reviewer, note, decided_at, prior_state)
         values ($1,$2,$3,$4,$5,$6,$7, now(), $8)`,
        [id, src, LINKED_TO, dst, decision, reviewer, note, priorState],
      );

      // 2) only THEN update the edge. confirm → verified; reject → rejected (D7, batch
      // 004: a terminal state so a rejected tie is not re-served in the pending queue
      // forever); needs-more legitimately stays pending_review ("come back to this").
      // Neither reject nor needs-more may ever flip review_state to verified.
      const nextReviewState = decision === "confirm" ? "verified" : decision === "reject" ? "rejected" : "pending_review";
      const nextProps: Record<string, unknown> = {
        ...props,
        review_state: nextReviewState,
        last_decision: decision,
        last_reviewer: reviewer,
        last_reviewed_at: new Date().toISOString(),
      };
      if (note != null) nextProps.review_note = note;

      await pg.query(`update kg_edge set props = $4 where src = $1 and rel = $2 and dst = $3`, [
        src,
        LINKED_TO,
        dst,
        JSON.stringify(nextProps),
      ]);

      return { ok: true, reviewState: nextReviewState };
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
        `select * from review_audit ${where} order by decided_at desc limit ${lim}`,
        params,
      );
      return rows.map(mapAuditRow);
    },
  };
}
