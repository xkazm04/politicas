// Server-only: the MP's OWN rebellion instances — the roll calls where they voted
// against their club's line, by date, title and direction.
//
// WHY THIS EXISTS AT ALL. The spis printed one aggregate per club („18,4 % · 47/255")
// and nothing under it. The instances are real, dated, per-vote facts that /hlasovani
// already derives — a rate with no roll call behind it is the one number on this page a
// reader cannot check.
//
// NO SECOND DERIVATION, AND SINCE 2026-08-10 NO SECOND READ EITHER.
// Rebellion is a rule (a positional vote against the strict majority of the club's
// positional votes, with the merged K bucket never counting as either — 90/1995 Sb.),
// and a second implementation of it on the profile would be a second answer about a
// named person. So the rule comes from `deriveVoteRecord()` — the SAME pure derivation
// /hlasovani uses — and the ROWS it derives from now come from `readLedger()`, the one
// read path features/votetrack/ledgerRead.ts owns. This module used to hand-roll all
// five reads (vote_event, vote_ballot, clubByMandate, mandate, person) with its own
// literal limits and its own copy of the readiness floors, and it cost more than tidiness:
//   • its `EventIn` rows carried NO `published` tallies, so every roll call on this path
//     was UNCOMPARED — the chamber's self-check (record/reconcile.ts) was structurally
//     dead on /poslanec, silently, while /hlasovani ran it;
//   • its 100 000 / 1 000 000 limits sat outside the app's one read cap (KG_READ_CAP),
//     which in PGlite is not cosmetic (a small limit walks the primary key instead of an
//     index — see CLAUDE.md, /zebricek 2026-08-04).
// The profile still changes exactly ONE thing about the derivation, and it is a
// PRESENTATION bound the derivation already exposes: `chronicleCap` (see
// `deriveRebellionIndex` in ./rebellionRecord.ts).
//
// COST, measured on the live store (PSP10, 3 rounds):
//   listVoteEvents   2 030 rows        251 ms
//   listVoteBallots  406 000 rows   15 758 / 15 987 / 15 984 ms   ← the whole cost
//   registry (clubs + mandates + persons)                 779 ms
//   deriveVoteRecord with an uncapped chronicle           459–555 ms
// A 16-second read cannot happen per request, and `react.cache()` (which readLedger uses)
// is scoped to ONE request. So the DERIVED index is memoized ACROSS requests through
// `createLedgerMemo` — the same policy object /hlasovani's record memo is built from, on
// the same bound (`MONEY_MEMO_TTL_MS`, imported inside it, never re-declared: two memos
// over one graph on two clocks is how two surfaces print two vintages of one number) —
// and the section renders inside a Suspense boundary so the first request after expiry
// streams the rest of the spis immediately instead of waiting on the ballots.
//
// HONEST LIMIT: the raw 406 000-row read is still paid once per TTL window PER SURFACE,
// because ledgerMemo.ts deliberately memoizes only DERIVED results — holding the ballots
// themselves for a day is a memory cost that saving does not buy. Collapsing the two
// passes into one would mean memoizing the UNCAPPED record in getVoteRecord.ts and letting
// /hlasovani slice its 24-row window off it (`chronicleCap` is a prefix break, so the
// content is identical) — a change to a file this module does not own.
//
// Neither a failure nor an empty read is memoized.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { createLedgerMemo } from "@/features/votetrack/ledgerMemo";
import { readLedger } from "@/features/votetrack/ledgerRead";
import {
  deriveRebellionIndex,
  rebellionRecordFor,
  type ProfileRebellionRecord,
  type RebellionIndex,
} from "./rebellionRecord";

// The shapes and the projection live in the PURE module beside this one; a consumer
// may import either. Only the read, the memo and the failure reporting are server-side.
export type { ProfileRebellionRecord, RebellionInstance } from "./rebellionRecord";
export { PROFILE_REBELLION_ROWS } from "./rebellionRecord";

/** Cross-request memo of the DERIVED per-MP index. An index with no rebel in it is
 *  indistinguishable from a ledger that came back empty, so it is never memoized —
 *  freezing it for a day would publish a chamber that never broke a club line. */
const indexMemo = createLedgerMemo<RebellionIndex>({ usable: (i) => i.byMp.size > 0 });

/** Test seam: drop the cross-request memo (the money loader's `resetSuppliesMemo`
 *  precedent). Never called by the app. */
export function resetRebellionMemo(): void {
  indexMemo.reset();
}

/**
 * One MP's rebellion instances, newest first. `null` = the ledger could not be read
 * (the section then says so rather than rendering an honest-looking empty record);
 * an MP who never broke the line gets a record with an EMPTY `instances`, which is
 * a real answer.
 *
 * The readiness floors run inside `readLedger()`, i.e. BEFORE anything here can
 * memoize — a half-ingested ledger is never frozen for a TTL window, and both
 * surfaces refuse it at exactly the same point.
 */
export async function getRebellionRecord(pspId: number): Promise<ProfileRebellionRecord | null> {
  try {
    const memoized = indexMemo.read();
    if (memoized !== null) return rebellionRecordFor(memoized, pspId);

    const ledger = await readLedger();
    if (ledger === null) return null;

    const index = deriveRebellionIndex(ledger);
    indexMemo.write(index);
    return rebellionRecordFor(index, pspId);
  } catch (err) {
    reportLoaderFailure("getRebellionRecord", err);
    return null;
  }
}
