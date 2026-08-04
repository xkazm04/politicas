// Server-only: the MP's OWN rebellion instances — the roll calls where they voted
// against their club's line, by date, title and direction.
//
// WHY THIS EXISTS AT ALL. The spis printed one aggregate per club („18,4 % · 47/255")
// and nothing under it. The instances are real, dated, per-vote facts that /hlasovani
// already derives — a rate with no roll call behind it is the one number on this page a
// reader cannot check.
//
// NO SECOND DERIVATION. Rebellion is a rule (a positional vote against the strict
// majority of the club's positional votes, with the merged K bucket never counting as
// either — 90/1995 Sb.), and a second implementation of it on the profile would be a
// second answer about a named person. So this module calls `deriveVoteRecord()` — the
// SAME pure derivation /hlasovani uses — and changes exactly one PRESENTATION bound:
// `chronicleCap`, which the derivation already exposes as an option. The chamber-wide
// chronicle is capped at 24 rows newest-first, so filtering THAT for one MP would answer
// „no rebellions" for nearly everyone; uncapped it is 1 301 rows across 188 MPs, which is
// then indexed by person here and never re-derived.
//
// COST, measured on the live store (PSP10, 3 rounds):
//   listVoteEvents   2 030 rows        251 ms
//   listVoteBallots  406 000 rows   15 758 / 15 987 / 15 984 ms   ← the whole cost
//   registry (clubs + mandates + persons)                 779 ms
//   deriveVoteRecord with an uncapped chronicle           459–555 ms
// A 16-second read cannot happen per request, and `react.cache()` (what getVoteRecord
// uses) is scoped to ONE request. So the per-MP index is memoized ACROSS requests on the
// same bound the money layer declares (`MONEY_MEMO_TTL_MS`, imported — two memos over one
// graph on two clocks is how two surfaces print two vintages of one number), and the
// section renders inside a Suspense boundary so the first request after expiry streams
// the rest of the spis immediately instead of waiting on the ballots.
//
// Neither a failure nor an empty read is memoized.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import { BALLOT_FLOOR, EVENT_FLOOR } from "@/features/votetrack/getVoteRecord";
import { deriveVoteRecord } from "@/features/votetrack/record/derive";
import {
  indexRebellions,
  rebellionRecordFor,
  type ProfileRebellionRecord,
  type RebellionIndex,
} from "./rebellionRecord";

const TERM = "PSP10";

// The shapes and the projection live in the PURE module beside this one; a consumer
// may import either. Only the reads, the floors and the memo are server-side.
export type { ProfileRebellionRecord, RebellionInstance } from "./rebellionRecord";
export { PROFILE_REBELLION_ROWS } from "./rebellionRecord";

let memo: { at: number; index: RebellionIndex } | null = null;

/** Test seam: drop the cross-request memo (the money loader's `resetSuppliesMemo`
 *  precedent). Never called by the app. */
export function resetRebellionMemo(): void {
  memo = null;
}

async function buildIndex(): Promise<RebellionIndex | null> {
  const store = await getStore();
  if (!store) return null;

  // The readiness floors are getVoteRecord's own, imported rather than restated —
  // the two surfaces must refuse a half-ingested ledger at the same point, or the
  // spis would publish rebellion rows /hlasovani considers unpublishable.
  const events = await store.listVoteEvents({ termCode: TERM, limit: 100_000 });
  if (events.length < EVENT_FLOOR) {
    if (events.length > 0) {
      reportLoaderFailure(
        "getRebellionRecord",
        new Error(`vote_event below readiness floor: ${events.length}<${EVENT_FLOOR}`),
      );
    }
    return null;
  }
  const ballots = await store.listVoteBallots({ termCode: TERM, limit: 1_000_000 });
  if (ballots.length < BALLOT_FLOOR) {
    reportLoaderFailure(
      "getRebellionRecord",
      new Error(`vote_ballot below readiness floor: ${ballots.length}<${BALLOT_FLOOR}`),
    );
    return null;
  }

  const clubByMandate = await store.clubByMandate(TERM);
  const mandates = await store.listMandates({ termCode: TERM });
  const personByMandate = new Map(mandates.map((m) => [m.pspId, m.personPspId]));
  const persons = await store.listPersons({ limit: 100_000 });
  const nameByPerson = new Map(persons.map((p) => [p.pspId, p.nameFull]));

  return indexRebellions(
    deriveVoteRecord(
    {
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
    },
      // The ONE bound this surface changes: /hlasovani shows the chamber's 24 newest
      // rebellions, the spis needs one MP's whole record. Everything else — the rule,
      // the ordering, the titles, the links — is the shared derivation's.
      { chronicleCap: Number.MAX_SAFE_INTEGER },
    ),
  );
}

/**
 * One MP's rebellion instances, newest first. `null` = the ledger could not be read
 * (the section then says so rather than rendering an honest-looking empty record);
 * an MP who never broke the line gets a record with an EMPTY `instances`, which is
 * a real answer.
 */
export async function getRebellionRecord(pspId: number): Promise<ProfileRebellionRecord | null> {
  try {
    const fresh = memo && Date.now() - memo.at < MONEY_MEMO_TTL_MS;
    if (!fresh) {
      const index = await buildIndex();
      if (!index) return null;
      // An empty index is not memoized: it is indistinguishable from a store that
      // came back without the ledger, and freezing it for a day would publish a
      // chamber with no rebellions at all.
      if (index.byMp.size > 0) memo = { at: Date.now(), index };
      return rebellionRecordFor(index, pspId);
    }
    return rebellionRecordFor(memo!.index, pspId);
  } catch (err) {
    reportLoaderFailure("getRebellionRecord", err);
    return null;
  }
}

