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
const DIR = "docs/data-analysis/case-law/payloads/verdicts-011";

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
    if (row.forensicState && row.batch !== 11) throw new Error(`tisk ${v.billTisk}: row already carries a batch-${row.batch} verdict — refusing to overwrite`);
    row.forensicSeverity = v.severity;
    row.forensicState = "pending_review";
    row.forensicConfidence = v.confidence;
    row.stage = "verdict";
    row.batch = 11;
    row.verdictFile = `payloads/verdicts-011/${f}`;
    patched.push(`tisk ${v.billTisk} → ${v.severity}/conf ${v.confidence}`);
  }

  const withVerdict = ledger.rows.filter((r) => r.forensicState).length;
  ledger.totals.batch011Verdicts = {
    status: "APPLIED to live graph (pass 43) and mirrored here",
    verdicts: files.length,
    billsWithVerdictTotal: withVerdict,
    billsPendingTotal: ledger.rows.length - withVerdict,
    note: "Batch-011 ran the audited triage head (top-9 pending by triageScoreV2 after the batch-010 sector-adjacency audit) plus the three attributed sector-adjacency survivors outside it. Verdict files live under payloads/verdicts-011/ (Czech-native, requireCzech gate).",
  };

  if (dry) {
    console.log(`DRY: would patch ${patched.length} rows:`);
  } else {
    writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
    console.log(`patched ${patched.length} rows + totals.batch011Verdicts:`);
  }
  for (const p of patched) console.log(`  ${p}`);
  console.log(`bills with verdict: ${withVerdict}/${ledger.rows.length}`);
}

main();
