/* Case ③ Law loop — batch-008: set-difference proposal trigger, re-pointed at the post-N1-fix
 * census (batch-005 Q-law-11's method, unchanged — see fix-proposal-trigger.ts for the original).
 * Same set-difference logic (recordedLaws set != realLaws set, either direction), just reading the
 * batch-008 census (amends-census.ts, after the ČÁST/bare-§ splitter + footnote-block + repeal-
 * exclusion fixes) instead of the pre-fix one.
 *
 *   npx tsx scripts/case-loops/law/fix-proposal-trigger-007.ts
 * → docs/data-analysis/case-law/payloads/batch-008-amended-laws-full-proposal-v2.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const CENSUS_IN = "docs/data-analysis/case-law/payloads/batch-008-amends-census.json";
const OUT = "docs/data-analysis/case-law/payloads/batch-008-amended-laws-full-proposal-v2.json";

interface CensusRow {
  tiskId: string;
  cislo: number;
  recordedLaws: string[];
  realLaws: string[];
  undercount: number;
  structure: string;
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
      "batch-008 re-run of batch-005 Q-law-11's set-difference trigger (recordedLaws set != realLaws set, either direction) against the batch-008 census (amends-census.ts post-N1/N2 fix: ČÁST/bare-§ splitter, footnote-block detection, repeal/non-amending-title exclusion). No new fetch.",
    sourceCensus: CENSUS_IN,
    stats: {
      totalCensusRows: census.rows.length,
      oldTriggerCount: oldTrigger.length,
      newTriggerCount: newTrigger.length,
      newlyIncludedByFix: newlyIncluded.length,
    },
    newlyIncludedByFix: newlyIncluded.map((r) => ({ cislo: r.cislo, recordedLaws: r.recordedLaws, realLaws: r.realLaws, undercount: r.undercount, structure: r.structure })),
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
  console.log(`\n→ ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
