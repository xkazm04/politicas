# Combined Scan Fix Wave 10 — Ingestion, Admin, DB, and Test-Boundary Coverage

> 6 commits, 6 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 404→405 tests (added 1) → 405/405, `eslint .` clean throughout.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `9c45f87` fix(ingest): compare actual hostname, not a substring, for psp.cz release filter | source-adapters.md #2 | High | `lib/ingest/sources/pumper.ts` |
| 2 | `2731cca` fix(ingest): actually log the kiosek composite dedup-key fallback | source-adapters.md #3 | High | `lib/ingest/sources/kiosek.ts` |
| 3 | `1315244` fix(admin): sort forensic verdicts by full severity rank, not just high/non-high | admin-console.md #2 | Medium | `features/admin/getAdminData.ts` |
| 4 | `34e2b2c` fix(db): warn on unrecognized membership.kind instead of silently absorbing it | pglite-repositories.md #4 | Medium | `lib/db/pglite/mappers.ts` |
| 5 | `e73970e` fix(db): warn when a term-scoped query's termCode resolves to nothing | pglite-repositories.md #5 | Medium | `lib/db/pglite/repositories/votes.ts`, `graph.ts` |
| 6 | `9088c8b` test: add static check that no client component reaches a server-only module | test-utilities-loader-coverage.md #1 | High | `lib/testing/server-boundary.test.ts` |

## What was fixed (grouped by sub-pattern)

1. **Substring match standing in for a real comparison (source-adapters #2)** — a provenance-poisoning guard documented as "only records on the psp.cz host" actually did `url.includes("psp.cz")`, passing any URL that merely contains that substring anywhere (a redirect param, a lookalike domain). Replaced with real hostname parsing.

2. **A comment asserting observability the code doesn't have (source-adapters #3)** — a dedup-key fallback was documented as "logged, not hidden" with zero actual logging call anywhere. Added the `console.warn` the comment already claimed existed.

3. **A binary partition standing in for a full ranking (admin-console #2)** — same shape as several earlier waves' findings: a comparator that only guarantees one category floats to the top, leaving the rest in arbitrary relative order. Full severity-rank comparator now used.

4. **Silent value-narrowing with no observability (pglite-repositories #4)** — the third occurrence of this exact pattern in the campaign (Wave 1's `mapMembership` finding was actually this same file; this wave closes it): an unrecognized enum-shaped value silently narrows to the majority bucket. Added deduped warning logging.

5. **Ambiguous "empty vs. wrong" query results (pglite-repositories #5)** — a term-scoped query can't distinguish "this term legitimately has zero rows" from "this term code doesn't exist at all"; both render as an empty array. Added a cheap existence check on the empty-result path only.

6. **A test-suite-wide alias masking a real safety gate (test-utilities-loader-coverage #1)** — the `server-only` vitest alias makes a genuine client/server boundary violation invisible to `npm test`, only surfacing at `next build` time or in production. Added a static dependency-graph check (via the TypeScript compiler API, correctly excluding type-only imports and stopping at `"use server"` Server Action boundaries — two categories of false positive the first draft of this check surfaced before they were excluded) that would have caught this exact class of regression.

## Deferred within this wave

- **source-adapters.md #4, #5** (Medium — malformed-record silent truncation, `fetchWithThrottle` all-or-nothing failure) — real findings, but each needs a small API-shape change (a `truncated` flag; a discriminated per-URL result) that would ripple to callers; deferred to a dedicated ingestion-robustness pass.
- **admin-console.md #3, #4, #5** (Medium/UI — unbounded audit badges, raw-ISO timestamp, no loading state) — polish, deferred.
- **pglite-store-runtime.md #2** (ingest_run.status check) remains deferred from Wave 5 — needs a companion architectural decision, not a quick fix.
- **test-utilities-loader-coverage.md #2-#5** (test-coverage gaps in the leaderboard-loader test itself: no club/region seed data, weak `Number.isFinite`-only assertions, untested failure path, unrestored `process.env` mutations) — real gaps, but each is a test-authoring task better done as its own focused pass rather than folded into a fix-wave; flagged here for a future test-hardening session.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 404/404 (38 files) | 405/405 (39 files) |
| `npx eslint .` (full repo) | clean | clean after every commit |

## Cumulative status (across all waves so far)

- **Waves 1-9**: 52/125 findings closed (51 full + 1 partial), 1 verified false-positive.
- **Wave 10 (this wave)**: 6 findings closed (2 High, 3 Medium, 1 High-test).
- **Running total**: 58/125 findings closed (57 full + 1 partial), 1 verified false-positive.
- Remaining: ~63 findings, predominantly Medium/Low UI polish and test-coverage-gap items across most already-partially-addressed files.

## Patterns established (additions to the catalogue, item 19)

19. **A comment describing behavior ("logged", "checked", "validated") is a claim, not a guarantee — verify the code actually does it** — this is now the third finding across the whole campaign (source-adapters #3 here; Wave 6's ESLint rule docstrings; the `isTrendTooEarly`/tenure gate framing in Wave 8) where a comment asserted a safety property the implementation didn't actually have. When reviewing code, treat any comment using a passive-voice safety claim ("is logged", "is validated", "is enforced") as a thing to go verify against the actual statements below it, not as evidence the property holds.

## What remains

Themes F-J's remaining Medium/Low findings (UI polish, deficit-bar coloring, keyboard access, chart legends, malformed-record diagnostics, test-coverage gaps in the leaderboard loader test) are documented per-file in `INDEX.md` and this wave's "Deferred" section above.
