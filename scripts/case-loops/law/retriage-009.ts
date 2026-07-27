/* Case ③ Law loop — batch-009 re-triage against the APPLIED live topology.
 *
 * Closes the item deferred batch-006 P4 → 007 → 008. Per the kernel's
 * deferred-three-batches rule it could not roll a fourth time.
 *
 * WHY A SEPARATE SCRIPT FROM triage-002.ts: that script REPLACES ledger.json wholesale.
 * Re-running it would have erased every accumulated `totals.*` block (batch003Note …
 * batch008CollisionRecheck) plus the batch00{2,3,4}Note fields — the P44/D1
 * wholesale-replace failure the kernel warns about. This script recomputes the rows from
 * the SAME extracted core (triage-core.ts — no copied scoring, no drift) and MERGES:
 *   - `rows`            → fully recomputed from the live graph
 *   - `totals.<derived>`→ recomputed (bills/laws/amends/assignedTo/sectorAdjacencyHits/…)
 *   - every other `totals.*` block and every top-level field → preserved byte-identical
 *
 * The batch-008 reflection (§C) established that only ONE scoring band needs the deferred
 * §-level sector rework — `sectorAdjBand`, worth 50 000 against a churn term that reaches
 * 1 200 000. That band is recomputed here with the SAME statute-level heuristic as before
 * and is explicitly disclosed as the one stale band, rather than blocking the whole refresh.
 *
 *   PGLITE_PATH=./.pglite-copy-law-009 npx tsx scripts/case-loops/law/retriage-009.ts
 *   # add --write to persist; default is a dry-run diff
 */
import { readFileSync, writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

import { computeTriage, type PriorRow, type TriageRow } from "./triage-core";

const LEDGER = "docs/data-analysis/case-law/ledger.json";
const WRITE = process.argv.includes("--write");
/** Which batch is re-running this, for the ledger's `source` provenance line. The script itself
 * is batch-agnostic — it is the merge-preserving re-triage, reused by every later batch rather
 * than copied into a new `*-NNN.ts` (the copy-drift class batch-008 named). */
const BATCH = (process.argv.find((a) => a.startsWith("--batch=")) ?? "--batch=009").slice(8);

interface Ledger {
  totals: Record<string, unknown>;
  rows: TriageRow[];
  [k: string]: unknown;
}

/** The derived totals keys this script owns. Every OTHER key under `totals` is a
 * hand-written batch block and is preserved untouched — that separation is the whole
 * point of this script existing. */
const DERIVED_TOTALS = [
  "bills",
  "laws",
  "amends",
  "assignedTo",
  "sectorAdjacencyHits",
  "municipalSoeExcludedBills",
  "existingForensic",
  "collisionCandidateGroups",
  "collisionCandidateBills",
] as const;

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");

  const prior = JSON.parse(readFileSync(LEDGER, "utf8")) as Ledger;
  const priorByBill = new Map<string, PriorRow>(prior.rows.map((r) => [r.billNodeId, r]));

  const { rows, counts } = await computeTriage(store, priorByBill);

  // ---- report the delta this refresh actually makes (the batch-008 reflection's §C table) ----
  const priorRowById = new Map(prior.rows.map((r) => [r.billNodeId, r]));
  const moved = rows.filter((r) => {
    const p = priorRowById.get(r.billNodeId);
    return !p || p.triageScoreV2 !== r.triageScoreV2 || p.amendsCount !== r.amendsCount || p.maxTargetChurn !== r.maxTargetChurn;
  });
  console.log(`Case ③ batch-009 re-triage · ${rows.length} bills · ${moved.length} rows moved`);
  console.log("\nDerived totals (prior → live):");
  for (const k of DERIVED_TOTALS) console.log(`  ${k.padEnd(26)} ${String(prior.totals[k] ?? "—").padStart(6)} → ${String(counts[k]).padStart(6)}`);

  const zeroBefore = prior.rows.filter((r) => r.amendsCount === 0).length;
  const zeroAfter = rows.filter((r) => r.amendsCount === 0).length;
  console.log(`\nBills with ZERO amends edges: ${zeroBefore} → ${zeroAfter}`);

  console.log("\nTop 10 pending by refreshed triageScoreV2:");
  rows
    .filter((r) => !r.forensicState)
    .slice(0, 10)
    .forEach((r, i) => {
      const p = priorRowById.get(r.billNodeId);
      const delta = p ? r.triageScoreV2 - p.triageScoreV2 : r.triageScoreV2;
      console.log(
        `  ${String(i + 1).padStart(2)}  tisk ${String(r.cislo ?? r.tiskId).padStart(4)}  churn ${String(r.maxTargetChurn).padStart(2)}  amends ${String(r.amendsCount).padStart(2)}  score ${String(r.triageScoreV2).padStart(9)} (${delta >= 0 ? "+" : ""}${delta})  ${r.title.slice(0, 48)}`,
      );
    });

  // the bills the batch-008 reflection named as demonstrably stale — a targeted check
  console.log("\nBatch-008 reflection §C spot-check (the bills its own findings centred on):");
  for (const cislo of [7, 90, 102, 111, 207, 213]) {
    const now = rows.find((r) => r.cislo === cislo);
    const was = prior.rows.find((r) => r.cislo === cislo);
    if (!now || !was) continue;
    console.log(
      `  tisk ${String(cislo).padStart(3)}  amends ${was.amendsCount}→${now.amendsCount}  churn ${was.maxTargetChurn}→${now.maxTargetChurn}  score ${was.triageScoreV2}→${now.triageScoreV2}`,
    );
  }

  if (!WRITE) {
    console.log("\n(dry run — pass --write to persist the merge)");
    await store.close();
    return;
  }

  // ---- merge-preserving write ----
  const preservedKeys = Object.keys(prior.totals).filter((k) => !(DERIVED_TOTALS as readonly string[]).includes(k));
  const next: Ledger = {
    ...prior,
    generatedAt: new Date().toISOString(),
    source: `PGLITE_PATH copy of the LIVE graph (read-only) — batch-${BATCH} re-triage`,
    totals: { ...prior.totals, ...counts },
    rows,
  };
  writeFileSync(LEDGER, JSON.stringify(next, null, 1));
  console.log(`\n→ wrote ${LEDGER}`);
  console.log(`   rows recomputed: ${rows.length}`);
  console.log(`   derived totals refreshed: ${DERIVED_TOTALS.length}`);
  console.log(`   hand-written totals blocks preserved: ${preservedKeys.length} (${preservedKeys.join(", ")})`);
  await store.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
