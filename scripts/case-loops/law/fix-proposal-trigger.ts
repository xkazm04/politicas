/* Case ③ Law loop — batch-005 Q-law-11: set-difference proposal trigger (was count-based).
 *
 * amends-census.ts's PROPOSAL_OUT (amended-laws-full-proposal.json) only emits a census_full
 * proposal row for bills with `undercount > 0` (real citation count > recorded count). The
 * batch-004 reflection found this blind to bills whose title and body citation SETS are
 * completely disjoint but happen to have undercount <= 0: tisk 219 (recorded 301/1992, real
 * 354/2019, undercount 0), 222 (134/2016 vs 9/2002, undercount 0), 243 (223/2016 vs 240/2000,
 * undercount 0) — same count, wrong statute. This script re-derives the proposal from the SAME
 * already-fetched `amends-census.json` (no new PDF fetches — the census's `realLaws`/
 * `recordedLaws` rows already hold everything needed) using a set-difference trigger (recorded
 * set != real set, in EITHER direction) instead of the count-based one. Strictly a superset of
 * the old 53-bill trigger (any undercount>0 row also has a set difference) plus the disjoint/
 * subset cases the count missed.
 *
 *   npx tsx scripts/case-loops/law/fix-proposal-trigger.ts
 * → docs/data-analysis/case-law/payloads/amended-laws-full-proposal-v2.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const CENSUS_IN = "docs/data-analysis/case-law/payloads/amends-census.json";
const OUT = "docs/data-analysis/case-law/payloads/amended-laws-full-proposal-v2.json";

interface CensusRow {
  tiskId: string;
  cislo: number;
  recordedLaws: string[];
  realLaws: string[];
  undercount: number;
}
interface CensusFile {
  rows: CensusRow[];
}

function setEq(a: string[], b: string[]): boolean {
  return [...a].sort().join(",") === [...b].sort().join(",");
}

async function main() {
  const census: CensusFile = JSON.parse(readFileSync(CENSUS_IN, "utf8"));
  const oldTrigger = census.rows.filter((r) => r.undercount > 0);
  const newTrigger = census.rows.filter((r) => !setEq(r.recordedLaws, r.realLaws));
  const newlyIncluded = newTrigger.filter((r) => r.undercount <= 0);

  const proposal = {
    generatedAt: new Date().toISOString(),
    method:
      "batch-005 Q-law-11 fix: set-difference trigger (recordedLaws set != realLaws set, either direction) instead of amends-census.ts's original count-based (undercount > 0) trigger. Same source data (amends-census.json), no new fetch. Strictly a superset: every undercount>0 row is also a set-difference row; adds rows where the sets differ but the COUNT happens to match or be lower (disjoint-statute or subset cases the count-based trigger structurally cannot see).",
    sourceCensus: CENSUS_IN,
    stats: {
      totalCensusRows: census.rows.length,
      oldTriggerCount: oldTrigger.length,
      newTriggerCount: newTrigger.length,
      newlyIncludedByFix: newlyIncluded.length,
    },
    newlyIncludedByFix: newlyIncluded.map((r) => ({ cislo: r.cislo, recordedLaws: r.recordedLaws, realLaws: r.realLaws, undercount: r.undercount })),
    proposals: newTrigger.map((r) => ({
      billNodeId: r.tiskId,
      cislo: r.cislo,
      amended_laws_full: r.realLaws,
      recordedLaws: r.recordedLaws,
      undercount: r.undercount,
    })),
  };

  writeFileSync(OUT, JSON.stringify(proposal, null, 1), "utf8");
  console.log(`census rows: ${census.rows.length}`);
  console.log(`old (count>0) trigger: ${oldTrigger.length} bills`);
  console.log(`new (set-difference) trigger: ${newTrigger.length} bills (+${newlyIncluded.length} newly included)`);
  console.log(`newly included (undercount <= 0 but sets differ):`);
  for (const r of newlyIncluded) console.log(`  tisk ${r.cislo}: recorded [${r.recordedLaws.join(", ")}] vs real [${r.realLaws.join(", ")}] (undercount ${r.undercount})`);
  console.log(`\n→ ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
