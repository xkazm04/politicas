/**
 * KPI meter: the verify loop — does `npm run check` go green, stage by stage.
 *
 *   node scripts/kpi/verify-loop.mjs [--json] [--with-build] [--only=lint,test:unit]
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * `npm run check` is a `&&` chain, so it reports ONE bit and it reports the
 * FIRST failure: a run that dies in typecheck says nothing about whether the
 * tests pass, and a green run says nothing about which stage is about to become
 * the bottleneck as the graph grows. "Keep the verify loop green while the graph
 * grows" needs both halves — a pass RATE across stages that survives one stage
 * failing, and the per-stage wall clock that says where the growth is landing.
 *
 * So this runs every stage independently (no `&&`), records exit code and
 * duration for each, and reports the share that exited 0. The stage list is
 * derived from package.json's `check` script at runtime, not copied: a stage
 * added to the gate is measured the next time this runs, instead of quietly
 * falling out of the denominator.
 *
 * `build` is NOT in `npm run check` — it is CI-only — so it is opt-in behind
 * --with-build rather than silently included, which would make this meter and
 * the local gate disagree about what "the verify loop" is.
 *
 * Exit code mirrors the gate: non-zero if any measured stage failed, so this can
 * stand in for `npm run check` in an unattended run and still report the rate.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const withBuild = argv.includes("--with-build");
const only = argv.find((a) => a.startsWith("--only="))?.slice("--only=".length).split(",");

/** Read the gate's own definition of its stages out of package.json.
 *  `check` is "npm run a && npm run b && …"; anything that is not an
 *  `npm run <script>` term is left alone and reported as unparsed. */
function stagesFromCheckScript() {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const check = pkg.scripts?.check;
  if (!check) throw new Error("package.json has no `check` script — the gate this meter measures is gone");
  const terms = check.split("&&").map((t) => t.trim());
  const stages = [];
  for (const term of terms) {
    const m = /^npm run ([\w:-]+)$/.exec(term);
    if (!m) throw new Error(`\`check\` contains a term this meter cannot resolve to a stage: ${term}`);
    const name = m[1];
    // `test` is itself a chain of two lanes; measuring them separately is the
    // point (unit vs pglite fail for different reasons and cost different time).
    const nested = pkg.scripts[name];
    const nestedTerms = nested?.split("&&").map((t) => t.trim()) ?? [];
    const allNestedAreScripts =
      nestedTerms.length > 1 && nestedTerms.every((t) => /^npm run ([\w:-]+)$/.test(t));
    if (allNestedAreScripts) {
      for (const t of nestedTerms) stages.push(/^npm run ([\w:-]+)$/.exec(t)[1]);
    } else {
      stages.push(name);
    }
  }
  return stages;
}

let stages = stagesFromCheckScript();
if (withBuild) stages.push("build");
if (only) stages = stages.filter((s) => only.includes(s));

const runs = [];
for (const stage of stages) {
  const started = Date.now();
  const res = spawnSync("npm", ["run", stage], {
    stdio: asJson ? "pipe" : "inherit",
    shell: true,
    encoding: "utf8",
  });
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  const ok = res.status === 0;
  runs.push({ stage, ok, exitCode: res.status, seconds });
  if (!asJson) console.log(`\n── ${ok ? "PASS" : "FAIL"} ${stage} (${seconds}s, exit ${res.status})\n`);
}

const passed = runs.filter((r) => r.ok).length;
const passRate = runs.length === 0 ? null : Math.round((passed / runs.length) * 10000) / 100;
const report = {
  measuredAt: new Date().toISOString().slice(0, 10),
  stages: runs,
  passed,
  total: runs.length,
  passRatePct: passRate,
  wallClockSeconds: Math.round(runs.reduce((a, r) => a + r.seconds, 0) * 10) / 10,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`verify loop — ${report.measuredAt}`);
  for (const r of runs) console.log(`  ${r.ok ? "green" : "RED  "}  ${r.stage.padEnd(16)} ${r.seconds}s`);
  console.log(`  PASS RATE   ${passRate} % (${passed}/${runs.length} stages), ${report.wallClockSeconds}s wall clock`);
}

process.exit(passed === runs.length ? 0 : 1);
