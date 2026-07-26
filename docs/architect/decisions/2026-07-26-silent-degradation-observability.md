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
- [ ] `/graf` loader sites report — deferred to the graph round-4 session.

## Regression checklist
- [x] `npm run check` green at baseline parity (typecheck + lint + 340 tests).
- [ ] Visual pass over wired surfaces — not performed; success-path code untouched
      (changes live exclusively inside catch blocks), so risk is confined to the failure path.
