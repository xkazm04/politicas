// Server-only loader for the Volební kompas naruby (moonshot 5B): joins the
// REAL PSP10 vote ledger (vote_event + vote_ballot) with the Silver-layer
// vote_tag themes, clubs, mandates and person names, runs the disclosed
// selection rule (kompas/select.ts) and ships the /kompas client tree a
// compact positional record of the ~20 selected roll calls. Alignment itself
// is computed client-side (kompas/score.ts) from the reader's answers — the
// URL is the whole state, no accounts.
//
// Mirrors getVoteRecord.ts: degrades gracefully to null (→ the page renders
// the honest DataUnavailable state) if no store is configured, the ledger or
// the tag layer is below readiness, or PGlite is unavailable at request time.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { BALLOT_FLOOR, EVENT_FLOOR } from "./getVoteRecord";
import { bucketOf, lineOf, type EventIn } from "./record/derive";
import type { ClubTally } from "./record/types";
import { selectQuestions } from "./kompas/select";
import type { KompasBallots, KompasClubLines, KompasData, KompasMp } from "./kompas/types";

const TERM = "PSP10";

const emptyTally = (): ClubTally => ({ yes: 0, no: 0, k: 0, away: 0 });

export const getKompas = cache(async function getKompas(): Promise<KompasData | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const events = await store.listVoteEvents({ termCode: TERM, limit: 100_000 });
    if (events.length < EVENT_FLOOR) {
      if (events.length > 0) {
        reportLoaderFailure("getKompas", new Error(`vote_event below readiness floor: ${events.length}<${EVENT_FLOOR}`));
      }
      return null;
    }
    const tags = await store.listVoteTags({ limit: 100_000 });
    if (tags.length === 0) return null;

    const ballots = await store.listVoteBallots({ termCode: TERM, limit: 1_000_000 });
    if (ballots.length < BALLOT_FLOOR) {
      reportLoaderFailure("getKompas", new Error(`vote_ballot below readiness floor: ${ballots.length}<${BALLOT_FLOOR}`));
      return null;
    }

    const eventsIn: EventIn[] = events.map((e) => ({
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
    }));
    const themeByVote = new Map(tags.map((t) => [t.votePspId, t.theme]));

    /* full-chamber tallies for tagged votes (one O(ballots) pass) */
    const totals = new Map<number, ClubTally>();
    for (const b of ballots) {
      if (!themeByVote.has(b.votePspId)) continue;
      let t = totals.get(b.votePspId);
      if (!t) {
        t = emptyTally();
        totals.set(b.votePspId, t);
      }
      t[bucketOf(b.choice)]++;
    }

    const { selected, candidates } = selectQuestions({ events: eventsIn, totals, themeByVote });
    if (selected.length === 0) return null;
    const selectedIds = new Set(selected.map((s) => s.event.pspId));

    /* per-question positional record + club tallies (second O(ballots) pass) */
    const clubByMandate = await store.clubByMandate(TERM);
    const mandates = await store.listMandates({ termCode: TERM });
    const personByMandate = new Map(mandates.map((m) => [m.pspId, m.personPspId]));
    const persons = await store.listPersons({ limit: 100_000 });
    const nameByPerson = new Map(persons.map((p) => [p.pspId, p.nameFull]));

    const ballotMap: KompasBallots = {};
    const clubTallies = new Map<number, Map<string, ClubTally>>();
    const mpSeen = new Map<number, KompasMp>();
    for (const b of ballots) {
      if (!selectedIds.has(b.votePspId)) continue;
      const person = personByMandate.get(b.mandatePspId);
      if (person === undefined) continue;
      const club = clubByMandate.get(b.mandatePspId) ?? null;
      if (!mpSeen.has(person)) {
        mpSeen.set(person, { personPspId: person, name: nameByPerson.get(person) ?? `#${person}`, club });
      }
      const bucket = bucketOf(b.choice);
      if (bucket !== "away") {
        (ballotMap[b.votePspId] ??= {})[person] = bucket;
      }
      if (club !== null) {
        let clubs = clubTallies.get(b.votePspId);
        if (!clubs) {
          clubs = new Map();
          clubTallies.set(b.votePspId, clubs);
        }
        let t = clubs.get(club);
        if (!t) {
          t = emptyTally();
          clubs.set(club, t);
        }
        t[bucket]++;
      }
    }

    const clubLines: KompasClubLines = {};
    for (const [voteId, clubs] of clubTallies) {
      for (const [club, t] of clubs) {
        const line = lineOf(t);
        if (line !== null) (clubLines[voteId] ??= {})[club] = line;
      }
    }

    const valid = eventsIn.filter((e) => !e.voided);
    const validDates = valid.map((e) => e.votedOn).filter((d): d is string => d !== null);
    let tagged = 0;
    for (const e of valid) if (themeByVote.has(e.pspId)) tagged++;

    return {
      questions: selected.map((s) => ({
        votePspId: s.event.pspId,
        title: (s.event.titleLong ?? s.event.titleShort ?? s.event.titleNorm ?? "").trim() || `#${s.event.pspId}`,
        theme: s.theme,
        votedOn: s.event.votedOn,
        sessionNo: s.event.sessionNo,
        voteNo: s.event.voteNo,
        outcome: s.event.outcome,
        total: s.total,
        margin: s.margin,
        sourceUrl: s.event.sourceUrl,
      })),
      mps: [...mpSeen.values()].sort((a, b) => a.name.localeCompare(b.name, "cs")),
      ballots: ballotMap,
      clubLines,
      coverage: {
        valid: valid.length,
        tagged,
        candidates,
        from: validDates.length ? validDates.reduce((a, b) => (a < b ? a : b)) : null,
        to: validDates.length ? validDates.reduce((a, b) => (a > b ? a : b)) : null,
      },
    };
  } catch (err) {
    reportLoaderFailure("getKompas", err);
    return null;
  }
});
