---
date: 2026-07-26
slug: loader-test-coverage
status: shipped
branch: "(committed to master)"
commits: [6753f8b, 366e866, 1c035c4, b9684ae, 75798b1]
type: weak-pattern
reach: "7 loaders / 2540 lines with 0 direct tests; 10 of 13 lib/db modules untested"
risk: 1
effort: m
payoff: 4
related_scan: "[[Architect/scans/2026-07-26-data-loading-boundary]]"
---

# Bring the loader chain under test

## Context
`vitest.config.ts:16` includes only `lib/**` and `scripts/**`, so `features/` loaders
never run under vitest — but they are not untestable: `lib/db/pglite/repositories/review.test.ts:15`
already imports `features/money/getVerificationData` across the boundary and asserts the
real queue against a real PGlite temp instance. That escape hatch is used exactly once.
Zero tests cover: any other `get*Data.ts` (rank sort at `getLeaderboardData.ts:266`,
histogram banding `:291-298`), `getStore()`'s cache-race contract (`store.ts:207-219`),
`lib/db/pglite/mappers.ts` (243 lines of row coercion), `graph.ts` (`clubByMandate`),
or the manual constant mirror `getLeaderboardData.ts:37-39` ↔ `lib/analysis/contribution.ts`.

## Decision
Adopt the proven pattern: lib-hosted test files importing feature loaders, seeded via a
temp-dir PGlite (as `review.test.ts` does). Either add `features/**/*.test.ts` to the
vitest include or codify "tests live in lib/, subject may live anywhere". Priority order:
(1) saturation-constant mirror drift test, (2) one loader test per wired surface against
a seeded store, (3) `getStore()` reset semantics, (4) mappers.

## Rollout
1. ✅ 6753f8b — mirror ELIMINATED instead of drift-tested (better than the stub's plan):
   `contribution.ts` now exports the saturation caps and the loader imports them.
2. ✅ 366e866 — `lib/testing/leaderboard-loader.test.ts`: first direct loader test
   against a temp-dir PGlite (null on empty graph; rank/tiebreak; honest "—" club;
   summary/histogram; component decomposition). Suite: 33→34 files, 340→342 tests.
3. ⏳ Remaining: law/money loader tests; `getStore()` reset semantics test (pairs
   with [[2026-07-26-memoised-rejection-open]] — write the test with that fix).

## Acceptance criteria
- [x] A saturation-cap change cannot drift (single source of truth; mirror deleted).
- [x] Each wired surface's loader has at least one direct test — all wired loaders, in
      `lib/testing/loaders.test.ts` (landed by a later session; verified on resume 2026-09-02).

## Refresh + close-out (2026-09-02, `/architect resume`)

Re-measured before executing. The ADR's step 3 (law/money/vote loader tests) had already
been done by a later session: `lib/testing/loaders.test.ts` holds direct tests for every
wired loader (getLawData, getCollisionData, getMoneyData, getMoneyMpDetail,
getVerificationQueue, loadMoneyLayer, getProfileData, graphLoader, getVoteThemes,
getAdminData, and the absorbed leaderboard suite) on ONE PGlite boot. What the ADR still
lacked: a direct test for `lib/db/pglite/mappers.ts` (243 lines, 0 tests) and the
`getStore()` close→reopen lockstep contract (open-retry.test.ts covers only the failed-first-
open path). Found on the way: `lib/testing/leaderboard-loader.test.ts` still existed and
booted a store although loaders.test.ts had absorbed it — the sixth boot that file warns about.
User chose to finish the remainder. Isolation: current branch (overlay default).

### Pre-flight baseline (`npm run check` at 579f759)
tsc 0 · eslint 0 errors / 2 pre-existing warnings outside scope · vitest 3 046 + 211 · rules/census/library/doc-sync green.

### Shipped
4. **1c035c4** — `lib/db/pglite/mappers.test.ts` (17 tests, unit lane): COLS↔mapper parity for
   all ten tables (output keys = camelCase of the bound columns, no more, no less) and total
   coercion (numeric strings, Date/string dates, an invalid `'infinity'` Date, jsonb as
   object/string/garbage/array, Postgres booleans) plus mapMembership's one-warning-per-unknown-kind.
   This commit ALSO carries the deletion of `lib/testing/leaderboard-loader.test.ts`: `git rm` had
   pre-staged it and the one-line `--stat | tail -1` summary hid the second path. The message names
   only the test; the tree is right. Lesson recorded (registry LESSONS): read the stat's file list, not its total.
5. **b9684ae** — `lib/db/store-lockstep.test.ts` (3 tests, PGlite lane): concurrent cold-start callers
   share one promise; close() clears both memos and the next getStore() works; resetStoreCache()
   forgets the wrapper but keeps the connection. `lanes.ts` enlists it and drops the deleted file.
6. **75798b1** — `context-map.json` drops the deleted path (contextMapRefs.test.ts refused the
   dangling ref in the first full gate) and names the two new tests under db-store.

Final gate `npm run check` at 75798b1: tsc 0 · eslint 0 errors (2 pre-existing warnings) ·
vitest 3 063 + 212 · test:rules · census · library · doc-sync. One earlier full run failed on
`lib/testing/archivedScripts.test.ts` timing out at 5 s (a file-tree walk); it passes in 2,2 s
alone and passed in the re-run — contention, noted in the scan note as a near-flake.

## Regression checklist
- [x] Every loader test still passes on one boot — verified by: full vitest in `npm run check` (3 063 + 212).
- [x] Lane partition stays exhaustive/disjoint/ghost-free — verified by: lane-partition.test.ts green after the list edit.
- [x] The context map names no dead file — verified by: contextMapRefs.test.ts green at 75798b1.
- [x] No rendered surface touched — tests, a lane list and a generated map only; nothing to smoke.
