---
date: 2026-07-26
mode: scan
theme: data-loading-boundary
sub_agents_spawned: 4
findings_total: 8
findings_weak: 4
findings_strong: 4
findings_swap: 0
findings_struct_bug: 3
findings_convention_gap: 1
executed: [1, 2, 3, 4, 6, 7, 8]
queued: [5]
commits: [d315eb7, 223a727, cd80b51, 431d147, 4e1f112, a2a70cd, 6753f8b, 366e866, 45220bb, 25a7b65, ca6defc, 8dddf90]
dropped: []
reworked: []
adrs_written: 8
commits: []
branch: "(no execution this run)"
---

# Architect scan — data-loading-boundary (2026-07-26)

First run of the adopted skill. Autonomous defaults applied: scan mode, theme
picked by relevance (the `get*Data.ts` server-loader → client-feature spine is
the codebase's central migration pattern), triage defaulted to queue-all.

## Sub-agent reports (summaries)

- **Usage map** (smell 3/5): 12/16 routes on-pattern, 0 client imports of
  `lib/db`; but 4 fallback idioms, ~17 client components bundle mock values
  (6 inside wired routes), boundary held by prose comments — one misattributing
  the client guard to `store.ts` (it lives in `pglite-store.ts:15`).
- **Type/contract** (smell 3/5): repository layer exemplary (1/5); loader layer
  has the triple-mapped money tie, 6 unsound closed-union casts, two competing
  type-home conventions. `getVoteThemes.ts`+`themeTypes.ts` is canonical.
- **Failure modes** (smell 4/5): 16 `catch { return null }` sites, 0 Sentry
  calls despite full wiring; `open()` memoises rejections forever (defeating
  `store.ts:215`'s reset); no readiness concept — mid-ingest renders as truth;
  mock money stats cite real registries unlabelled; team already bitten
  (`next.config.ts:18-27` confession, 2026-07-25).
- **Test coverage** (smell 4/5): loader chain is an untested seam between
  well-tested pure layers; vitest glob excludes `features/` but the
  cross-boundary escape hatch is proven (`review.test.ts:15`); no cardinality
  guard anywhere; constant-mirror drift pair in `getLeaderboardData.ts:37-39`.

## Findings → all queued (default)

1. Server-only boundary enforcement — [[decisions/2026-07-26-server-only-boundary-enforcement]] 🔶 **in-progress** (431d147, 4e1f112; type extraction blocked on dirty client files)
2. Silent-degradation observability — [[decisions/2026-07-26-silent-degradation-observability]] ✅ **executed** (commits d315eb7, 223a727, cd80b51; graph sites deferred)
3. Props union narrowing — [[decisions/2026-07-26-props-union-narrowing]] ✅ **executed** (a2a70cd; graphLoader's 2 casts deferred)
4. Loader test coverage — [[decisions/2026-07-26-loader-test-coverage]] 🔶 **in-progress** (6753f8b, 366e866; steps 1–2 of 3 done)
5. Fallback-state contract — [[decisions/2026-07-26-fallback-state-contract]]
6. Memoised rejection in open() — [[decisions/2026-07-26-memoised-rejection-open]] ✅ **executed** (45220bb; graphLoader null-memos deferred)
7. Ingest readiness guard — [[decisions/2026-07-26-ingest-readiness-guard]] 🔶 **in-progress** (25a7b65 gate shipped; /admin surfacing remains)
8. Money-tie mapper dedup — [[decisions/2026-07-26-money-tie-mapper-dedup]] ✅ **executed** (8dddf90; ReviewTie left separate by design)

## Strong patterns observed → noted in strong-patterns.md

- Repository layer (interfaces + single mapper + total coercion)
- Detail-route null disambiguation (`DataUnavailable`)
- Canonical loader pair (`getVoteThemes` + `themeTypes`)
- Real-PGlite temp-dir test harness

## Open conflict for a future run

- CLAUDE.md says `lib/civic/leaderboard.ts` "still feeds `/dashboard` chamber
  aggregates"; the type/contract agent found no importer at all (candidate dead
  code, 240 lines). Verify before deleting — /dashboard is being reworked in a
  concurrent session.
