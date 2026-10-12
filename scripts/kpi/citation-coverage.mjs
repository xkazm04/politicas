/**
 * KPI meter: citation coverage on the reader-facing render path.
 *
 *   node scripts/kpi/citation-coverage.mjs [--json]
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * "Every rendered number carries a dated, sourced citation" was a claim with a
 * gate behind it but no METER: `custom/require-source-citation` reports only
 * failures, so the repo could say "0 uncited figures" and never "0 out of how
 * many". A count of violations is not a coverage ratio — it goes to zero both
 * when every figure is cited and when nobody renders a figure at all, and those
 * are opposite facts about the same brand rule.
 *
 * This script runs the SAME rule in census mode (`{ census: true }`), which
 * reports every rendered figure its triggers see, tagged with the state that
 * decided it. One implementation of "what is a rendered figure" serves both the
 * gate and the meter, so the number below can never drift away from what CI
 * enforces.
 *
 * ── What it reports ──────────────────────────────────────────────────────
 *   cited     — a provenance element (SourceNote family, <PosterFrame citation>,
 *               data-undisclosed) lives in the same file
 *   declared  — a `// citation-ok: <reason>` annotation: the citation is
 *               declared to live in the parent component, one file up
 *   uncited   — neither. This is exactly the gate's error set.
 *
 *   coverage = (cited + declared) / total, per figure and per file.
 *
 * `declared` counts as covered because the annotation is a reviewed assertion,
 * not a suppression — but it is reported separately on purpose: it is the part
 * of the ratio that rests on a human sentence rather than on a visible element,
 * and a coverage number that hides it would be the same kind of unaudited claim
 * the brand rule exists to prevent.
 *
 * Scope mirrors the gate's (eslint.config.mjs): app/, features/, components/,
 * minus features/labs/** (archived art direction, rule explicitly off there).
 */

import { ESLint } from "eslint";

const TARGETS = ["app", "features", "components"];
const RULE = "custom/require-source-citation";
const asJson = process.argv.includes("--json");

const eslint = new ESLint({
  // Appended to the repo's flat config, so it wins over the repo severities —
  // but the labs opt-out has to be re-stated, because that config object sits
  // EARLIER in the array and would otherwise be overridden back on.
  overrideConfig: [
    {
      files: ["app/**/*.{ts,tsx}", "features/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      rules: { [RULE]: ["warn", { census: true }] },
    },
    { files: ["features/labs/**/*.{ts,tsx}"], rules: { [RULE]: "off" } },
  ],
});

const results = await eslint.lintFiles(TARGETS);

const figures = { cited: 0, declared: 0, uncited: 0 };
const files = { cited: 0, declared: 0, uncited: 0 };
const uncitedFiles = [];
const declaredFiles = [];

for (const result of results) {
  const rows = result.messages.filter((m) => m.ruleId === RULE);
  if (rows.length === 0) continue;

  const states = new Set();
  for (const row of rows) {
    // The state is the parenthesised word in "Rendered figure (<state>)." —
    // ESLint's JSON output carries the interpolated message, not the data bag.
    const state = /\(([a-z]+)\)/.exec(row.message)?.[1];
    if (!state || !(state in figures)) {
      throw new Error(`census row with an unreadable state: ${result.filePath}: ${row.message}`);
    }
    figures[state] += 1;
    states.add(state);
  }

  // A file is counted at its WORST state: one uncited figure makes the file
  // uncited however many cited ones sit beside it.
  const worst = states.has("uncited") ? "uncited" : states.has("declared") ? "declared" : "cited";
  files[worst] += 1;
  const rel = result.filePath.replace(process.cwd() + "\\", "").replace(process.cwd() + "/", "");
  if (worst === "uncited") uncitedFiles.push(rel);
  if (worst === "declared") declaredFiles.push(rel);
}

const totalFigures = figures.cited + figures.declared + figures.uncited;
const totalFiles = files.cited + files.declared + files.uncited;
const pct = (n, d) => (d === 0 ? null : Math.round((n / d) * 10000) / 100);

const report = {
  measuredAt: new Date().toISOString().slice(0, 10),
  scope: "app/** + features/** + components/**, minus features/labs/**",
  filesLinted: results.length,
  figures: { ...figures, total: totalFigures },
  files: { ...files, total: totalFiles },
  coveragePctFigures: pct(figures.cited + figures.declared, totalFigures),
  coveragePctFiles: pct(files.cited + files.declared, totalFiles),
  citedOnlyPctFigures: pct(figures.cited, totalFigures),
  uncitedFiles,
  declaredFiles,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`citation coverage — ${report.measuredAt}`);
  console.log(`  scope        ${report.scope}`);
  console.log(`  files linted ${report.filesLinted}`);
  console.log(
    `  figures      ${totalFigures} total — ${figures.cited} cited, ${figures.declared} declared, ${figures.uncited} uncited`,
  );
  console.log(
    `  files        ${totalFiles} render a figure — ${files.cited} cited, ${files.declared} declared, ${files.uncited} uncited`,
  );
  console.log(`  COVERAGE     ${report.coveragePctFigures} % of figures, ${report.coveragePctFiles} % of files`);
  console.log(`               (${report.citedOnlyPctFigures} % carry a provenance ELEMENT; the rest are declared)`);
  if (uncitedFiles.length) {
    console.log(`  uncited files:`);
    for (const f of uncitedFiles) console.log(`    ${f}`);
  }
  if (declaredFiles.length) {
    console.log(`  files resting only on a citation-ok annotation:`);
    for (const f of declaredFiles) console.log(`    ${f}`);
  }
}

// The meter never fails the build: it reports, and the GATE is what refuses.
process.exit(0);
