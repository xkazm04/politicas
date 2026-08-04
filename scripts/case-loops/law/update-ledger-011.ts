/* Case ③ Law loop — batch-011 ledger update. MERGE-PRESERVING by construction (the P44/D1
 * rule): reads ledger.json, patches ONLY the rows whose cislo has a gated batch-011 verdict
 * file, adds one `totals.batch011Verdicts` block, and touches nothing else — every
 * hand-written totals.* block and every other row survives byte-identical.
 *
 * Run AFTER kg-forensics --write --commit has landed the verdicts on the live graph.
 *
 *   npx tsx scripts/case-loops/law/update-ledger-011.ts [--dry]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LEDGER = "docs/data-analysis/case-law/ledger.json";
// --batch=012 --pass=45 updates from payloads/verdicts-012/ into a totals.batch012Verdicts
// block (default 011/43). Parameterized in batch-012 instead of copied.
const BATCH = (process.argv.find((a) => a.startsWith("--batch=")) ?? "--batch=011").slice(8);
const PASS = (process.argv.find((a) => a.startsWith("--pass=")) ?? "--pass=43").slice(7);
const BATCH_NUM = Number(BATCH);
const DIR = `docs/data-analysis/case-law/payloads/verdicts-${BATCH}`;

function main() {
  const dry = process.argv.includes("--dry");
  const ledger = JSON.parse(readFileSync(LEDGER, "utf8")) as {
    rows: { cislo: number | null; forensicSeverity?: string; forensicState?: string; forensicConfidence?: number; stage?: string; batch?: number | null; verdictFile?: string }[];
    totals: Record<string, unknown>;
  };

  const files = readdirSync(DIR).filter((f) => /^verdict-\d+\.json$/.test(f)).sort();
  const patched: string[] = [];
  for (const f of files) {
    const v = JSON.parse(readFileSync(join(DIR, f), "utf8")) as { billTisk: number; severity: string; confidence: number };
    const row = ledger.rows.find((r) => r.cislo === v.billTisk);
    if (!row) throw new Error(`tisk ${v.billTisk}: no ledger row`);
    if (row.forensicState && row.batch !== BATCH_NUM) throw new Error(`tisk ${v.billTisk}: row already carries a batch-${row.batch} verdict — refusing to overwrite`);
    row.forensicSeverity = v.severity;
    row.forensicState = "pending_review";
    row.forensicConfidence = v.confidence;
    row.stage = "verdict";
    row.batch = BATCH_NUM;
    row.verdictFile = `payloads/verdicts-${BATCH}/${f}`;
    patched.push(`tisk ${v.billTisk} → ${v.severity}/conf ${v.confidence}`);
  }

  const withVerdict = ledger.rows.filter((r) => r.forensicState).length;
  ledger.totals[`batch${BATCH}Verdicts`] = {
    status: `APPLIED to live graph (pass ${PASS}) and mirrored here`,
    verdicts: files.length,
    billsWithVerdictTotal: withVerdict,
    billsPendingTotal: ledger.rows.length - withVerdict,
    note: `Batch-${BATCH} verdict wave on the pending triage head. Verdict files live under payloads/verdicts-${BATCH}/ (Czech-native, requireCzech gate).`,
  };

  if (dry) {
    console.log(`DRY: would patch ${patched.length} rows:`);
  } else {
    writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
    console.log(`patched ${patched.length} rows + totals.batch${BATCH}Verdicts:`);
  }
  for (const p of patched) console.log(`  ${p}`);
  console.log(`bills with verdict: ${withVerdict}/${ledger.rows.length}`);
}

main();
