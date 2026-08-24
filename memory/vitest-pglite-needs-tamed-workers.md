---
name: vitest-pglite-needs-tamed-workers
description: Full-suite vitest flakes on PGlite-backed files at default workers — the reliable gate is --hookTimeout=60000 --maxWorkers=3; a failure that passes in isolation is contention, not code.
metadata:
  type: project
---

Under default vitest parallelism, 4–5 PGlite-backed test files (`lib/db/pglite/repositories/{changes,review,weights}`, `scripts/case-loops/apply-batch`, `lib/analysis/kg-money-reingest`) intermittently fail with `Hook timed out in 10000ms` inside `beforeAll(open())` — the WASM store boot exceeds the 10 s hook timeout when many workers boot at once. Measured independently in three worktrees and the main tree on 2026-08-04; the same files pass in isolation every time.

**Why:** a red full run is NOT evidence against a diff until it reproduces under `npx vitest run --hookTimeout=60000 --maxWorkers=3` (reliably green) or in isolation. Two builders and the Director each nearly mis-attributed this.

**How to apply:** the taming is now CHECKED IN — `vitest.config.ts` carries `testTimeout`/`hookTimeout` at 60 s and `maxWorkers: 3`, each with its measurement in a comment beside it (2026-08-24; before that the cap existed only here and in builder briefs, so `npm run test`, pre-push and CI all ran at default parallelism — the exact configuration measured flaky above). A bare `npx vitest run` in this repo therefore already runs tamed; only a run that OVERRIDES the cap needs the flags spelled out. Do not "optimise" the cap away without re-measuring, and keep the diagnostic rule regardless of config: a failure that passes in isolation is contention, not code. Related: [[isolated-dev-server-needs-a-worktree]].
