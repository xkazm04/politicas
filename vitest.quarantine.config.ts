/**
 * THE QUARANTINE LANE — non-blocking, and empty today.
 *
 * Its include list IS `lib/testing/flake/registry.json`. Adding an entry there
 * moves that file out of the unit and pglite lanes (both subtract
 * `quarantinedFiles()`) and into this one, which CI runs with `continue-on-error`.
 *
 * This is the "muted" form test-harness/flake-lifecycle prefers, at the coarsest
 * granularity vitest supports without editing test source: the file still RUNS and
 * its result is still recorded into the run history — which is the data that will
 * eventually diagnose it — it simply does not block. A skipped test produces
 * nothing and is indistinguishable from a deleted one after a month.
 *
 * With an empty register vitest would exit non-zero on "no test files found", which
 * would make the empty state look like a failure. `passWithNoTests` makes the empty
 * register mean what it says: nothing is quarantined.
 *
 * Budgets are the union of both lanes' worst case, because a quarantined file may
 * have come from either one.
 */

import { defineConfig } from "vitest/config";

import { quarantinedFiles } from "./lib/testing/flake/registry";
import { DEFAULT_EXCLUDES } from "./lib/testing/lanes";
import { sharedResolve } from "./vitest.shared";

const quarantined = quarantinedFiles();

export default defineConfig({
  resolve: sharedResolve,
  test: {
    name: "quarantine",
    include: quarantined,
    exclude: [...DEFAULT_EXCLUDES],
    // A quarantined file may be store-backed, so the lane pays for the template.
    globalSetup: ["./lib/testing/pglite-template.ts"],
    passWithNoTests: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    maxWorkers: 3,
    reporters: ["default", ["./lib/testing/flake/history-reporter.ts", { lane: "quarantine" }]],
  },
});
