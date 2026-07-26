# Architect Backlog

Durable queue of architectural decisions. Sorted by `(reach × payoff) / (risk × effort)`.
Status values: `proposed | approved | in-progress | shipped | abandoned | blocked`.

## Pending

- **[2026-07-26] Enforce the server-only loader boundary mechanically** — type: convention-gap, risk: 1, effort: s, payoff: 3, reach: 7 loader headers / 4 type-leaking loaders / 0 lint rules
  ADR: [[decisions/2026-07-26-server-only-boundary-enforcement]] · Scan: [[scans/2026-07-26-data-loading-boundary]] · Status: in-progress (commits 431d147, 4e1f112 shipped; type extraction blocked: working-tree-conflict — client pages dirty from a concurrent session)
- **[2026-07-26] Bring the loader chain under test** — type: weak-pattern, risk: 1, effort: m, payoff: 4, reach: 7 loaders / 2540 lines / 0 direct tests
  ADR: [[decisions/2026-07-26-loader-test-coverage]] · Scan: [[scans/2026-07-26-data-loading-boundary]] · Status: in-progress (6753f8b constant mirror eliminated, 366e866 leaderboard loader test; law/money/vote loader tests + getStore reset test remain)
- **[2026-07-26] One fallback-state contract (labelled mock / honest empty / DataUnavailable)** — type: weak-pattern, risk: 3, effort: l, payoff: 5, reach: 16 pages / 5 idioms / 6 mock-welded components
  ADR: [[decisions/2026-07-26-fallback-state-contract]] · Scan: [[scans/2026-07-26-data-loading-boundary]] · Status: proposed
  Notes: contains the highest-severity brand item — fabricated 2,1 mld Kč cited to the real contracts registry with no sample banner (`FollowTheMoneyPage.tsx:66-71`).
- **[2026-07-26] Ingest readiness guard + cardinality-floor test** — type: structural-bug-class, risk: 2, effort: m, payoff: 4, reach: 7 loaders / 0 ingest_run consumers / 0 cardinality tests
  ADR: [[decisions/2026-07-26-ingest-readiness-guard]] · Scan: [[scans/2026-07-26-data-loading-boundary]] · Status: in-progress (25a7b65 gate + floors + test shipped; /admin ingest-status surfacing remains)

## Shipped

- **[2026-07-26] One mapper for the money tie** — shipped same day (commit 8dddf90, live-verified)
  ADR: [[decisions/2026-07-26-money-tie-mapper-dedup]] · `mapLinkedToTie()` owns the projection; ReviewTie deliberately left as a separate projection (rationale in the ADR).

- **[2026-07-26] Rejected first `open()` poisons the process** — shipped same day (commit 45220bb, with regression test)
  ADR: [[decisions/2026-07-26-memoised-rejection-open]] · graphLoader null-memo invalidation deferred to the round-4 session.

- **[2026-07-26] Narrow `kg_*.props` by guard, never by `as`** — shipped same day (commit a2a70cd)
  ADR: [[decisions/2026-07-26-props-union-narrowing]] · 4 of 6 casts fixed via `asUnion()`; graphLoader's 2 deferred to the round-4 session.

- **[2026-07-26] Silent degradation to mock — observability for `catch { return null }`** — shipped same day (commits d315eb7, 223a727, cd80b51)
  ADR: [[decisions/2026-07-26-silent-degradation-observability]] · 14 sites wired + lint rule; `features/graph` (4 sites) deferred to the concurrent round-4 session.

## Abandoned / Blocked
_None yet._
