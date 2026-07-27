/* Case ③ Law loop — batch-009: bill-level DUPLICATE / CONTAINMENT detection.
 *
 * WHY. The sweep escalated 83 pairs, and reading the escalated list surfaced a shape the
 * pair-by-pair method structurally cannot see: tisk 68 and tisk 90 appear together on FIVE
 * different statutes (23/2017 with 27 shared §s, 250/2000, 218/2000, 159/2006, …). Read as five
 * independent pairs that is five separate coordination findings. Read at the bill level it is
 * ONE fact — the two prints carry the same reform — and the right unit of analysis is the bill,
 * not the pair.
 *
 * This case has hit that shape three times without naming it: batch-004's 12↔131 ("near-verbatim
 * word-for-word identical"), batch-004's 140↔141 ("two competing drafts of the same regional
 * initiative"), batch-009's 68↔90 on 159/2006. Each was found by reading one statute's overlap
 * and each was written up as a statute-specific finding.
 *
 * METHOD — deterministic, no model. Extract each bill's numbered novelization instructions
 * ("12. V § 14b odst. 1 písm. a) se text „o)“ nahrazuje textem „p)“") from its cached operative
 * text, normalize, and compare the SETS. Two measures, because they answer different questions:
 *
 *   Jaccard          symmetric — are these the same bill?
 *   containment(A→B) |A∩B|/|A| — is A's whole reform carried inside B? This is the one that
 *                    matters here: a small targeted bill can be wholly absorbed by a larger one,
 *                    and Jaccard hides that behind the size difference (68↔90 is 48% Jaccard but
 *                    86% containment of 68 in 90).
 *
 * Instruction-set identity is a strong claim, so it is made only on verbatim normalized matches —
 * no fuzzy similarity, nothing a model judged.
 *
 *   npx tsx scripts/case-loops/law/duplicate-bills-009.ts [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { operativeSlice, readCachedBillText } from "./collision-core";

const PAYLOADS = "docs/data-analysis/case-law/payloads";
const WRITE = process.argv.includes("--write");
/** Containment at or above this is reported as a finding. Set from the observed distribution:
 * genuine pairs sit at 0.25–0.86, every unrelated control pair measured 0.00. */
const MIN_CONTAINMENT = 0.25;
/** Below this many instructions the ratio is noise (2 of 2 shared is not evidence). */
const MIN_INSTRUCTIONS = 4;

const norm = (s: string) => s.normalize("NFC").replace(/[„“”]/g, '"').replace(/\s+/g, " ").trim();

/** A bill's numbered novelization instructions as a set of normalized strings. Anchored on the
 * "N. V § …" item form, which is how Czech drafting numbers every amending instruction. */
function instructions(cislo: number): string[] {
  const raw = readCachedBillText(cislo);
  if (!raw) return [];
  const t = norm(operativeSlice(raw));
  return [...new Set([...t.matchAll(/\d+\.\s(V\s*§[^]{0,160}?)(?=\s\d+\.\s|$)/gu)].map((m) => m[1].trim()))];
}

interface RankedPair {
  lawRef: string;
  billA: number;
  billB: number;
}
const report = JSON.parse(readFileSync(join(PAYLOADS, "collision-report-v2-008.json"), "utf8")) as { rankedPairs: RankedPair[] };

// Every bill that appears in any candidate pair — the population worth comparing.
const bills = [...new Set(report.rankedPairs.flatMap((p) => [p.billA, p.billB]))].sort((a, b) => a - b);
const instrByBill = new Map<number, string[]>();
for (const b of bills) instrByBill.set(b, instructions(b));

// Only compare bills that actually co-occur in a candidate pair — comparing all 117×117 would
// invent relationships between bills that never touch the same statute.
const coOccurring = new Set<string>();
for (const p of report.rankedPairs) {
  const [a, b] = [p.billA, p.billB].sort((m, n) => m - n);
  coOccurring.add(`${a}-${b}`);
}

interface Finding {
  billA: number;
  billB: number;
  instructionsA: number;
  instructionsB: number;
  shared: number;
  jaccard: number;
  containmentAinB: number;
  containmentBinA: number;
  relation: "duplicate" | "containment" | "partial-overlap";
  statutesSharedInCandidates: string[];
  sampleSharedInstructions: string[];
}

