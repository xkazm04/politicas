// VoteRepository — roll calls, per-MP ballots, excused absences: the temporal side.

import type { VoteRepository } from "../../store";
import type { AbsenceRow, VoteBallotRow, VoteEventRow } from "../../types";
import { limitOf, num, str, upsertMany, warnIfTruncated, type Pglite } from "../internals";
import {
  ABSENCE_COLS,
  BALLOT_COLS,
  VOTE_EVENT_COLS,
  mapAbsence,
  mapBallot,
  mapVoteEvent,
} from "../mappers";

export function makeVoteRepo(pg: Pglite): VoteRepository {
  // Scope ballots to a term via their roll call. Kept local — only the vote
  // queries need it.
  const termJoinBallots = (termCode?: string) =>
    termCode
      ? {
          sql: ` join vote_event ve on ve.psp_id = vote_ballot.vote_psp_id and ve.term_code = $1`,
          params: [termCode] as unknown[],
        }
      : { sql: "", params: [] as unknown[] };

  return {
    upsertVoteEvents: (rows) =>
      upsertMany(pg, "vote_event", VOTE_EVENT_COLS, rows, (r: VoteEventRow) => [
        r.id, r.pspId, r.termPspId, r.termCode, r.sessionNo, r.voteNo, r.agendaItem,
        r.votedAt, r.votedOn, r.yes, r.no, r.abstain, r.notVoting, r.present, r.quorum,
        r.kind, r.outcome, r.titleLong, r.titleShort, r.titleNorm, r.voided,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    upsertVoteBallots: (rows) =>
      upsertMany(pg, "vote_ballot", BALLOT_COLS, rows, (r: VoteBallotRow) => [
        r.id, r.votePspId, r.mandatePspId, r.code, r.choice,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId,
      ]),
    upsertAbsences: (rows) =>
      upsertMany(pg, "absence", ABSENCE_COLS, rows, (r: AbsenceRow) => [
        r.id, r.termPspId, r.mandatePspId, r.day, r.fromTime, r.toTime, r.wholeDay,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),

    async listVoteEvents(opts) {
      const limit = limitOf(opts);
      const where = opts?.termCode ? `where term_code = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from vote_event ${where} order by psp_id limit ${limit}`,
        opts?.termCode ? [opts.termCode] : [],
      );
      // The roll-call spine of /hlasovani, /kompas and the spis rebellion
      // index. Ordered by psp_id, so a truncation would systematically retire
      // the newest roll calls — and the ledger would report a chamber that
      // stopped voting.
      warnIfTruncated("listVoteEvents", rows.length, limit, opts?.termCode);
      return rows.map(mapVoteEvent);
    },
    async listVoteBallots(opts) {
      const limit = limitOf(opts);
      const ids = opts?.voteIds;
      // An empty id list is a REAL filter that matches nothing — dropping it and
      // reading the whole 406 000-row relation instead would be the worst possible
      // reading of "no votes selected".
      if (ids !== undefined && ids.length === 0) return [];
      const j = termJoinBallots(opts?.termCode);
      // Both filters apply when both are given; the roll-call predicate rides
      // `vote_ballot_vote_idx` (bitmap index scan — measured, see BallotListOptions).
      const where = ids === undefined ? "" : ` where vote_ballot.vote_psp_id = any($${j.params.length + 1}::int[])`;
      const params = ids === undefined ? j.params : [...j.params, [...ids]];
      const { rows } = await pg.query<Record<string, unknown>>(
        `select vote_ballot.* from vote_ballot${j.sql}${where}
          order by vote_ballot.vote_psp_id, vote_ballot.mandate_psp_id
          limit ${limit}`,
        params,
      );
      warnIfTruncated(
        "listVoteBallots",
        rows.length,
        limit,
        ids === undefined ? opts?.termCode : `${opts?.termCode ?? "*"}/voteIds=${ids.length}`,
      );
      return rows.map(mapBallot);
    },
    async listAbsences(opts) {
      const where = opts?.termCode
        ? `where term_psp_id = (select psp_id from organ where abbrev = $1)`
        : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from absence ${where} order by id limit ${limitOf(opts)}`,
        opts?.termCode ? [opts.termCode] : [],
      );
      // An unknown/misspelled termCode and a real term with genuinely zero
      // absences both produce an empty result — the subquery's zero-row match
      // evaluates to SQL NULL, and `term_psp_id = NULL` is never true, so a
      // typo'd term code silently looks identical to "clean record" rather
      // than "broken query". One cheap existence check only on the empty path.
      if (rows.length === 0 && opts?.termCode) {
        const { rows: organRows } = await pg.query(`select 1 from organ where abbrev = $1`, [opts.termCode]);
        if (organRows.length === 0) {
          console.warn(`[listAbsences] termCode "${opts.termCode}" does not resolve to any organ — returning empty`);
        }
      }
      return rows.map(mapAbsence);
    },
    async countVoteBallots(termCode) {
      const j = termJoinBallots(termCode);
      const { rows } = await pg.query<{ n: string | number }>(
        `select count(*)::int as n from vote_ballot${j.sql}`,
        j.params,
      );
      return num(rows[0]?.n);
    },
    async ballotTallies(termCode) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select b.mandate_psp_id, b.choice, count(*)::int as n
           from vote_ballot b
           join vote_event ve on ve.psp_id = b.vote_psp_id
          where ve.term_code = $1
          group by b.mandate_psp_id, b.choice`,
        [termCode],
      );
      const out = new Map<number, Record<string, number>>();
      for (const r of rows) {
        const id = num(r.mandate_psp_id);
        const bucket = out.get(id) ?? {};
        bucket[str(r.choice)] = num(r.n);
        out.set(id, bucket);
      }
      return out;
    },
  };
}
