/**
 * THE LANE PARTITION — one authority for "what runs where".
 *
 * Until 2026-08-24 this repo had ONE vitest config: a flat include list over
 * `lib/**`, `features/**`, `scripts/**` and `packages/<pkg>/src/**`, one 60 s timeout
 * budget, and one global `maxWorkers: 3`. The cap existed for a real, measured
 * reason (see memory/vitest-pglite-needs-tamed-workers.md) — but it was charged to
 * every file in the repo, and only 16 of 219 ever boot a WASM Postgres.
 *
 * MEASURED 2026-08-24 on this box (12 CPU / 63,5 GB, vitest 4.1.11, 219 files):
 *   whole suite, one config, maxWorkers 3 ......... 276,7 s wall (271,5 s reported)
 *   the 203 non-PGlite files alone, maxWorkers 3 ... 111,8 s wall
 *   the 203 non-PGlite files alone, maxWorkers 11 ..  25,2 s wall
 *   the 16 PGlite files alone, maxWorkers 3 ........  47,8 s wall
 *
 * The cap was costing the pure-logic files 86,6 s of wall clock to protect a WASM
 * boot they never perform. That is the whole argument for the split.
 *
 * MEMBERSHIP IS BY PATH, NOT BY ANNOTATION. The registry technique
 * (test-harness/suite-partitioning) asks for a directory boundary or a naming
 * convention; neither is available here without moving files across feature
 * ownership boundaries, so the partition is this explicit list — and because an
 * explicit list is exactly the thing that silently rots, `lane-partition.test.ts`
 * enforces three properties on every run:
 *   1. the union of the lanes equals the legacy flat include set (nothing dropped),
 *   2. the lanes are disjoint (nothing runs twice with two budgets),
 *   3. no file left in the unit lane carries a PGlite boot marker (nothing misfiled).
 * A new store-booting test that forgets to enlist here turns the gate red with its
 * own path named.
 */

/** The legacy flat include list. Still the union of the partition — never narrower. */
export const ALL_TEST_GLOBS = [
  "lib/**/*.test.ts",
  "features/**/*.test.ts",
  "scripts/**/*.test.ts",
  "packages/*/src/**/*.test.ts",
] as const;

/**
 * Files that boot a real PGlite (WASM Postgres) in a temp data dir.
 *
 * Enumerated 2026-08-24 as exactly the files that assign `process.env.PGLITE_PATH`;
 * `lib/ingest/sources/dataor.test.ts` uses `mkdtemp` for plain files and is NOT one,
 * `lib/db/pglite/ledger.test.ts` is pure chain arithmetic and is NOT one.
 */
export const PGLITE_LANE_FILES = [
  "features/dukazy/chainRow.test.ts",
  "features/volby/loaders.test.ts",
  "lib/analysis/kg-money-reingest.test.ts",
  "lib/db/kgOrder.test.ts",
  "lib/db/pglite/accounting.test.ts",
  "lib/db/pglite/durability.test.ts",
  "lib/db/pglite/maintenance-store.test.ts",
  "lib/db/pglite/open-retry.test.ts",
  "lib/db/pglite/premigration.test.ts",
  "lib/db/pglite/repositories/changes.test.ts",
  "lib/db/pglite/repositories/graph.test.ts",
  "lib/db/pglite/repositories/kg-bitemporal.test.ts",
  "lib/db/pglite/repositories/ledger.test.ts",
  "lib/db/pglite/repositories/review.test.ts",
  "lib/db/pglite/repositories/votes.test.ts",
  "lib/db/pglite/repositories/weights.test.ts",
  "lib/db/readiness.test.ts",
  "lib/db/store-lockstep.test.ts",
  "lib/testing/loaders.test.ts",
  "lib/testing/sentinel/sentinel.test.ts",
  "scripts/case-loops/apply-batch.test.ts",
  "scripts/data-analysis/kg-writer-provenance.test.ts",
] as const;

/**
 * PGlite-lane files that must keep their OWN cold boot rather than copying the
 * shared template, each for a stated reason. Anything not listed here is expected
 * to use `pgliteFixtureDir()`.
 */
export const TEMPLATE_EXEMPT: Readonly<Record<string, string>> = {
  // Induces a REAL open() failure by pointing PGLITE_PATH under a plain file. A
  // pre-provisioned template dir would defeat the thing it regression-tests.
  "lib/db/pglite/open-retry.test.ts":
    "deliberately points PGLITE_PATH at an unusable dir to test open()'s retry",
  // features/** is owned elsewhere; left on the cold path deliberately, not by
  // oversight. Worth ~3,4 s if it is ever converted.
  "features/dukazy/chainRow.test.ts": "not converted — features/** was out of scope for this pass",
};

/**
 * The marker that says "this file boots a store". Used by the partition guard to
 * catch a store-booting test that was added to the unit lane by omission.
 * Kept as a source-text probe rather than an import graph walk: it is O(read) and
 * it cannot be satisfied accidentally — assigning PGLITE_PATH *is* the boot.
 */
export const PGLITE_BOOT_MARKER = /process\.env\.PGLITE_PATH\s*=|pgliteFixtureDir\s*\(/;

/** Vitest `exclude` needs the defaults restated whenever it is set explicitly. */
export const DEFAULT_EXCLUDES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.{idea,git,cache,output,temp}/**",
] as const;
