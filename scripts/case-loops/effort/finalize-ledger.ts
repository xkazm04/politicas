/* Case ② Effort — advance ledger.json for a finalized batch.
 *
 * Reads the gated batch props payload and flips every MP it covers to
 * stage:"signal" with that batch number and the payload's own signal score, so
 * the ledger is the resumable state the kernel says it is (a unit left at
 * "triaged" would be re-dispatched by the next batch's triage run).
 *
 * Batches 001-005 did this by hand or via the orchestrator's persist-batch run;
 * batch 006 needs it standalone because it closes the population (207/207) and
 * the coverage claim has to be checkable, not asserted.
 *
 *   npx tsx scripts/case-loops/effort/finalize-ledger.ts 6
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "docs/data-analysis/case-effort";
const batch = Number(process.argv[2]);
if (!Number.isFinite(batch)) throw new Error("usage: finalize-ledger.ts <batchNumber>");

interface Unit {
  pspId: number;
  name: string;
  stage: string;
  batch: number | null;
  signal: number | null;
  [k: string]: unknown;
}

function main() {
  const ledgerPath = `${OUT}/ledger.json`;
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as {
    batch: number;
    population: number;
    units: Unit[];
    [k: string]: unknown;
  };
  const payload = JSON.parse(readFileSync(`${OUT}/payloads/batch-${String(batch).padStart(3, "0")}-props.json`, "utf8")) as {
    proposals: { id: string; name: string; signal?: number }[];
  };

  const signalById = new Map<number, number | null>();
  for (const p of payload.proposals) signalById.set(Number(p.id.split(":").pop()), p.signal ?? null);

  let advanced = 0;
  const missing: string[] = [];
  for (const u of ledger.units) {
    if (!signalById.has(u.pspId)) continue;
    u.stage = "signal";
    u.batch = batch;
    u.signal = signalById.get(u.pspId) ?? null;
    advanced++;
  }
  for (const [pid] of signalById) {
    if (!ledger.units.some((u) => u.pspId === pid)) missing.push(String(pid));
  }

  ledger.batch = batch;
  ledger.generatedAt = new Date().toISOString();

  // Two distinct notions of "done", kept separate on purpose:
  //  · DOSSIERED  = stage !== "pending" — the army + gate have processed the unit. This is
  //    what "coverage" means for this loop, and it is what triage.ts's resume filter uses.
  //  · at "signal" = additionally flipped by a live persist. Batches 004/005 are gated and
  //    handed off but NOT yet persisted by the orchestrator, so their units legitimately
  //    sit at "triaged". Reporting only the "signal" count would understate coverage;
  //    reporting only "dossiered" would hide the outstanding persist debt. Print both.
  const dossiered = ledger.units.filter((u) => u.stage !== "pending").length;
  const atSignal = ledger.units.filter((u) => u.stage === "signal").length;
  const byStage = new Map<string, number>();
  for (const u of ledger.units) byStage.set(u.stage, (byStage.get(u.stage) ?? 0) + 1);

  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));

  console.log(`ledger.json → batch ${batch}: advanced ${advanced} units to stage "signal"`);
  if (missing.length) console.warn(`  WARNING — payload ids not present in ledger: ${missing.join(", ")}`);
  console.log(`  coverage (dossiered, stage != pending): ${dossiered}/${ledger.population}`);
  console.log(`  of which flipped to "signal" by a persist run: ${atSignal}/${ledger.population}`);
  console.log(`  stage histogram: ${[...byStage].map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  if (dossiered === ledger.population) {
    console.log(`  → POPULATION COMPLETE: all ${ledger.population} units dossiered.`);
    if (atSignal < ledger.population) {
      console.log(`     (${ledger.population - atSignal} still at "triaged" — outstanding orchestrator persist debt, not missing analysis.)`);
    }
  }
}

main();
