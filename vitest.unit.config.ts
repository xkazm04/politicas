/**
 * THE UNIT LANE — everything that does not boot a store.
 *
 * 203 of the repo's 219 test files. No WASM, no `initdb`, no shared singleton:
 * pure logic, catalog parity, mappers, pure builders, RuleTester suites and the
 * `packages/czech-civic-data` extraction. Its inheritance ledger
 * (test-harness/isolation-lanes) is short — these tests inherit nothing from the
 * machine, nothing from each other and nothing from the previous run — which is
 * precisely why the lane may run WIDE.
 *
 * MEASURED 2026-08-24 (12 CPU / 63,5 GB box, vitest 4.1.11):
 *   these 203 files at maxWorkers 3 (the old global cap) ... 111,8 s wall
 *   these 203 files at maxWorkers 11 ........................ 25,2 s wall
 *
 * The cap was there to protect a PGlite boot none of these files perform. Taking
 * it off them is worth 86,6 s of wall clock and it is the single largest item in
 * this whole change.
 *
 * BUDGET. Tier: commit. 5 s per test — the vitest default, restored deliberately.
 * The 60 s timeouts the old shared config carried were a PGlite contention
 * measurement (memory/vitest-pglite-needs-tamed-workers.md); charging them to pure
 * logic meant a genuinely hung unit test could hang the gate for a minute instead
 * of failing in five seconds. A unit test that needs more than 5 s is either not a
 * unit test or is broken, and the lane should say so.
 */

import { cpus } from "node:os";

import { defineConfig } from "vitest/config";

import { quarantinedFiles } from "./lib/testing/flake/registry";
import DurationSequencer from "./lib/testing/flake/sequencer";
import { ALL_TEST_GLOBS, DEFAULT_EXCLUDES, PGLITE_LANE_FILES } from "./lib/testing/lanes";
import { sharedResolve } from "./vitest.shared";

// Measured at 11 on the 12-core box above; expressed as a function of the machine
// so a 4-core CI runner is not asked for 11 workers it does not have.
const WIDE = Math.max(2, cpus().length - 1);

export default defineConfig({
  resolve: sharedResolve,
  test: {
    name: "unit",
    include: [...ALL_TEST_GLOBS],
    // The partition, subtractively: everything except the store-booting lane and
    // whatever is currently quarantined. `lane-partition.test.ts` proves on every
    // run that this exclusion is exactly the pglite lane and nothing more — a
    // partition that silently drops a file is the worst outcome available here.
    exclude: [...DEFAULT_EXCLUDES, ...PGLITE_LANE_FILES, ...quarantinedFiles()],
    testTimeout: 5_000,
    hookTimeout: 10_000,
    maxWorkers: WIDE,
    sequence: { sequencer: DurationSequencer },
    reporters: ["default", ["./lib/testing/flake/history-reporter.ts", { lane: "unit" }]],
  },
});