const findings: Finding[] = [];
for (const key of coOccurring) {
  const [a, b] = key.split("-").map(Number);
  const ia = instrByBill.get(a) ?? [];
  const ib = instrByBill.get(b) ?? [];
  if (ia.length < MIN_INSTRUCTIONS || ib.length < MIN_INSTRUCTIONS) continue;
  const setB = new Set(ib);
  const shared = ia.filter((x) => setB.has(x));
  if (shared.length === 0) continue;
  const union = new Set([...ia, ...ib]).size;
  const cA = shared.length / ia.length;
  const cB = shared.length / ib.length;
  if (Math.max(cA, cB) < MIN_CONTAINMENT) continue;
  const jac = shared.length / union;
  findings.push({
    billA: a,
    billB: b,
    instructionsA: ia.length,
    instructionsB: ib.length,
    shared: shared.length,
    jaccard: Number(jac.toFixed(3)),
    containmentAinB: Number(cA.toFixed(3)),
    containmentBinA: Number(cB.toFixed(3)),
    relation: jac >= 0.8 ? "duplicate" : Math.max(cA, cB) >= 0.6 ? "containment" : "partial-overlap",
    statutesSharedInCandidates: [...new Set(report.rankedPairs.filter((p) => (p.billA === a && p.billB === b) || (p.billA === b && p.billB === a)).map((p) => p.lawRef))].sort(),
    sampleSharedInstructions: shared.slice(0, 3),
  });
}
findings.sort((x, y) => Math.max(y.containmentAinB, y.containmentBinA) - Math.max(x.containmentAinB, x.containmentBinA));

console.log(`Case ③ batch-009 duplicate/containment detection · ${bills.length} bills, ${coOccurring.size} co-occurring pairs\n`);
console.log(`Findings at containment ≥ ${MIN_CONTAINMENT} (both bills ≥ ${MIN_INSTRUCTIONS} instructions):\n`);
for (const f of findings) {
  console.log(
    `  ${f.relation.padEnd(15)} tisk ${String(f.billA).padStart(3)} (${String(f.instructionsA).padStart(4)} instr) × ${String(f.billB).padStart(3)} (${String(f.instructionsB).padStart(4)})  shared ${String(f.shared).padStart(3)}  ·  ${(f.containmentAinB * 100).toFixed(0)}% of A in B, ${(f.containmentBinA * 100).toFixed(0)}% of B in A  ·  Jaccard ${(f.jaccard * 100).toFixed(0)}%`,
  );
  console.log(`                  statutes both touch in candidates: ${f.statutesSharedInCandidates.join(", ")}`);
}
if (findings.length === 0) console.log("  (none)");

const pairsExplained = findings.reduce((n, f) => n + f.statutesSharedInCandidates.length, 0);
console.log(`\n${findings.length} bill-level relations explain ${pairsExplained} candidate pairs that the pair-by-pair method would have read as independent findings.`);

if (WRITE) {
  writeFileSync(
    join(PAYLOADS, "batch-009-duplicate-bills.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          "Verbatim set comparison of each bill's numbered novelization instructions ('N. V § …'), extracted from cached operative text, NFC-normalized and whitespace-collapsed. No fuzzy similarity and no model judgement — a shared instruction is a byte-identical normalized string. Only bills that co-occur in a candidate pair are compared.",
        measures:
          "Jaccard answers 'are these the same bill'; containment(A→B) = |A∩B|/|A| answers 'is A's whole reform carried inside B'. The second is the one that matters: a small targeted bill can be wholly absorbed by a larger one, which Jaccard hides behind the size difference.",
        thresholds: { minContainment: MIN_CONTAINMENT, minInstructions: MIN_INSTRUCTIONS },
        interpretation:
          "A drafting-process finding, never an ethics one. Two prints carrying the same instructions are most plausibly competing drafts, a re-filing, or one bill absorbing another's text — all normal legislative practice. What it means for THIS case is methodological: the unit of analysis for these pairs is the BILL, not the pair, and reading them statute-by-statute multiplies one fact into many.",
        findings,
        pairsExplained,
      },
      null,
      1,
    ),
  );
  console.log(`\n→ wrote ${PAYLOADS}/batch-009-duplicate-bills.json`);
}
