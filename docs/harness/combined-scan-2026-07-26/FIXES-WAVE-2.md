# Combined Scan Fix Wave 2 — Silent Numeric Failures

> 5 commits, 9 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 352/352 tests → 352/352 tests.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `8859d28` fix(format): guard against non-finite input and malformed dates; drop Intl for numbers | i18n-number-formatting.md #1-#5 | Critical, High×2, Medium×2 | `lib/format.ts` |
| 2 | `5b12ea1` fix(shared): guard AnimatedScore and RankDelta against non-finite values | shared-display-primitives.md #1, #3 | High, Medium | `features/shared/components/AnimatedScore.tsx`, `RankDelta.tsx` |
| 3 | `858a353` fix(civic): stop leaderboard fallback from crashing at import time | sample-data-fallback.md #1, #5 | Critical, Medium | `lib/civic/leaderboard.ts` |
| 4 | `e962e20` fix(civicscore): clamp participation/attendance component points to [0,1] | civicscore-leaderboard.md #1 | High | `features/civicscore/getLeaderboardData.ts` |

## What was fixed (grouped by sub-pattern)

1. **The formatting layer itself (lib/format.ts)** — every numeric formatter (`czech`, `czechInt`, `formatDecimal`, `formatInt`, `formatCzk`) passed its input straight to `toFixed`/`toLocaleString` with no validation, so a `NaN`/`Infinity` from anywhere upstream rendered as the literal string "NaN"/"Infinity" on a transparency site. Added a shared `Number.isFinite` guard returning a "—" placeholder. While in the file, also replaced `toLocaleString`-based grouping with a deterministic manual digit-grouper (closing a documented-but-unapplied SSR/CSR hydration-mismatch risk and a decimal/integer grouping inconsistency), and hardened the date parsers against timestamp-suffixed or malformed input.

2. **Consumers that trusted a `number` prop without checking it (AnimatedScore, RankDelta)** — even with the formatter now guarded, an animation driven toward `NaN` or a delta rendered through the wrong sign branch each had their own failure mode independent of formatting. AnimatedScore now holds its last good value instead of animating toward a non-finite target; RankDelta now treats a non-finite delta the same as "no data" instead of falling through to a confidently-wrong "declining" claim.

3. **A fallback module that could itself crash (leaderboard.ts)** — the sample-data fallback's whole purpose is to never break the page, but its band-boundary lookup threw a hard `Error` for any rank the hardcoded bands didn't cover, at module-import time. Changed to degrade to the nearest band's edge value. Also fixed a hardcoded-array-length median calculation in the same file while it was open (same root pattern: a derived value that should be computed generically was instead pinned to today's specific data shape).

4. **A real (non-mock) scoring pipeline with an inconsistent clamp (getLeaderboardData.ts)** — four of six contribution components were clamped to [0,1] before weighting; two (participation, attendance) weren't, so a single out-of-range upstream rate could silently violate the "points ≤ weight" invariant every breakdown-bar visualization depends on.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 352/352 (36 files) | 352/352 (36 files) |
| Lint (pre-commit hook) | — | clean on every commit |

## Cumulative status (across all waves so far)

- **Wave 1**: 5 findings closed — Theme A, Review-Gate Race Conditions & Data Trust.
- **Wave 2 (this wave)**: 9 findings closed (2 Critical, 4 High, 3 Medium) — Theme B, Silent Numeric Failures.
- **Running total**: 14/125 findings closed.
- Remaining: 111 findings across themes C–J (see INDEX.md).

## Patterns established (additions to the catalogue, items 4-6)

4. **Guard once at the chokepoint, then again at every unusual caller** — fixing `format.ts` to never render "NaN" closes the *display* half of the bug everywhere it's called, but callers that do their own math before formatting (an animation loop, a sign-branch on a delta) can still fail in their own way even when the eventual `format()` call is safe. Both layers need the guard; neither substitutes for the other.
5. **A "never break the page" fallback module needs the same defensive posture as the thing it's a fallback FOR** — code whose entire purpose is graceful degradation is not automatically graceful; if it has its own hard-throw/hardcoded-assumption failure modes, a data-authoring mistake in the fallback's own fixtures can take down the primary path's safety net at exactly the moment the primary path has already failed.
6. **Clamps applied to "most" of a parallel set of derived values are a smell** — when N of M structurally-identical calculations get a bound check and the rest don't, treat the unguarded ones as latent bugs, not stylistic variance; the CivicScore case (4/6 components clamped) is a second instance of this pattern after Wave 1's PGlite mapper findings.

## What remains

Themes C (money/graph data-integrity mismatches beyond the review gate), D (ingestion & backend robustness), E (lint-rule false negatives), F–J (UI polish, graph/canvas robustness, shared primitives, legislative-data correctness, test coverage) are all still open — see `INDEX.md` for the full per-theme breakdown.
