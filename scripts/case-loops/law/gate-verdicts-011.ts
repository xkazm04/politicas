/* Case ③ Law loop — batch-011 scoped verdict gate. Unlike gate-verdicts.ts this needs NO
 * database: the anti-fabrication scope (knownLawRefs ∪ e-Sbírka registry, knownIds) ships
 * inside batch-011-targets.json, so army agents can self-check in parallel without opening
 * the single-connection PGlite copy, and it gates ONLY payloads/verdicts-011/ — the 27
 * archived pre-rewrite English originals under payloads/verdicts/ are out of scope here
 * (they fail requireCzech by design; their Czech rewrites live on the graph, pass 33).
 *
 *   npx tsx scripts/case-loops/law/gate-verdicts-011.ts [--file=verdict-64.json]
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { validateLawVerdict } from "@/lib/analysis/law-verdict";

// --batch=012 gates payloads/verdicts-012/ against batch-012-targets.json etc. (default 011).
// Parameterized in batch-012 instead of copied — the retriage-009 --batch= precedent.
const BATCH = (process.argv.find((a) => a.startsWith("--batch=")) ?? "--batch=011").slice(8);
const DIR = `docs/data-analysis/case-law/payloads/verdicts-${BATCH}`;
const TARGETS = `docs/data-analysis/case-law/payloads/batch-${BATCH}-targets.json`;

function main() {
  const t = JSON.parse(readFileSync(TARGETS, "utf8")) as { targets: { billTisk: number }[]; knownLawRefs: string[]; knownIds: string[] };
  const knownLawRefs = new Set(t.knownLawRefs);
  const knownIds = new Set(t.knownIds);
  const targetCisla = new Set(t.targets.map((x) => x.billTisk));

  const only = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  // verdict-<cislo>.json ONLY — batch-012 P1 found the gate exiting 1 on the shipped payload
  // because the persist step's combined-array artifact matched a bare .json glob. A gate that
  // fails on its own payload teaches operators to ignore its exit code.
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^verdict-\d+\.json$/.test(f) && (!only || f === only)).sort() : [];
  if (files.length === 0) {
    console.log(`no verdicts in ${DIR}`);
    process.exit(1);
  }

  let pass = 0;
  for (const f of files) {
    const v = JSON.parse(readFileSync(join(DIR, f), "utf8")) as { billTisk?: number; severity?: string; confidence?: number; unstatedEffects?: unknown[]; citations?: unknown[] };
    const errors: string[] = [];
    const r = validateLawVerdict(v, { knownLawRefs, knownIds }); // requireCzech defaults TRUE
    if (!r.ok) errors.push(...r.errors);
    if (typeof v.billTisk === "number" && !targetCisla.has(v.billTisk)) errors.push(`billTisk ${v.billTisk} is not a batch-${BATCH} target`);
    const ok = errors.length === 0;
    if (ok) pass++;
    console.log(
      `${ok ? "✓" : "✗"} ${f.padEnd(18)} tisk ${String(v.billTisk ?? "?").padStart(4)} · ${(v.severity ?? "?").padEnd(6)} · conf ${v.confidence ?? "?"} · ${Array.isArray(v.unstatedEffects) ? v.unstatedEffects.length : "?"} effects · ${Array.isArray(v.citations) ? v.citations.length : "?"} cites`,
    );
    for (const e of errors.slice(0, 8)) console.log(`     • ${e}`);
  }
  console.log(`\nGATE: ${pass}/${files.length} batch-${BATCH} verdicts pass.`);
  process.exit(pass === files.length ? 0 : 1);
}

main();
