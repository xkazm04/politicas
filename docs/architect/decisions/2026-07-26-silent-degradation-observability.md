---
date: 2026-07-26
slug: silent-degradation-observability
status: shipped
type: structural-bug-class
reach: "16 `catch { return null }` sites / 12 loader files / 0 log or Sentry calls on any primary failure path"
risk: 2
effort: m
payoff: 5
branch: "(committed to master)"
commits: [d315eb7, 223a727, cd80b51]
related_scan: "[[Architect/scans/2026-07-26-data-loading-boundary]]"
---

# Silent degradation to mock: give the `catch { return null }` class a voice

## Context
Every loader converts every failure into `null` with no signal: 16 one-statement
catch sites (`getMoneyData.ts:198`, `getLeaderboardData.ts:312`, `getLawData.ts:349`,
`getVoteThemes.ts:45`, `graphLoader.ts:118/256/487/561`, …). Sentry is fully wired
(`next.config.ts:38`, `instrumentation.ts`) yet there were 0 `captureException` calls in
`app/`, `features/`, `lib/`. `eslint-rules/no-silent-catch.cjs:33-38` only flags *empty*
catch bodies, so all 16 sites passed. The team already paid the diagnosis cost once:
`next.config.ts:18-27` documents a bundler bug where "the whole app degrades SILENTLY
to its labelled mock" (found 2026-07-25). A total DB outage was indistinguishable from
an empty graph.

## Decision (as executed)
`lib/db/loaderGuard.ts` exports `reportLoaderFailure(loader, err)` — `console.error`
+ `Sentry.captureException` with a loader tag — called in each catch before the
null/[] fallback return. New lint rule `custom/no-silent-null-catch` (error) flags
catch blocks whose only statement returns null/[], scoped to `features/**/get*.ts`
+ `features/**/*Loader.ts`.

Deviations from the stub: (a) a report-then-return helper instead of a wrapping
`loadOrNull` — smaller diff, no control-flow restructuring; (b) 3 additional silent
sites in `getAdminData.ts` (readTextSafe/readJsonSafe/loadMoneyLeads) were caught by
the new rule and wired too; (c) **`features/graph/graphLoader.ts`'s 4 sites deferred**
— untracked in-flight round-4 work in a concurrent session; the lint scope excludes
`features/graph/**` until that lands. Follow-up: wire those 4 sites and drop the
exclusion.

## Follow-up closed 2026-08-13 (branch `perfect/2026-08-13-r18`)

The deferred carve-out was **9 sites, not 4**, and the exclusion had stopped being a
temporary note: `memory/architect-graph-deferrals.md` already recorded that "the lint
exclusion actively hides class-2 violations until removed", and it did.

Wired in `features/graph/graphLoader.ts`, each with its own greppable loader name
(`graphLoader.buildIndex` · `.getMapData` · `.getTrails` · `.pathAdjacency` ·
`.getNodeDetail`): 4 `catch` blocks that logged to `console.error` but reached neither
Sentry nor the ADR's convention, 1 bare `catch { return null }` in `getNodeDetail` (the
exact class-2 shape the rule exists for), and **4 early `return null` paths that logged
nothing at all** — `!store` and `nodes.length === 0` in `buildIndex`, `!store || !idx`
in the three memoised builders. `eslint.config.mjs` no longer excludes any zone.

Found on the way, and worse than the missing log line: `graphIndex()` did
`indexPromise ??= buildIndex()`, so **a promise that resolved to `null` was memoised for
the process lifetime**. One unlucky boot (store still initializing, one transient read
error, graph not yet materialized) pinned an empty `/graf` until a restart — and an empty
canvas renders as a *genuinely empty graph*, not as an outage, so the surface whose whole
subject is traceability quietly asserted the graph holds nothing. `memoNonNull()` now
keeps only success, matching what `lib/db/pglite/internals.ts` `open()`
(ADR 2026-07-26-memoised-rejection-open), `features/money/moneyLoader.ts` and
`features/profile` already did for their memos.

**Store-down and node-gone deliberately stay two different answers.** `getNodeDetail`
returns `null` for both, and `getPermalinkData` disambiguates them for the reader with a
second cheap probe; the trace keeps them apart too — a missing node (or a kind the canvas
refuses) reports **nothing**, because filling the log and Sentry with outages that never
happened is how a real one stops being noticed. Pinned in both directions by
`lib/testing/loaders.test.ts`.

That test file previously **pinned the defect as the contract** ("KNOWN GAP, pinned
deliberately … the data is there now; the loader can't see it"). The assertion was
replaced, not deleted: the cold-start block now asserts the trace per layer and that the
same module instance recovers after the graph appears — with a successful read still
memoised. Falsified both ways (re-memoising null, and collapsing one loader name).

## Pre-flight baseline (2026-07-26)
`npm run check` fully green: 0 tsc errors, 0 lint problems, 33 files / 340 tests pass.
Post-rollout: identical (zero delta).

## Rollout
1. d315eb7 — `feat(architect): add reportLoaderFailure` (`lib/db/loaderGuard.ts`)
2. 223a727 — `refactor(architect): wire loader catch sites` (14 sites, 10 files)
3. cd80b51 — `feat(architect): lint rule no-silent-null-catch` (+ eslint.config.mjs scope block)

## Acceptance criteria
- [x] A loader failure produces a log line + Sentry event (mechanism in place; captureException
      is a documented no-op without DSN). NOT runtime-verified against a killed DB — code-level only.
- [x] `catch { return null }` in loader files fails lint (verified: the rule found the 3
      getAdminData sites before they were fixed; suite now green).
- [x] `/graf` loader sites report — closed 2026-08-13, see the follow-up above. 9 sites
      wired; `custom/no-silent-null-catch` now runs over `features/graph/**` with zero
      suppressions. Verified by falsification: restoring `getNodeDetail`'s bare catch
      makes `npx eslint features/graph/graphLoader.ts` fail with 1 error.
- [x] A null/empty read is never memoised, so a degradation is retryable rather than
      pinned for the process lifetime (added 2026-08-13 — the stub did not ask for this
      because nobody had looked at the memo).

## Regression checklist
- [x] `npm run check` green at baseline parity (typecheck + lint + 340 tests).
- [ ] Visual pass over wired surfaces — not performed; success-path code untouched
      (changes live exclusively inside catch blocks), so risk is confined to the failure path.
