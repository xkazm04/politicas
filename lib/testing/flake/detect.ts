/**
 * THE TRANSITION DETECTOR — `npm run flake:detect`.
 *
 * test-harness/flake-lifecycle: detection is a query over run history, not a
 * memory, and the usable signal is a TRANSITION COUNT — how often a test's outcome
 * changed between consecutive runs ON THE SAME CODE — because a consistently
 * failing test is broken rather than flaky and the two need opposite responses.
 *
 * This instrument reports its own denominator. If there are not enough comparable
 * runs (same HEAD, clean tree) it says so and exits 0 with "no verdict available"
 * rather than emitting a percentage computed over three runs. `count-carries-
 * predicate`: every figure it prints names the window, the HEAD it was measured
 * on, and the run count.
 *
 * It does NOT write to the quarantine register. Promoting a candidate is a human
 * decision (an agent must never quarantine a test to make a build green), so this
 * prints candidates and stops.
 *
 * Exit codes: 0 = ran (with or without a verdict), 2 = candidates found.
 */

import { pathToFileURL } from "node:url";

import { inspectRegister, loadRegister, publishedFigures } from "./registry";
import { readRuns, type Outcome, type RunRecord } from "./history";

/** Below this, a transition rate is noise dressed as a finding. */
const MIN_COMPARABLE_RUNS = 4;

interface Candidate {
  key: string;
  transitions: number;
  runs: number;
  outcomes: string;
}

export function detect(runs: RunRecord[]): {
  head: string | null;
  comparable: number;
  candidates: Candidate[];
  reason?: string;
} {
  const clean = runs.filter((r) => !r.dirty && r.head !== "unknown");
  if (clean.length === 0)
    return { head: null, comparable: 0, candidates: [], reason: "no runs on a clean tree with a known HEAD" };

  // Group by HEAD; a transition across two different trees measures the product's
  // churn, not the test's stability.
  const byHead = new Map<string, RunRecord[]>();
  for (const r of clean) byHead.set(r.head, [...(byHead.get(r.head) ?? []), r]);
  let head: string | null = null;
  let best: RunRecord[] = [];
  for (const [h, list] of byHead) if (list.length > best.length) [head, best] = [h, list];

  if (best.length < MIN_COMPARABLE_RUNS)
    return {
      head,
      comparable: best.length,
      candidates: [],
      reason: `the largest same-code window is ${best.length} run(s); ${MIN_COMPARABLE_RUNS} are needed before a transition rate means anything`,
    };

  best.sort((a, b) => a.at.localeCompare(b.at));
  const keys = new Set<string>();
  for (const r of best) for (const k of Object.keys(r.tests)) keys.add(k);

  const candidates: Candidate[] = [];
  for (const key of keys) {
    const seq = best.map((r) => r.tests[key]?.s).filter((s): s is Outcome => s !== undefined);
    if (seq.length < MIN_COMPARABLE_RUNS) continue;
    let transitions = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) transitions += 1;
    if (transitions > 0)
      candidates.push({ key, transitions, runs: seq.length, outcomes: seq.map((s) => s[0].toUpperCase()).join("") });
  }
  candidates.sort((a, b) => b.transitions - a.transitions);
  return { head, comparable: best.length, candidates };
}

function main(): void {
  const runs = readRuns();
  const health = inspectRegister(loadRegister());
  console.info(`[flake] ${publishedFigures(health)}`);
  console.info(`[flake] history: ${runs.length} retained run(s) in node_modules/.cache/politicas-test-history/`);

  const r = detect(runs);
  if (r.reason) {
    console.info(`[flake] no verdict available — ${r.reason}.`);
    console.info(
      `[flake] to build a window: commit (or stash) your changes, then run \`npm run test\` a few times on the same HEAD.`,
    );
    process.exit(0);
  }
  console.info(
    `[flake] window: ${r.comparable} runs on HEAD ${r.head?.slice(0, 8)}, clean tree only — the only comparison that is same-code.`,
  );
  if (r.candidates.length === 0) {
    console.info(`[flake] 0 tests changed outcome across those ${r.comparable} runs.`);
    process.exit(0);
  }
  console.info(`[flake] ${r.candidates.length} test(s) changed outcome — candidates, not verdicts:`);
  for (const c of r.candidates.slice(0, 25))
    console.info(`  ${c.transitions} transition(s) in ${c.runs} runs [${c.outcomes}]  ${c.key}`);
  console.info(
    `\n[flake] A candidate is LABELLED information, not a quarantine. Quarantining is a human decision with an\n` +
      `        owner, an expiry and a suspected cause — see lib/testing/flake/registry.json.`,
  );
  process.exit(2);
}

// Run only as an entrypoint — `detect()` is imported by detect.test.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
