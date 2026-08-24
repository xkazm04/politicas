/**
 * THE FALLBACK CONFIG — what a bare `npx vitest run` gets. NOT the partition.
 *
 * The partition lives in `vitest.unit.config.ts` and `vitest.pglite.config.ts`, and
 * `npm run test` runs both. This file exists because
 * test-harness/suite-partitioning names "the implicit default suite — whatever the
 * runner discovers when no config narrows it" as a degenerate partition: if a bare
 * `npx vitest run` in this repo silently became a third, differently-budgeted
 * machine, every misfiled test would land there. So the default is pinned to the
 * SAFE union — every file, the conservative store-lane budget, the tamed worker
 * cap — which is byte-for-byte the behaviour this repo had before 2026-08-24 and
 * exactly what memory/vitest-pglite-needs-tamed-workers.md promises a reader who
 * types `npx vitest run`.
 *
 * It is slower than the lanes by design (276,7 s vs 73,0 s measured 2026-08-24) and
 * it is not what CI runs. Its include list is the same `ALL_TEST_GLOBS` the unit
 * lane starts from, so the fallback cannot drift narrower than the partition.
 *
 * ── history, kept because it is still load-bearing ────────────────────────────
 *
 * `features/**` joined the suite 2026-07-28: the Velín graph slice is a PURE
 * builder that lives beside the feature that owns it, and an invariant test that
 * never runs is not an invariant. `packages/<pkg>/src/**` joined 2026-07-30 (moonshot
 * 6A) when the czech-civic-data UNL/cp1250/zip/fold suite moved into the package;
 * including it keeps a whole-repo run whole (the package also runs standalone via
 * its own vitest.config.ts).
 *
 * The 60 s timeouts: raised from 30 s on 2026-08-05 after the sentinel fixture-store
 * tests were observed at ~33 s under full-suite parallel load in pre-push runs.
 * The `maxWorkers: 3` cap: measured 2026-08-04 across three worktrees and the main
 * tree — 4–5 PGlite-backed files intermittently fail in `beforeAll(open())` at
 * default parallelism and pass every time at 3. Both stay here, together, because
 * this config runs the store files and the pure files in one pool and therefore
 * must budget for the worst case in it.
 */

import { defineConfig } from "vitest/config";

import { quarantinedFiles } from "./lib/testing/flake/registry";
import { ALL_TEST_GLOBS, DEFAULT_EXCLUDES } from "./lib/testing/lanes";
import { sharedResolve } from "./vitest.shared";

export default defineConfig({
  resolve: sharedResolve,
  test: {
    name: "all",
    include: [...ALL_TEST_GLOBS],
    exclude: [...DEFAULT_EXCLUDES, ...quarantinedFiles()],
    // The template helps here too — the store files in this union get the same
    // build-once fixture the pglite lane gets.
    globalSetup: ["./lib/testing/pglite-template.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    maxWorkers: 3,
    reporters: ["default", ["./lib/testing/flake/history-reporter.ts", { lane: "all" }]],
  },
});
