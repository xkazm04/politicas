---
date: 2026-07-26
slug: ingest-readiness-guard
status: in-progress
branch: "(committed to master)"
commits: [25a7b65, ca6defc]
type: structural-bug-class
reach: "7 loaders / 0 feature consumers of ingest_run / 0 cardinality tests"
risk: 2
effort: m
payoff: 4
related_scan: "[[Architect/scans/2026-07-26-data-loading-boundary]]"
---

# Readiness guard: a half-ingested graph must not render as truth

## Context
`new PGlite(pglitePath())` creates a missing data dir and `CORE_DDL` creates empty tables
(`internals.ts:32`), so "no data" looks like a healthy store; loaders only guard total
emptiness (`if (nodes.length === 0) return null`). A mid-ingest store with 120 of 207
MPs renders real-looking numbers with real citations and passes the entire test suite —
the canonical cardinalities (207 MPs / 141 bills / 101 laws / 150 amends / 260 ties)
exist only in prose (`CLAUDE.md:49,61`) and loader comments. The readiness signal
already exists in the schema: `ingest_run.status` (`lib/db/store.ts:80-85`) — with zero
consumers in `features/` or `app/`.

## Decision
(1) A `storeReady()` check consulting `ingest_run` (last run ok + minimum cardinality
floor per node kind), consumed by `getStore()` callers or the loader guard helper from
[[2026-07-26-silent-degradation-observability]]. (2) A vitest cardinality-floor test
against the checked-in expectations so a broken ingest fails CI, with the floors defined
in one exported constant (not prose).

## Rollout
1. ✅ 25a7b65 — `lib/db/readiness.ts`: `CARDINALITY_FLOORS` (~70 % of the 2026-07-24
   ingest, deliberately conservative so live data passes with margin) +
   `storeReady()`, gated into the four public loaders (buildLeaderboard,
   getLawData, moneyLoader, getProfileData) after the `getStore()` null check;
   failures report through `reportLoaderFailure`. Boundary test: empty not ready,
   floor−1 not ready, floor ready. `KG_READINESS_OFF=1` documented test escape.
   getVerificationQueue deliberately NOT gated — the operator console should show
   whatever exists. Gate placed in loaders, not `getStore()` (store.ts dirty with
   concurrent work). Plus ca6defc: 30s vitest timeout (5 parallel PGlite boots contend).
2. ⏳ Surface last-ingest status + readiness on `/admin` (first `listIngestRuns`
   consumer) — deferred, pairs naturally with fallback-state-contract UI work.
3. ⏳ "CI fails when ingest cardinalities regress" — reinterpreted: CI has no live
   data dir, so a live-count assertion can't run there. The floor gate protects the
   rendering path instead; a live-store audit script/admin panel covers the rest.

## Acceptance criteria
- [x] A store below floor refuses to serve real-labelled data on public surfaces (tested at the floor boundary).
- [x] Runtime-verified against the LIVE store 2026-07-26: person 207, company 215,
      bill 141, law 288, contract 2287 — all above floor, `storeReady(all) === true`,
      so the gate cannot mis-fire on current data. (Law count is 288, not the 101 in
      CLAUDE.md prose — the amends regeneration grew it; prose counts drift, floors don't.)
- [ ] Ingest status visible to the operator (/admin) — deferred.
