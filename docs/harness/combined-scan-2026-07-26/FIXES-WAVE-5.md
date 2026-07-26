# Combined Scan Fix Wave 5 — PGlite Backend Robustness

> 4 commits, 4 findings closed, 1 finding verified not applicable.
> Baseline preserved: 0 TS errors → 0 TS errors, 352/352 tests → 352/352 tests.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `4d09019` fix(db): sync store.ts's cache with the connection lifecycle on close() | pglite-store-runtime.md #1 | High | `lib/db/store.ts` |
| 2 | `f4e543d` fix(db): log when KG_READINESS_OFF bypasses the cardinality gate | pglite-store-runtime.md #3 | High | `lib/db/readiness.ts` |
| 3 | `76d561c` fix(db): wrap chunked upserts in a transaction so a mid-loop failure rolls back | pglite-repositories.md #2 | High | `lib/db/pglite/internals.ts`, `lib/db/pglite/repositories/kg.ts` |

## What was fixed (grouped by sub-pattern)

1. **Two independent connection-lifecycle caches (store.ts + pglite/internals.ts)** — `Store.close()` reset the low-level `PGLITE_KEY` memo but never touched `store.ts`'s own module-level `cached` promise. A caller that did `getStore() → close() → getStore()` in one process got back the SAME already-resolved `Store` object whose methods closed over a now-closed connection, failing every call with no clue why. `getStore()` now wraps the returned store's `close()` to clear its own cache first.

2. **A safety-net bypass with zero observability (readiness.ts)** — `storeReady()`'s failure path already logs + fires Sentry, but the `KG_READINESS_OFF=1` bypass that disables the entire gate left no trace at all — the one state that should be most observable was the only one with none. Now logs a distinctive warning once per process the first time the bypass fires.

3. **Chunked writes with no transaction (internals.ts, kg.ts)** — `upsertMany()` and the duplicated `upsertKgEdges()` split large writes into ≤500-row chunks (a deliberate width cap for a known PGlite quirk) but issued each chunk as an independent, auto-committed statement. A mid-loop failure left earlier chunks committed and later ones missing with no rollback. Both now run their full chunk loop inside `pg.transaction()`.

## Investigated and found not applicable

**pglite-repositories.md finding #3** (timezone bug in `isoDate`) hypothesized that if PGlite's driver constructs date-only columns as local-midnight `Date` objects, `toISOString().slice(0,10)` would render the wrong calendar day in a non-UTC process timezone. Empirically tested this session: with `TZ=Europe/Prague` (UTC+2), inserting `"2026-07-14"` into a `date` column and reading it back produces a `Date` whose `toISOString()` is `2026-07-14T00:00:00.000Z` — i.e. PGlite/pg-protocol already constructs actual UTC-midnight `Date`s, not local-midnight ones. The existing `isoDate` implementation is correct as written; no change made. Documented here rather than silently dropped, per the "don't fix what isn't broken" discipline — a plausible-sounding scan finding that doesn't survive direct verification against the actual driver behavior.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 352/352 (36 files) | 352/352 (36 files) |
| Lint (pre-commit hook) | — | clean on every commit |

## Cumulative status (across all waves so far)

- **Wave 1**: 5 findings closed — Theme A, Review-Gate Race Conditions & Data Trust.
- **Wave 2**: 9 findings closed — Theme B, Silent Numeric Failures.
- **Wave 3**: 4 findings closed — Theme C, Money/Graph Data-Integrity Mismatches.
- **Wave 4**: 5 findings closed — Theme D (part 1), Ingestion Normalization Hardening.
- **Wave 5 (this wave)**: 3 findings closed (3 High) + 1 verified-not-applicable — Theme D (part 2), PGlite Backend Robustness.
- **Running total**: 26/125 findings closed, 1 verified false-positive.
- Deferred (Medium/Low, lower urgency): pglite-store-runtime.md #2 (ingest_run.status check — architectural, needs a companion design decision), #4 (path-keyed connection cache — test-isolation risk, not a live bug), #5 (readiness log throttling); pglite-repositories.md #4 (mapMembership silent coercion), #5 (term-scoped query silent-empty ambiguity).
- Remaining: ~96 findings across themes E–J (see INDEX.md).

## Patterns established (additions to the catalogue, items 12-13)

12. **Verify a speculative finding against the actual runtime before "fixing" it** — the timezone finding was well-reasoned but wrong about this specific driver's actual behavior. A 10-line empirical script (insert known date, read back, inspect components) settled it definitively where code-reading alone would have left ambiguity. Not every plausible-sounding failure mode is real; cheap to check, expensive to "fix" a non-bug and add unnecessary code.
13. **Two caches over the same resource must be reset by the same event, or wrapped so one call clears both** — this is the general form of Wave 1's transaction-race pattern applied to lifecycle state instead of concurrent writes: `close()` only reset one of two caches tracking the same connection's lifetime. Whenever a resource has more than one memoization layer (a low-level connection memo + a higher-level "resolved value" cache), audit that every teardown path resets every layer.

## What remains

Theme E (lint-rule false negatives), F–J (UI polish, graph/canvas robustness, shared primitives, legislative-data correctness, test coverage) are all still open — see `INDEX.md` for the full per-theme breakdown.
