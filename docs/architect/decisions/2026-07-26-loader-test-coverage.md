---
date: 2026-07-26
slug: loader-test-coverage
status: in-progress
branch: "(committed to master)"
commits: [6753f8b, 366e866]
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
- [ ] Each wired surface's loader has at least one direct test (1 of 4 done: zebricek;
      zakony/penize/hlasovani remain).
