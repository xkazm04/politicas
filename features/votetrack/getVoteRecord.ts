// Server-only loader for the Seismograf: joins the REAL PSP10 vote ledger
// (vote_event + vote_ballot) with clubs (clubByMandate), mandates and person
// names, and hands the pure derivation (record/derive.ts) everything it needs.
// Mirrors getVoteThemes.ts: degrades gracefully to null (→ the page falls back
// to the labelled mock + LiveDataNotice) if no store is configured, the ledger
// is below its readiness floor, or PGlite is unavailable at request time.
//
// Request-time cost: one O(ballots) double pass over ~406k rows (~tens of ms),
// `react.cache`-wrapped so metadata + page body share a single run. Precomputing
// per-vote aggregates at ingest is the documented next step if this ever shows
// up in traces.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { deriveVoteRecord } from "./record/derive";
import type { VoteRecordData } from "./record/types";

const TERM = "PSP10";

/** Readiness floors for the vote ledger itself (the kg cardinality floors in
 * lib/db/readiness.ts guard graph nodes, not ballots). ≈70 % of the 2026-07
 * ingest (2 030 events / 406 000 ballots) — below these a half-ingested ledger
 * would publish real-looking discipline numbers off a partial record. */
export const EVENT_FLOOR = 1400;
export const BALLOT_FLOOR = 280_000;

export const getVoteRecord = cache(async function getVoteRecord(): Promise<VoteRecordData | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const events = await store.listVoteEvents({ termCode: TERM, limit: 100_000 });
    if (events.length < EVENT_FLOOR) {
      if (events.length > 0) {
        reportLoaderFailure("getVoteRecord", new Error(`vote_event below readiness floor: ${events.length}<${EVENT_FLOOR}`));
      }
      return null;
    }

    const ballots = await store.listVoteBallots({ termCode: TERM, limit: 1_000_000 });
    if (ballots.length < BALLOT_FLOOR) {
      reportLoaderFailure("getVoteRecord", new Error(`vote_ballot below readiness floor: ${ballots.length}<${BALLOT_FLOOR}`));
      return null;
    }

    const clubByMandate = await store.clubByMandate(TERM);
    const mandates = await store.listMandates({ termCode: TERM });
    const personByMandate = new Map(mandates.map((m) => [m.pspId, m.personPspId]));
    const persons = await store.listPersons({ limit: 100_000 });
    const nameByPerson = new Map(persons.map((p) => [p.pspId, p.nameFull]));

    return deriveVoteRecord({
      events: events.map((e) => ({
        pspId: e.pspId,
        votedOn: e.votedOn,
        votedAt: e.votedAt,
        sessionNo: e.sessionNo,
        voteNo: e.voteNo,
        outcome: e.outcome,
        voided: e.voided,
        titleLong: e.titleLong,
        titleShort: e.titleShort,
        titleNorm: e.titleNorm,
        sourceUrl: e.sourceUrl,
      })),
      ballots,
      clubByMandate,
      personByMandate,
      nameByPerson,
    });
  } catch (err) {
    reportLoaderFailure("getVoteRecord", err);
    return null;
  }
});
