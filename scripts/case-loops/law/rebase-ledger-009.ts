/* Case ③ Law loop — batch-009 ledger prose re-base.
 *
 * `retriage-009.ts` refreshed the DERIVED numbers. This script fixes the hand-written prose
 * blocks that still describe a graph superseded on 2026-07-25 (commit 257e723, pass 30) and
 * again by batch-008's F1/F2 apply. The batch-008 reflection (§B/§E) enumerated these; the
 * live graph verified this batch reads 577 `amends` edges / 288 `law` nodes.
 *
 * Every edit is additive-or-corrective on a NAMED key — no block is dropped, and each
 * correction carries a `batch009Correction` note saying what it used to claim and why that
 * was wrong, per the case's disclose-don't-silently-edit discipline.
 *
 *   npx tsx scripts/case-loops/law/rebase-ledger-009.ts [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";

const LEDGER = "docs/data-analysis/case-law/ledger.json";
const WRITE = process.argv.includes("--write");

type Block = Record<string, unknown>;
interface Ledger {
  totals: Record<string, unknown>;
  rows: unknown[];
  [k: string]: unknown;
}

const l = JSON.parse(readFileSync(LEDGER, "utf8")) as Ledger;
const t = l.totals;
const changes: string[] = [];

function patch(key: string, mut: (b: Block) => void, what: string) {
  const b = t[key] as Block | undefined;
  if (!b || typeof b !== "object") {
    console.warn(`  ! totals.${key} missing — skipped (not fabricating a block)`);
    return;
  }
  mut(b);
  changes.push(`totals.${key}: ${what}`);
}

// 1. amendsRegenPrepared — claimed "still NOT applied to live graph". It IS applied.
patch(
  "amendsRegenPrepared",
  (b) => {
    b.status =
      "APPLIED to the live graph. batch-005 prepared 567 edges; batch-007 applied 581 (commit 257e723, pass 30, 2026-07-25); batch-008's F1 (+1) and F2 (−5) landed on top. Live today: 577 amends edges / 288 law nodes, verified by direct read this batch.";
    b.edgesLiveNow = 577;
    b.lawNodesLiveNow = 288;
    b.batch009Correction =
      "This block read 'still NOT applied to live graph' through batches 006–008 while the regeneration had in fact been applied on 2026-07-25. The batch-008 reflection (§B) flagged it as the most operationally misleading stale field in the case — an orchestrator reading it alongside edgeCountDelta:427 would reasonably have re-applied 577 edges wholesale onto an already-regenerated graph. Corrected batch-009 against a live read.";
  },
  "status corrected NOT-applied → APPLIED (577 live edges)",
);

// 2. collisionPairsCloseRead — a running total that stopped running after batch-004.
const priorTotal = t.collisionPairsCloseRead;
t.collisionPairsCloseRead = {
  total: 65,
  batch009Correction: `This key was the scalar ${String(priorTotal)} — batch-004's figure, never incremented for batch-005's +15 or batch-008's +12. Restated as a per-batch breakdown so it cannot silently fall behind again.`,
  byBatch: { "001_002": 2, "003": 12, "004": 24, "005": 15, "008": 12 },
  note: "65 close-reads over 63 distinct pairs (two pairs were re-read on a later topology). Not all remain live candidates: pair identity does not survive a topology change cleanly, so the batch-008 partitioned universe counts its own coverage separately — see batch008CollisionRecheck.",
};
changes.push(`totals.collisionPairsCloseRead: scalar ${String(priorTotal)} → per-batch breakdown, total 65`);

// 3. batch008ReTriage — the deferred item; record that batch-009 landed it.
patch(
  "batch008ReTriage",
  (b) => {
    b.closedByBatch009 =
      "DONE. scripts/case-loops/law/retriage-009.ts recomputed all 141 rows against the live 577-edge topology: 110 rows moved, 14 bills left the amendsCount=0 state (25 → 11), sectorAdjacencyHits 5 → 12, collisionCandidateGroups 29 → 150. The scoring was EXTRACTED to triage-core.ts rather than copied, so triage-002.ts and retriage-009.ts cannot drift; the write is merge-preserving (all 19 hand-written totals blocks kept byte-identical), because triage-002.ts's own writer replaces ledger.json wholesale and would have erased them (P44/D1).";
    b.remainingStaleBand =
      "sectorAdjBand ONLY (50 000 of a top score of 1 273 500 — under 4%). Sector-adjacency is still computed against a bill's WHOLE amended-law set rather than per amended SECTION, per the standing batch-004 warning. That §-level rework is the one genuinely deferred piece; every other band (severity, churn, money, amends) is now live-accurate.";
    b.deferralHistory =
      "Carried batch-006 P4 → 007 → 008. The kernel's deferred-three-batches rule forbade a fourth roll; batch-009 landed it.";
  },
  "deferred re-triage recorded as closed by batch-009",
);

// 4. collisionBacklog72Pairs — its "reopens ~5x once Q-law-8 regen is applied" is now history.
patch(
  "collisionBacklog72Pairs",
  (b) => {
    b.batch009Correction =
      "The predicted reopening HAPPENED: the regen is applied (see amendsRegenPrepared) and the candidate universe went 29 → 150 groups. These 38-pair counts describe the retired 150-edge topology and are kept only as history — the live backlog is batch008CollisionRecheck's 176 partitioned pairs.";
  },
  "marked as retired-topology history",
);

// 5. A batch-009 block of its own.
t.batch009ReTriage = {
  status: "DONE — all 141 rows recomputed against the live applied topology",
  method:
    "scripts/case-loops/law/retriage-009.ts over a read-only copy (.pglite-copy-law-009) of the live store, using the scoring extracted to triage-core.ts (shared with triage-002.ts — extracted, not copied, so the two cannot drift)",
  rowsMoved: 110,
  billsLeavingZeroAmends: "25 → 11",
  derivedTotalsRefreshed: ["laws 101→288", "amends 150→577", "sectorAdjacencyHits 5→12", "existingForensic 19→27", "collisionCandidateGroups 29→150", "collisionCandidateBills 71→117"],
  preservedBlocks: 19,
  churnTop: "40/2009 at churn 12 now heads the ranking; the top-10 pending head is tisk 64, 67, 7, 102, 213, 14, 189, 77, 69, 56",
};
changes.push("totals.batch009ReTriage: added");

console.log(`Case ③ batch-009 ledger re-base · ${changes.length} changes`);
for (const c of changes) console.log(`  · ${c}`);

if (!WRITE) {
  console.log("\n(dry run — pass --write to persist)");
} else {
  writeFileSync(LEDGER, JSON.stringify(l, null, 1));
  console.log(`\n→ wrote ${LEDGER} (totals keys: ${Object.keys(t).length}, rows: ${l.rows.length})`);
}
