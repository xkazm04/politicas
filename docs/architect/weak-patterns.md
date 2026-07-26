# Weak Patterns

Anti-patterns identified by `/architect`, with reach data. Each entry should
eventually convert into a backlog decision (or get explicitly accepted as
"tolerable for now" with a reason).

## Patterns

## Silent `catch { return null }` in loaders
- First seen: 2026-07-26 / Last seen: 2026-07-26
- Reach: 16 sites in 12 loader files; 0 log/Sentry calls on any primary failure path
- Reach trend: growing (each new loader copies the shape)
- Backlog item: [[decisions/2026-07-26-silent-degradation-observability]]
- Examples: `features/money/getMoneyData.ts:198`, `features/civicscore/getLeaderboardData.ts:312`, `features/graph/graphLoader.ts:118`

## Scattered null→fallback UX contract
- First seen: 2026-07-26
- Reach: 5 idioms across 16 pages; 6 client components import mock values alongside real data
- Reach trend: stable
- Backlog item: [[decisions/2026-07-26-fallback-state-contract]]
- Examples: `features/money/FollowTheMoneyPage.tsx:64-88` (unlabelled mock), `features/money/MpCaseFilePage.tsx:50-53` (false claim on DB failure), `features/votetrack/VoteTrackPage.tsx:98` (silent hide)

## Memoised rejection / permanent null caches
- First seen: 2026-07-26
- Reach: `lib/db/pglite/internals.ts:27-39` + 3 memo promises in `features/graph/graphLoader.ts`
- Backlog item: [[decisions/2026-07-26-memoised-rejection-open]]

## Assertion-based union widening of kg props
- First seen: 2026-07-26
- Reach: 6 closed-union casts, ~47 widenings
- Backlog item: [[decisions/2026-07-26-props-union-narrowing]]
- Examples: `features/lawwatch/getCollisionData.ts:275`, `features/money/getMoneyData.ts:70`, `features/graph/graphLoader.ts:542`

## Triple-mapped money tie
- First seen: 2026-07-26
- Reach: 3 loaders, ~75 duplicated lines, `ReviewState` ×2 / `Corroboration` ×3
- Backlog item: [[decisions/2026-07-26-money-tie-mapper-dedup]]

## Untested loader seam
- First seen: 2026-07-26
- Reach: 7 loaders / 2540 lines, 10 of 13 lib/db modules; no cardinality guard
- Backlog item: [[decisions/2026-07-26-loader-test-coverage]] + [[decisions/2026-07-26-ingest-readiness-guard]]

## Prose-enforced server boundary
- First seen: 2026-07-26
- Reach: 7 header comments (misattributing the guard to `store.ts`), no `server-only` package, 4 loaders exporting client-imported types
- Backlog item: [[decisions/2026-07-26-server-only-boundary-enforcement]]
