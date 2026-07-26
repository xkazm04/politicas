# Test Utilities & Loader Coverage — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Global `server-only` stub silently defeats the boundary check for the whole test suite
- **Lens**: Bug
- **Severity**: High
- **Category**: test-fidelity / masking
- **File**: lib/testing/server-only-stub.ts:1-6 (wired via vitest.config.ts:12-14)
- **Scenario**: A future refactor accidentally causes a module reachable from a client component (e.g. a shared `lib/` helper) to import something tagged `import "server-only"`. In real Next.js builds this throws immediately and breaks the client bundle build. Under vitest, the alias in `vitest.config.ts` unconditionally rewrites every `server-only` import (suite-wide, not scoped to the two intentionally cross-boundary loader tests) to this empty module, so the exact same import graph runs clean in `npm test`.
- **Root cause**: The real `node_modules/server-only/index.js` unconditionally `throw`s on import — it has no `typeof window` guard (confirmed by reading the package). Next.js's own webpack config special-cases this specifically for the *server* compilation graph; the vitest alias reproduces that special-casing for the *entire* test run, with no equivalent of "client compilation still throws." There is no test anywhere that asserts a client-reachable module importing `server-only` actually fails.
- **Impact**: A genuine server/client boundary violation (e.g. PGlite/WASM code accidentally reachable from a client bundle) can ship green through `npm test` and only be caught later at `next build` time (or, in the worst case, in production if the build doesn't fail loudly) — the one guard this package exists to provide is fully inert in the test environment.
- **Fix sketch**: Scope the alias more narrowly (e.g. only within the two lib-hosted cross-boundary test files that need it, via `vi.mock` per file) or add a companion test that imports a client-tagged fixture module chain and asserts it does NOT depend on `server-only`-marked modules (a lightweight static/dependency-graph check), so the suite has some signal if the boundary is crossed for real.

## 2. Leaderboard test never exercises club/region resolution — the part of the loader most likely to break
- **Lens**: Bug
- **Severity**: Medium
- **Category**: test-coverage-gap
- **File**: lib/testing/leaderboard-loader.test.ts:50-61 (vs. features/civicscore/getLeaderboardData.ts:202-217, 271-282)
- **Scenario**: The seed only inserts `kg_node` person rows — no `mandates`, no `clubByMandate`, no `organs`, no `party` nodes are ever seeded. `buildLeaderboard()`'s join logic across `listMandates`, `clubByMandate`, `listOrgans`, and `listKgNodes({kind:"party"})` (lines 202-217) and the club-facet aggregation with seat counts (lines 271-282) therefore execute exclusively on empty inputs every run. The test's own assertion (`clubAbbrev === "—"` for all entries, `clubs` equal to `[]`) locks in only the degenerate "no data" branch.
- **Root cause**: The comment block explicitly frames this as "the first direct test of a get*Data.ts loader," but the seed fixture was built to prove ranking/tie-break/aggregates, not the identity-resolution join — which is exactly the logic the file's own docstring says is reused verbatim by the profile loader ("Directory maps used by both loaders").
- **Impact**: A regression in club/region resolution (wrong mandate→club mapping, wrong seat fallback count, region label mis-formatting) would not be caught here, and because `Directory` is reused by the MP-profile loader, the blind spot is doubled.
- **Fix sketch**: Extend the seed with at least one `mandates` row + a club/party row and assert `clubAbbrev`, `clubName`, `clubColor`, `region`, and the `clubs` facet (including the seat-count fallback branch) resolve correctly.

## 3. `componentPoints` assertions only check `Number.isFinite`, not correctness
- **Lens**: Bug
- **Severity**: Medium
- **Category**: test-coverage-gap / weak-assertion
- **File**: lib/testing/leaderboard-loader.test.ts:88-93 (vs. features/civicscore/getLeaderboardData.ts:104-120)
- **Scenario**: For known input props (`participation_rate: 0.9`, `committee_count: 2`, `leadership_count: 1`, `bills_authored: 1`, `interpellations: 1`, `speech_turns: 10`), the six component weights (participation ×25, committee ×20, legislative ×20, speech ×15, attendance ×10, leadership ×10) produce fully deterministic, computable point values. The test discards that determinism and only asserts `Number.isFinite(pts)` per component.
- **Root cause**: The seed data was crafted precisely enough to hand-verify (the docstring even calls out "componentPoints() re-derives the six components from" these exact counters), but the assertion loop was written generically instead of asserting the derived numbers.
- **Impact**: Any regression that swaps weights, breaks a saturation cap, or otherwise produces a wrong-but-finite point value (e.g. `NaN` guarded to 0, or a transposed weight) passes silently — this is precisely the "test stub masks real behavior difference" failure mode the audit is looking for.
- **Fix sketch**: Replace the finiteness loop with explicit expected values, e.g. `expect(e.components.participation).toBe(22.5)`, `expect(e.components.leadership).toBe(10)`, etc., computed from the same weights/saturation constants the seed was designed around.

## 4. `buildLeaderboard`'s degrade-to-null failure path is completely untested
- **Lens**: Bug
- **Severity**: Medium
- **Category**: test-coverage-gap
- **File**: lib/testing/leaderboard-loader.test.ts:43-46 (vs. features/civicscore/getLeaderboardData.ts:194-196, 314-317)
- **Scenario**: The loader's header comment advertises "Degrades to null on any failure (no store, empty graph, PGlite unavailable) so the page never breaks," and the implementation wraps the entire body in try/catch, calling `reportLoaderFailure` before returning `null`. The only "degrade" scenario the test covers is the benign empty-graph case (`persons.length === 0`); nothing forces the try block to throw (e.g. a store that rejects, or `storeReady` throwing) to verify the catch path actually returns `null` and calls `reportLoaderFailure` rather than propagating.
- **Root cause**: The seeded-happy-path test was the deliberate initial scope (per the linked architect decision), but no companion case simulates a mid-query failure, so the catch branch — the one that keeps `/zebricek` from 500ing in production — has zero regression coverage.
- **Fix sketch**: Add a case that closes/breaks the PGlite handle (or monkeypatches `store.listKgNodes` to reject) before calling `buildLeaderboard()`, asserting it resolves to `null` instead of rejecting, and that `reportLoaderFailure` observes the error (e.g. via a spy/mock on `@/lib/db/loaderGuard`).

## 5. Module-scope `process.env` mutations are never restored, risking leakage to sibling test files in the same worker
- **Lens**: Bug
- **Severity**: Medium
- **Category**: test-isolation
- **File**: lib/testing/leaderboard-loader.test.ts:15-19, 99-103
- **Scenario**: `process.env.PGLITE_PATH` and `process.env.KG_READINESS_OFF` are set once at module top-level (outside any `beforeAll`/`afterAll`) before the dynamic `await import(...)` of the DB internals. `afterAll` closes the connection and `rmSync`s the temp dir, but never deletes/restores either env var. Other `lib/db/**` test files in this suite read `PGLITE_PATH` lazily (per the comment at line 14) and other suites may rely on the readiness gate being ON by default.
- **Root cause**: `process.env` is a single object bound to the OS process, not to vitest's per-file module-registry isolation; vitest's default thread/fork pool reuses worker processes across multiple test files. Setting env vars directly (instead of e.g. `vi.stubEnv` with automatic restore, or explicit cleanup in `afterAll`) makes the mutation durable for the lifetime of the worker process, not just this file.
- **Impact**: If a sibling `lib/db/pglite/*.test.ts` file executes afterward in the same worker, it can inherit `PGLITE_PATH` pointing at this file's now-deleted temp directory, or run with the cardinality-floor readiness gate silently disabled — producing confusing, order-dependent failures or, worse, a false-negative pass because the safety gate this file deliberately bypasses (line 17-18 comment) stays bypassed for tests that specifically mean to exercise it.
- **Fix sketch**: Restore both env vars in `afterAll` (`delete process.env.PGLITE_PATH; delete process.env.KG_READINESS_OFF;`, or snapshot/restore their prior values), or switch to `vi.stubEnv(...)` + `vi.unstubAllEnvs()` so vitest manages the lifecycle per-file.
