// Server-only: the MP's OWN rebellion instances — the roll calls where they voted
// against their club's line, by date, title and direction.
//
// WHY THIS EXISTS AT ALL. The spis printed one aggregate per club („18,4 % · 47/255")
// and nothing under it. The instances are real, dated, per-vote facts that /hlasovani
// already derives — a rate with no roll call behind it is the one number on this page a
// reader cannot check.
//
// NO SECOND DERIVATION, NO SECOND READ, AND SINCE 2026-08-11 NO SECOND PASS.
// Rebellion is a rule (a positional vote against the strict majority of the club's
// positional votes, with the merged K bucket never counting as either — 90/1995 Sb.),
// and a second implementation of it on the profile would be a second answer about a
// named person. The history of this file is the whole argument for where it ended up:
//
//   • It used to hand-roll all five reads (vote_event, vote_ballot, clubByMandate,
//     mandate, person) with its own literal limits and its own copy of the readiness
//     floors. Its `EventIn` rows carried NO `published` tallies, so the chamber's
//     self-check (record/reconcile.ts) was structurally dead on /poslanec — silently,
//     while running on /hlasovani.
//   • Then it read through `readLedger()` and derived for itself. That fixed the
//     reconciliation and the caps, but the ledger read still happened TWICE per memo
//     window — once for /hlasovani, once here — 16 seconds each.
//   • Now it rides `getFullVoteRecord()`: the record derived ONCE with an uncapped
//     chronicle and memoized in votetrack. A warm /hlasovani means this page pays
//     nothing at all, and vice versa. The 24-row cap /hlasovani renders is a prefix
//     of that same chronicle (pinned by features/votetrack/chronicleCap.test.ts),
//     so neither surface gives up anything for the other.
//
// This module therefore holds NO memo, NO read and NO derivation — only the index by
// person and the row cap, both in the pure module beside it. `react.cache()` makes the
// indexing happen once per request; across requests it costs nothing worth memoizing
// (~1 301 chronicle rows on the live record), and one memo fewer is one clock fewer.
//
// COST, measured on the live store (PSP10, 3 rounds), for the pass that is now shared:
//   listVoteEvents   2 030 rows        251 ms
//   listVoteBallots  406 000 rows   15 758 / 15 987 / 15 984 ms   ← the whole cost
//   registry (clubs + mandates + persons)                 779 ms
//   deriveVoteRecord with an uncapped chronicle           459–555 ms
//
// The section still renders inside a Suspense boundary (RebellionSlot.tsx): when the
// shared window HAS expired, the first request pays those 16 s, and the rest of the
// spis must not wait on them.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getFullVoteRecord } from "@/features/votetrack/getVoteRecord";
import {
  indexRebellions,
  rebellionRecordFor,
  type ProfileRebellionRecord,
  type RebellionIndex,
} from "./rebellionRecord";

// The shapes and the projection live in the PURE module beside this one; a consumer
// may import either. Only the read and the failure reporting are server-side.
export type { ProfileRebellionRecord, RebellionInstance } from "./rebellionRecord";
export { PROFILE_REBELLION_ROWS } from "./rebellionRecord";

/** Test seam: drop the cross-request memo the spis now rides. It lives in votetrack
 *  (one memo over one record for both surfaces), so this is a re-export under the
 *  name the rest of the repo already cites as the precedent — not a second memo. */
export { resetVoteRecordMemo as resetRebellionMemo } from "@/features/votetrack/getVoteRecord";

/** The whole chronicle indexed by person, once per request. */
const rebellionIndex = cache(async function rebellionIndex(): Promise<RebellionIndex | null> {
  const record = await getFullVoteRecord();
  return record === null ? null : indexRebellions(record);
});

/**
 * One MP's rebellion instances, newest first. `null` = the ledger could not be read
 * (the section then says so rather than rendering an honest-looking empty record);
 * an MP who never broke the line gets a record with an EMPTY `instances`, which is
 * a real answer.
 */
export async function getRebellionRecord(pspId: number): Promise<ProfileRebellionRecord | null> {
  try {
    const index = await rebellionIndex();
    if (index === null) return null;
    return rebellionRecordFor(index, pspId);
  } catch (err) {
    reportLoaderFailure("getRebellionRecord", err);
    return null;
  }
}
