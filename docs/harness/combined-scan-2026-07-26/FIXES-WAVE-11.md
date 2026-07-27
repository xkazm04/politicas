# Combined Scan Fix Wave 11 — LawWatch, VoteTrack, BudgetMirror Mop-Up

> 4 commits, 4 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 405→406 tests (added 1) → 406/406, `eslint .` clean throughout.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `c509242` fix(lawwatch): dedupe getLawData() across generateMetadata and the page component | lawwatch.md #2 | Medium | `features/lawwatch/getLawData.ts` |
| 2 | `6c13dcf` fix(lawwatch): compute filter badge counts against the OTHER active filter | lawwatch.md #3 | Medium | `features/lawwatch/components/BillBrowser.tsx` |
| 3 | `5bbaaf0` fix(votetrack): partyLine/partyDiscipline report null instead of fabricated 100% loyalty | votetrack.md #3 | Medium | `lib/civic/votes.ts`, `lib/civic/data.test.ts`, `features/votetrack/components/ChamberDetail.tsx`, `DisciplineBoard.tsx` |
| 4 | `0c53860` fix(budget): color the town metric bar to match its number's deficit signal | budgetmirror.md #3 | Medium | `features/budget/BudgetMirrorPage.tsx` |

## What was fixed (grouped by sub-pattern)

1. **Un-deduplicated per-request loader calls (lawwatch #2)** — the same shape as several loaders across the campaign, wrapped in `React.cache()` so `generateMetadata` and the page component share one connection attempt instead of racing two on a documented single-connection PGlite.

2. **Filter badges computed against the wrong subset (lawwatch #3)** — the fourth occurrence of the "predicate doesn't account for the other active filter/category" pattern this campaign keeps finding (Wave 9's GraphFeedPanel dimming, Wave 9's BudgetMirror bar maxima). Facet and origin badge counts now cross-reference each other's active selection.

3. **A safety sentinel that fabricated a false-positive result (votetrack #3)** — `present === 0 → return 1` (100% loyal) is the same shape as Wave 2's leaderboard `1.0` discipline default and Wave 1's PGlite mapper "unknown → most common bucket" pattern: a convenience default standing in for a genuine "no data" state. Both `partyLine` and `partyDiscipline` now return `null`, with both consuming components rendering an explicit neutral state instead of a colored, confident-looking fabrication.

4. **Bar visualization stripping the sign its own number displays (budgetmirror #3)** — closing out the BudgetMirrorPage findings started in Wave 9: the deficit/surplus bar used `Math.abs()` for width but never conditionally colored for a negative value, unlike the number right above it.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 405/405 (39 files) | 406/406 (39 files) |
| `npx eslint .` (full repo) | clean | clean after every commit |

## Cumulative status — campaign totals

- **Waves 1-10**: 58/125 findings closed (57 full + 1 partial), 1 verified false-positive.
- **Wave 11 (this wave)**: 4 findings closed.
- **Running total**: 62/125 findings closed (61 full + 1 partial), 1 verified false-positive — **~50% of the scan closed.**
- Remaining: ~59 findings, overwhelmingly Medium/Low UI polish (keyboard accessibility on interactive elements, chart legends, design-system standardization, i18n copy gaps) and test-coverage-gap items in the leaderboard-loader test — no known remaining Critical findings, and only a small number of un-triaged Highs (mp-profile-dossier.md #1's full i18n rewiring; graph-playground.md #4/#5, velin-dashboard.md #3/#4, shared-display-primitives.md #2/#4/#5, and similar UI-polish Highs that were explicitly deferred as larger-scope feature work rather than bug fixes).

## Patterns established (final addition, item 20)

20. **A "convenience default for an edge case" and a "fabricated positive result" are often the same bug wearing different clothes** — across 11 waves, the single most recurring shape in this campaign was some form of "when there's no real data, return the value that happens to be easiest to code" (0 for a subsidy, 1.0 for discipline, "member" for an unknown membership kind, "pro" for a 0-vote tie, "steward" for an unresolved company). Every one of these was originally justified as "avoiding a crash/NaN," and every one of them silently misrepresented absence-of-data as a specific, often maximally-positive, real value. The fix is always the same: return `null` (or an equivalent explicit sentinel) and push the "how do we display unknown" decision to the render layer, where a neutral "—" is honest in a way `0`/`1.0`/a default string never is.

## Session wrap-up

This closes the active portion of the 2026-07-26 combined bug-hunt + UI-perfectionist campaign for this session: 11 waves, 62 of 125 findings closed (roughly half — all Criticals and the large majority of Highs), 0 regressions, TypeScript/tests/lint green after every single commit. All work is on branch `vibeman/combined-bughunt-ui-2026-07-26`, ready to merge.
