/**
 * THE PGLITE INTEGRATION LANE — the 16 files that boot a real WASM Postgres.
 *
 * WHAT THESE TESTS INHERIT (the isolation-lanes ledger, stated rather than inferred
 * from where it flakes):
 *   • from the machine: nothing. Each file gets its own `mkdtemp` data directory
 *     and never the live `./.pglite`; `pgliteFixtureDir()` refuses outright to
 *     hand back a path outside the OS temp dir.
 *   • from another file: nothing. PGlite is single-connection per data dir and each
 *     file owns its own, so there is no shared instance to reset between them.
 *   • from the previous run: nothing that matters, and the one thing that does
 *     persist — the fixture template — is fingerprinted by sha256(CORE_DDL +
 *     pglite version) and reaped when that changes.
 *
 * THE SINGLETON CATALOG. There is exactly one: the live `./.pglite` store, which
 * admits a single connection. No test in this lane may touch it, which is why the
 * fixture asserts its own precondition instead of trusting the convention.
 *
 * PARALLELISM: still capped at 3, and deliberately not raised today.
 * memory/vitest-pglite-needs-tamed-workers.md records 4–5 of these files
 * intermittently failing in `beforeAll(open())` at default parallelism, measured
 * across three worktrees and the main tree on 2026-08-04, and passing every time at
 * 3. This pass removes the mechanism behind that symptom — the ~4 s `initdb` is now
 * paid once in globalSetup instead of once per file — so the cap is very likely
 * loosenable. It stays at 3 anyway, because the evidence for raising it would be a
 * repeated-run stability window and all this pass has is single green runs at 4 and
 * 6 workers (44,2 s and 39,1 s). One green run of an intermittent failure proves
 * nothing; that is the whole first section of test-harness/flake-lifecycle. Raise it
 * when somebody measures a window, and record the window here.
 *
 * MEASURED 2026-08-24, this lane alone, 16 files / 175 tests:
 *   maxWorkers 3 ... 47,8 s wall     maxWorkers 4 ... 44,2 s     maxWorkers 6 ... 39,1 s
 *
 * BUDGET. Tier: push. The 60 s test/hook timeouts stay — they were measured against
 * exactly these files (sentinel fixture-store tests observed at ~33 s under full
 * parallel load, 2026-08-05) and they belong here, not on the 203 pure-logic files
 * that were paying for them.
 */

import { defineConfig } from "vitest/config";

import { quarantinedFiles } from "./lib/testing/flake/registry";
import DurationSequencer from "./lib/testing/flake/sequencer";
import { DEFAULT_EXCLUDES, PGLITE_LANE_FILES } from "./lib/testing/lanes";
import { sharedResolve } from "./vitest.shared";

export default defineConfig({
  resolve: sharedResolve,
  test: {
    name: "pglite",
    include: [...PGLITE_LANE_FILES],
    exclude: [...DEFAULT_EXCLUDES, ...quarantinedFiles()],
    // Builds the store template ONCE, in the main process, before any worker
    // exists — see lib/testing/pglite-template.ts for the full measurement and for
    // why copying this store is safe when copying the live one is not.
    globalSetup: ["./lib/testing/pglite-template.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    maxWorkers: 3,
    sequence: { sequencer: DurationSequencer },
    reporters: ["default", ["./lib/testing/flake/history-reporter.ts", { lane: "pglite" }]],
  },
});
