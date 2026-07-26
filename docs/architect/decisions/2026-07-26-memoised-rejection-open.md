---
date: 2026-07-26
slug: memoised-rejection-open
status: shipped
branch: "(committed to master)"
commits: [45220bb]
type: structural-bug-class
reach: "2 files / 4 permanent-poison memo sites (internals.open + 3 graphLoader promises)"
risk: 2
effort: s
payoff: 4
related_scan: "[[Architect/scans/2026-07-26-data-loading-boundary]]"
---

# A rejected first `open()` poisons the process until restart

## Context
`lib/db/store.ts:207-219` caches the store promise and clears it on rejection
(`store.ts:215`) so the next call retries. But one layer down,
`lib/db/pglite/internals.ts:27-39` memoises the PGlite instance on `globalThis` with
**no** rejection reset — a transient cold-start failure (locked data dir, WASM load
error) leaves a rejected promise cached forever; `store.ts`'s retry re-enters `open()`
and gets the same rejection. The upper reset is dead code for exactly the case it was
written for. Same bug shape re-introduced in `features/graph/graphLoader.ts`:
`indexPromise` (`:123`), `mapPromise` (`:185`), `trailsPromise` (`:265`) memoise `null`
results permanently, so a five-second DB lock poisons `/graf` for the process lifetime.

## Decision
Mirror the `store.ts:215` reset in `internals.ts` (`promise.catch(() => delete g[PGLITE_KEY])`)
and make the three graphLoader memos invalidate on null/rejection.

## Rollout
1. ✅ 45220bb — `internals.ts` deletes the globalThis memo on rejection (guarded:
   only if it still holds the failed attempt) + `lib/db/pglite/open-retry.test.ts`
   inducing a real failed open (PGLITE_PATH under a plain file), asserting the memo
   clears and a retry succeeds. `npm run check` green (35 files / 344 tests).
2. ⏳ `graphLoader` null-memo invalidation — deferred: in-flight round-4 session.
   The upstream fix removes the sharpest case (a cached *rejection*); graphLoader
   still memoises a `null` result permanently.

## Acceptance criteria
- [x] After a failed first open, a subsequent call re-attempts and can succeed (tested).
- [ ] A null graph seed is not served from cache once the store becomes available —
      deferred with graphLoader.
