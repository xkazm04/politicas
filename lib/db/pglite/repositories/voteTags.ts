// VoteTagRepository — derived theme tags on roll calls (the Silver-layer
// sem_classify enrichment). DERIVED, recomputable metadata; the materialize
// script is the only writer.

import type { VoteTagRepository } from "../../store";
import type { VoteTagRow } from "../../types";
import { isoTs, num, numOrNull, str, upsertMany, warnIfTruncated, type Pglite } from "../internals";
import { VOTE_TAG_COLS } from "../mappers";

export function makeVoteTagRepo(pg: Pglite): VoteTagRepository {
  return {
    upsertVoteTags: (rows) =>
      upsertMany(pg, "vote_tag", VOTE_TAG_COLS, rows, (r: VoteTagRow) => [
        r.id, r.votePspId, r.theme, r.confidence, r.model, r.method, r.taggedAt,
      ]),
    async listVoteTags(opts) {
      const lim = Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));
      const where = opts?.theme ? `where theme = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from vote_tag ${where} order by vote_psp_id limit ${lim}`,
        opts?.theme ? [opts.theme] : [],
      );
      // /kompas selects its ~20 questions from these tags and PRINTS the
      // confidence floor it applied; a silently short read would move that
      // selection without moving the published rule.
      warnIfTruncated("listVoteTags", rows.length, lim, opts?.theme);
      return rows.map((r) => ({
        id: str(r.id),
        votePspId: num(r.vote_psp_id),
        theme: str(r.theme),
        confidence: numOrNull(r.confidence),
        model: str(r.model),
        method: str(r.method),
        taggedAt: isoTs(r.tagged_at) ?? "",
      }));
    },
    async voteTagCountsByTheme() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select theme, count(*)::int as n from vote_tag group by theme order by n desc`,
      );
      const out: Record<string, number> = {};
      for (const r of rows) out[str(r.theme)] = num(r.n);
      return out;
    },
  };
}
