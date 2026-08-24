/**
 * The vitest reporter that writes run history. Additive — it is listed alongside
 * the default reporter, so the console output is unchanged.
 *
 * It also prints the quarantine register's two published figures at the end of
 * every run. test-harness/flake-lifecycle asks for size-with-trend and age-of-the-
 * oldest-entry to appear "wherever the suite's health is published"; for this repo
 * that is the test output, because there is no dashboard and inventing one would
 * be an instrument nobody reads.
 *
 * Everything here is wrapped: a reporter that can fail the run it is measuring is
 * worse than no reporter.
 */

import { relative } from "node:path";

import type { Reporter, TestModule } from "vitest/node";

import { currentCode, testKey, writeRun, type Outcome, type RunRecord } from "./history";
import { inspectRegister, loadRegister, publishedFigures } from "./registry";

export default class HistoryReporter implements Reporter {
  private readonly lane: string;

  constructor(options?: { lane?: string }) {
    this.lane = options?.lane ?? process.env.POLITICAS_LANE ?? "unknown";
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    try {
      const { head, dirty } = currentCode();
      const tests: RunRecord["tests"] = {};
      for (const mod of testModules) {
        const rel = relative(process.cwd(), mod.moduleId).replace(/\\/g, "/");
        for (const test of mod.children.allTests()) {
          const state = test.result().state;
          const s: Outcome = state === "passed" ? "passed" : state === "failed" ? "failed" : "skipped";
          tests[testKey(rel, test.fullName)] = { s, d: Math.round(test.diagnostic()?.duration ?? 0) };
        }
      }
      writeRun({ at: new Date().toISOString(), head, dirty, lane: this.lane, tests });
    } catch (err) {
      console.warn("[test-history] could not record this run — history is an instrument, never a gate", err);
    }

    try {
      const health = inspectRegister(loadRegister());
      console.info(`\n[flake] ${publishedFigures(health)}`);
    } catch (err) {
      console.warn("[flake] could not read the quarantine register; its gate is registry.test.ts", err);
    }
  }
}
