---
name: vitest-pglite-needs-tamed-workers
description: Full-suite vitest flakes on PGlite-backed files at default workers — the reliable gate is --hookTimeout=60000 --maxWorkers=3; a failure that passes in isolation is contention, not code.
metadata:
  type: project
---

Under default vitest parallelism, 4–5 PGlite-backed test files (`lib/db/pglite/repositories/{changes,review,weights}`, `scripts/case-loops/apply-batch`, `lib/analysis/kg-money-reingest`) intermittently fail with `Hook timed out in 10000ms` inside `beforeAll(open())` — the WASM store boot exceeds the 10 s hook timeout when many workers boot at once. Measured independently in three worktrees and the main tree on 2026-08-04; the same files pass in isolation every time.

**Why:** a red full run is NOT evidence against a diff until it reproduces under `npx vitest run --hookTimeout=60000 --maxWorkers=3` (reliably green) or in isolation. Two builders and the Director each nearly mis-attributed this.

**2026-08-24 addendum — the taming was right, its SCOPE was not.** Only 16 of 219 test
files boot a store. Charging the cap and the 60 s budget to the other 203 cost 86,6 s of
wall clock (111,8 s at `maxWorkers: 3` vs 25,2 s at 11, same files). The suite is now two
lanes — `npm run test:unit` (wide, 5 s budget) and `npm run test:pglite` (cap 3, 60 s
budget, the measurement above quoted in-file) — and `npm run test` runs both: 276,7 s →
70,6 s at an identical test count. **The cap itself was NOT loosened**: the evidence for
raising it would be a repeated-run stability window, and single green runs at 4 and 6
workers are not that. What did change is the mechanism behind the symptom — the ~4 s
`initdb` now happens once in globalSetup instead of once per file, so the boot that blew
the 10 s hook timeout is gone from the per-file path. See
[[one-worker-cap-taxed-the-whole-suite]]. A bare `npx vitest run` still runs the tamed
union config, exactly as promised below.

**How to apply:** the taming is now CHECKED IN — `vitest.config.ts` carries `testTimeout`/`hookTimeout` at 60 s and `maxWorkers: 3`, each with its measurement in a comment beside it (2026-08-24; before that the cap existed only here and in builder briefs, so `npm run test`, pre-push and CI all ran at default parallelism — the exact configuration measured flaky above). A bare `npx vitest run` in this repo therefore already runs tamed; only a run that OVERRIDES the cap needs the flags spelled out. Do not "optimise" the cap away without re-measuring, and keep the diagnostic rule regardless of config: a failure that passes in isolation is contention, not code. Related: [[isolated-dev-server-needs-a-worktree]].
