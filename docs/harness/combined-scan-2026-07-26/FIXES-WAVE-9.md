# Combined Scan Fix Wave 9 — Graph, Dashboard, VoteTrack, BudgetMirror

> 8 commits, 10 findings closed.
> Baseline preserved: 0 TS errors → 0 TS errors, 356→404 tests (external work added 48 in parallel) → 404/404, `eslint .` clean throughout.

## Commits

| # | Commit | Findings closed | Severity | Files |
|---|---|---|---|---|
| 1 | `0e52046` fix(graph): don't permanently memoize a transient graph-loader failure | graph-playground.md #2 | High | `features/graph/graphLoader.ts` |
| 2 | `92672d7` fix(graph): re-fit the view on fullscreen toggle | graph-playground.md #1 | High | `features/graph/components/GraphStage.tsx` |
| 3 | `01f8363` fix(graph): clean up NodeSearch's debounce timer and in-flight request on unmount | graph-playground.md #3 | Medium | `features/graph/components/NodeSearch.tsx` |
| 4 | `2cf39b3` fix(dashboard): resolve contradictory empty-state and global-row dimming in GraphFeedPanel | velin-dashboard.md #1, #2 | High×2 | `features/dashboard/components/GraphFeedPanel.tsx` |
| 5 | `2351d8a` fix(dashboard): stop hovering non-interactive feed rows like they're clickable | velin-dashboard.md #5 | Medium | `features/dashboard/components/FeedRow.tsx` |
| 6 | `5bfb430` fix(votetrack): excused-vote segment now has real contrast against its own track | votetrack.md #1 (ChamberDetail half) | High | `features/votetrack/components/ChamberDetail.tsx` |
| 7 | `3c6072a` fix(votetrack): guard VoteHemicycle against WEDGE_ORDER/PARTIES drift | votetrack.md #1 (Hemicycle half), #2 | High×2 | `features/votetrack/VoteHemicycle.tsx` |
| 8 | `86c55b6` fix(budget): decouple chart data-keys from translated copy; derive bar maxima from data | budgetmirror.md #1, #2 | High×2 | `features/budget/BudgetMirrorPage.tsx` |

## What was fixed (grouped by sub-pattern)

1. **Permanently memoized failures (graph #2)** — three module-level singleton promises cached a caught error identically to a genuinely empty dataset, permanently disabling the Graph Playground after any cold-start hiccup. Each catch block now resets its memo slot and logs, so the next call retries.

2. **Stale view state across a viewport-size jump (graph #1)** — fullscreen toggle resized the canvas but never re-triggered the pan/zoom fit calculation. `isFull` now sits in the fit-effect's dependency array alongside `fitKey`.

3. **Unmount leaks (graph #3)** — the fourth instance this campaign has fixed of a timer/request surviving component unmount (following Wave 1's review-console pattern in spirit). Standard cleanup added.

4. **Contradictory UI states from an incomplete filter predicate (dashboard #1, #2; votetrack #1 Hemicycle contrast is a sibling issue, not this pattern)** — GraphFeedPanel showed "no matches" text *and* a full dimmed list simultaneously (a real, reachable case, not theoretical), and separately dimmed "always relevant" global rows identically to genuinely filtered-out ones. Both predicates now account for the case they were missing.

5. **Zero-contrast color reuse (votetrack #1)** — the structural `hairline` grid-line color was reused as the semantic "excused vote" color, painting that segment directly over its own identically-colored track in two components (bar + hemicycle). Introduced `steel` as the distinct excused-vote color across both.

6. **A hand-maintained parallel list with no drift guard (votetrack #2)** — `WEDGE_ORDER`'s code set could silently diverge from `PARTIES`'s, misaligning every seat after a gap with no error. Deliberately NOT derived from `PARTIES` (it encodes an intentional seating order, not declaration order) — instead guarded with a dev-time assertion comparing the two code sets, plus a `votes.length === SEATS.length` sanity check.

7. **Translated copy used as data-shape identity (budget #1)** — the same anti-pattern from Wave 7's ScoreBreakdown fix, recurring in a different chart: object keys and Recharts `dataKey`s were the translated series labels, risking a silent series collapse if two locale strings ever matched. Rekeyed by stable identifiers, labels passed via `name`.

8. **Hardcoded visualization ceilings with no data derivation (budget #2)** — three independent magic-number maxima (one duplicated a second time inline in a table) would silently saturate comparison bars at 100% once real data grew past them. Derived once from `TOWNS` with headroom, shared everywhere.

## Deferred within this wave

- **graph-playground.md #4, #5** (Medium/UI — NodeSearch keyboard scroll/`aria-activedescendant`, VariantTrasy panel-chrome duplication) — UI polish, lower urgency than the functional bugs prioritized this wave.
- **velin-dashboard.md #3** (crosshair always jumps to `nodeIds[0]`) — needs either a multi-node pin architecture or a `primaryRef` data-schema addition; both are larger scope than a quick fix. **velin-dashboard.md #4** (keyboard focus indicator on canvas nodes) — UI polish, deferred.
- **votetrack.md #3, #4, #5** (false-100%-loyalty edge case, theme-filter truncation disclosure, hardcoded sample-size footnote) — Medium, not exercised by current mock data; deferred to a polish wave.
- **budgetmirror.md #3, #4, #5** (deficit-bar color coding, keyboard access on peer-table rows, missing chart legend) — Medium/Low UI polish, deferred.

## Verification table (before/after counters)

| Check | Before wave | After wave |
|---|---|---|
| TypeScript errors | 0 | 0 |
| Tests passing | 356/356 (37 files) | 404/404 (38 files) — the +48/+1 came from unrelated work landing in parallel in this repo during the wave, not from this wave's fixes |
| `npx eslint .` (full repo) | clean | clean after every commit |

Note: one test run mid-wave hit a PGlite boot-contention timeout (`scripts/case-loops/apply-batch.test.ts`), a known flake documented in vitest.config.ts's own comment about parallel PGlite WASM boots contending under load — confirmed via `--no-file-parallelism` re-run (all green) and unrelated to any change in this wave (a pure-React canvas component).

## Cumulative status (across all waves so far)

- **Waves 1-8**: 42/125 findings closed (41 full + 1 partial), 1 verified false-positive.
- **Wave 9 (this wave)**: 10 findings closed.
- **Running total**: 52/125 findings closed (51 full + 1 partial), 1 verified false-positive.
- Remaining: ~69 findings across themes F (remainder)–J.

## Patterns established (additions to the catalogue, items 17-18)

17. **A filter/dim predicate needs to enumerate every distinct row category, not just "matches" vs. "doesn't match"** — GraphFeedPanel's dim logic and the empty-state banner both assumed a two-way split (relevant/irrelevant) when the data actually has three categories (matches the pin, doesn't match, has no nodes to match against at all). Any predicate built on `.includes()`/`.filter()` against an array that can legitimately be empty needs an explicit branch for the empty case, not an implicit one that happens to evaluate falsy.
18. **A structural/chrome color and a semantic status color must never be the same token** — this is the second occurrence of exactly this shape in one scan (VoteTrack's `hairline`-as-excused-color here; nothing analogous flagged in earlier waves but worth watching for going forward) — reusing a "neutral background/grid" token as a "this specific status" color guarantees zero contrast the moment that status renders over its own track/background.

## What remains

Theme F (remainder — CivicScore polish, remaining VoteTrack/BudgetMirror items), G (remainder — NodeSearch a11y, VariantTrasy consistency), H (shared primitives & bootstrap remainder), I (remainder), J (test/tooling coverage) are all still open — see `INDEX.md` for the full per-theme breakdown.
