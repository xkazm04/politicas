# Combined Scan Fix Wave 3 — Money/Graph Data-Integrity Mismatches

> 4 commits, 4 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 352/352 tests → 352/352 tests.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `3d0f6d2` fix(money): resolve person before counting stats in getMoneyData | followthemoney-graph.md #1 | Critical | `features/money/getMoneyData.ts` |
| 2 | `4f03a57` fix(money): num() parses numeric strings instead of silently zeroing them | followthemoney-graph.md #2 | High | `features/money/moneyLoader.ts`, `features/money/getVerificationData.ts` |
| 3 | `b2c6a4b` fix(ingest): stop mapping v.o.s./k.s./družstvo to the wrong dataor slug | source-adapters.md #1 | Critical | `lib/ingest/sources/dataor.ts` |
| 4 | `4d271ad` fix(admin): stop fabricating a "steward" tie-class for unresolved companies | admin-console.md #1 | High | `features/admin/getAdminData.ts` |

## What was fixed (grouped by sub-pattern)

1. **Two independent "drop if unresolved" gates diverging on the same edge set (getMoneyData.ts)** — the stats loop counted an edge into `pendingTies`/`companiesLinked`/`contractCzkReachable` as soon as its company resolved, while a separate later loop silently dropped the whole MP (and its ties) if the person side failed to resolve. An edge that failed only the second gate was counted in the aggregate tiles but invisible in the visible ledger rows. Both checks now happen in the same pass, so an edge either counts everywhere or nowhere.

2. **Silent zero-coercion instead of parsing (num() in moneyLoader.ts + duplicate in getVerificationData.ts)** — a jsonb amount prop stored as a numeric string was treated identically to a genuinely absent value, undercounting reachable money with no error trail. Both copies of `num()` now attempt a real parse and only default to 0 (with a warn) when the value truly can't be interpreted as a number.

3. **A confidently-wrong dataset guess masquerading as an honest "not found" (dataor.ts)** — three distinct Czech legal forms were all mapped to the s.r.o. dataset slug, so the ARES VR corroboration lookup queried the wrong CKAN dataset for those companies and got back an indistinguishable "not found" instead of a signal that the guess itself was wrong. Removed the wrong mapping so the resolver falls through to the (more honest) name-heuristic path instead.

4. **A monitoring dashboard reimplementing a "never guess" pipeline with a guess (getAdminData.ts)** — the real review console explicitly drops an edge whose company fails to resolve; the admin mirror of that same pipeline instead invented a `"steward"` classification for it, letting the admin dashboard's totals silently diverge from the queue it exists to monitor. Now drops unresolved-company edges from every count, exactly matching the real console's contract.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 352/352 (36 files) | 352/352 (36 files) |
| Lint (pre-commit hook) | — | clean on every commit |

## Cumulative status (across all waves so far)

- **Wave 1**: 5 findings closed — Theme A, Review-Gate Race Conditions & Data Trust.
- **Wave 2**: 9 findings closed — Theme B, Silent Numeric Failures.
- **Wave 3 (this wave)**: 4 findings closed (2 Critical, 2 High) — Theme C, Money/Graph Data-Integrity Mismatches.
- **Running total**: 18/125 findings closed.
- Remaining: 107 findings across themes D–J (see INDEX.md).

## Patterns established (additions to the catalogue, items 7-9)

7. **A stats-aggregation pass and a rows-that-get-shown pass must share one resolution gate, not two** — this is the third instance of the exact shape from Wave 1's review-race pattern applied to read-path aggregation instead of write-path concurrency: whenever a page computes both a summary number and a detailed list from the same underlying collection, any filter/resolution step must run once, before either is built, or the two will drift apart the moment real-world data has partial failures.
8. **A codelist mapping "unknown → nearest known bucket" is a confident wrong answer, not a fallback** — dataor.ts's original `"111"/"117"/"205" → "sro"` mapping and Wave 1's `mapMembership`'s `kind → "member"` default are the same anti-pattern: defaulting an unrecognized/unverified value into the most common valid bucket instead of an explicit "unresolved" state makes drift indistinguishable from a real negative result.
9. **A mirrored/derived dashboard must copy the SOURCE pipeline's failure-handling contract, not just its happy path** — getAdminData.ts reimplemented the review-tie pipeline for a monitoring view but re-derived its own (wrong) unresolved-edge handling instead of importing/matching the real console's explicit "drop, never guess" rule. Any second implementation of a pipeline for a different surface (dashboard, export, admin mirror) needs the same audit as the original for edge-case handling, not just for the shape of the happy-path output.

## What remains

Themes D (ingestion & backend robustness beyond dataor.ts), E (lint-rule false negatives), F–J (UI polish, graph/canvas robustness, shared primitives, legislative-data correctness, test coverage) are all still open — see `INDEX.md` for the full per-theme breakdown.
