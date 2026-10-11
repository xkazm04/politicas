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
 * ── The DATED half ───────────────────────────────────────────────────────
 * The brand rule says "dated, sourced citation", and the gate checks only that
 * a satisfier element is PRESENT. A second pass here classifies every satisfier
 * element in scope (the rule's SATISFIER_ELEMENTS, plus <PosterFrame citation>)
 * as dated or undated by its OWN subtree:
 *
 *   dated  — a `provenance` receipt prop (carries the retrieval date), or a
 *            date formatter call (f.date / czechDate / formatDate ...) or an
 *            ISO / Czech date literal anywhere inside the element
 *   undated — none of those
 *
 * It is a MEASUREMENT, not a gate: no target exists for it yet, and this pass
 * is purely syntactic (a date computed away from the element, e.g. in a prop
 * of a parent, reads as undated), so treat it as a lower bound on honesty.
 *
 * Scope mirrors the gate's (eslint.config.mjs): app/, features/, components/,
 * minus features/labs/** (archived art direction, rule explicitly off there).
 */

import { ESLint } from "eslint";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

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

// ── dated half ────────────────────────────────────────────────────────────
const SATISFIERS = new Set([
  "SourceNote",
  "SourceRef",
  "DataUnavailable",
  "LiveDataNotice",
  "CitableNumber",
  "ProvenanceCapsule",
]);
const DATE_CALLEES = /^(date|dateTime|datetime|czechDate|czechDateTime|formatDate|formatDateTime)$/;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const CZ_DATE = /\b\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\b/;
const hasDateText = (t) => ISO_DATE.test(t) || CZ_DATE.test(t);

function walkSources(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || full.replaceAll("\\", "/").endsWith("features/labs")) continue;
      walkSources(full, out);
    } else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

function attrNames(opening) {
  return opening.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.getText());
}

/** Does anything inside `node` (attributes and children) carry a date? */
function subtreeHasDate(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
      if (name && DATE_CALLEES.test(name)) return void (found = true);
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) ||
         ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) && hasDateText(n.text)) {
      return void (found = true);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

const dated = { dated: 0, undated: 0, byReceipt: 0, byDateInSubtree: 0 };
const byElement = {};
const undatedFiles = new Map();
for (const root of TARGETS) {
  for (const file of walkSources(root)) {
    const text = readFileSync(file, "utf8");
    if (!/Source|DataUnavailable|LiveDataNotice|CitableNumber|ProvenanceCapsule|PosterFrame/.test(text)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (n) => {
      const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null;
      if (opening) {
        const name = opening.tagName.getText();
        const attrs = attrNames(opening);
        const isSatisfier = SATISFIERS.has(name) || (name === "PosterFrame" && attrs.includes("citation"));
        if (isSatisfier) {
          const byReceipt = attrs.includes("provenance") || attrs.includes("citation") || attrs.includes("receipt");
          const isDated = byReceipt || subtreeHasDate(n);
          const row = (byElement[name] ??= { dated: 0, undated: 0 });
          if (isDated) {
            dated.dated += 1;
            row.dated += 1;
            if (byReceipt) dated.byReceipt += 1;
            else dated.byDateInSubtree += 1;
          } else {
            dated.undated += 1;
            row.undated += 1;
            const rel = relative(process.cwd(), file).replaceAll("\\", "/");
            undatedFiles.set(rel, (undatedFiles.get(rel) ?? 0) + 1);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
}
const totalSatisfiers = dated.dated + dated.undated;

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
  dated: {
    satisfierElements: totalSatisfiers,
    dated: dated.dated,
    datedByReceiptProp: dated.byReceipt,
    datedByDateInSubtree: dated.byDateInSubtree,
    undated: dated.undated,
    datedSharePct: pct(dated.dated, totalSatisfiers),
    byElement,
    undatedFiles: [...undatedFiles.keys()].sort(),
  },
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
  const d = report.dated;
  console.log(
    `  DATED SHARE  ${d.datedSharePct} % of ${d.satisfierElements} citation elements carry a date — ` +
      `${d.datedByReceiptProp} by receipt prop, ${d.datedByDateInSubtree} by a date in the element, ${d.undated} undated`,
  );
  console.log(`               (syntactic, own-subtree only; no target is set for this number)`);
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
