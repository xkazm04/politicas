/* Case ③ Law loop — batch-012 collision queue. Same derivation as prepare-batch-011.ts's
 * queue section (escalated sweep pairs minus the closed 68⊂90 family minus everything already
 * close-read in any collision-close-reads*.json — which now includes batch-011's two files),
 * ranked by genuine-§ count. Queue-only: verdict targets wait for the P3 re-triage.
 *
 *   npx tsx scripts/case-loops/law/prepare-collision-queue-012.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getStore } from "@/lib/db/store";

import { attributeCauses, pairKey, renderCauseCount, type BillRelation } from "../cause-collapse";

// --batch=013 writes batch-013-collision-queue.json etc. (default 012). Parameterized in
// batch-013 instead of copied — the retriage-009 --batch= precedent.
const BATCH = (process.argv.find((a) => a.startsWith("--batch=")) ?? "--batch=012").slice(8);
const QUEUE_SIZE = 16;
const OUT = `docs/data-analysis/case-law/payloads/batch-${BATCH}-collision-queue.json`;

function cachedTexts(cislo: number): string[] {
  const dir = `.data/law-collision-cache/tisk-${cislo}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => join(dir, f));
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const lawNodes = await store.listKgNodes({ kind: "law", limit: 100_000 });
  const lawByRef = new Map(lawNodes.map((n) => [String((n.props as Record<string, unknown>).ref), n.label]));

  const sweep = JSON.parse(readFileSync("docs/data-analysis/case-law/payloads/batch-009-collision-sweep.json", "utf8")) as {
    escalate: { lawRef: string; billA: number; billB: number; genuineParagraphs: string[]; odstavecOverlap: string[] | boolean; reason: string }[];
  };
  // The bill-level cause register, read rather than hardcoded. This used to be
  //   const closedDuplicate = (a, b) => (a === 68 && b === 90) || (a === 90 && b === 68);
  // which is one row of batch-009-duplicate-bills.json carried as a literal: the detector
  // published every relation it found and the backlog subtracted exactly one of them by hand.
  // A cause is now attributed rather than deleted — see ../cause-collapse.ts.
  const register = (JSON.parse(readFileSync("docs/data-analysis/case-law/payloads/batch-009-duplicate-bills.json", "utf8")) as { findings: BillRelation[] }).findings;
  const attributed = attributeCauses(sweep.escalate, register);
  const closedDuplicate = (a: number, b: number) => register.some((r) => pairKey(r.billA, r.billB) === pairKey(a, b) && r.relation !== "partial-overlap");
  const causeOf = new Map(attributed.rows.map((r) => [`${r.row.lawRef}::${pairKey(r.row.billA, r.row.billB)}`, r]));
  const readPairs = new Set<string>();
  const payloadDir = "docs/data-analysis/case-law/payloads";
  for (const f of readdirSync(payloadDir).filter((f) => f.startsWith("collision-close-reads") && f.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(join(payloadDir, f), "utf8")) as Record<string, unknown>;
    const pairs = (Array.isArray(raw.pairs) ? raw.pairs : []) as { billA?: number; billB?: number; lawRef?: string }[];
    for (const p of pairs) if (typeof p.billA === "number" && typeof p.billB === "number") readPairs.add(`${p.lawRef ?? "?"}::${Math.min(p.billA, p.billB)}-${Math.max(p.billA, p.billB)}`);
  }
  const unread = sweep.escalate
    .filter((p) => !closedDuplicate(p.billA, p.billB))
    .filter((p) => !readPairs.has(`${p.lawRef}::${Math.min(p.billA, p.billB)}-${Math.max(p.billA, p.billB)}`));
  const queue = unread
    .sort((a, b) => b.genuineParagraphs.length - a.genuineParagraphs.length)
    .slice(0, QUEUE_SIZE)
    .map((p) => {
      const c = causeOf.get(`${p.lawRef}::${pairKey(p.billA, p.billB)}`);
      return { ...p, lawTitle: lawByRef.get(p.lawRef) ?? null, causeId: c?.causeId ?? null, causeRelation: c?.relation ?? null, cachedTextsA: cachedTexts(p.billA), cachedTextsB: cachedTexts(p.billB) };
    });
  // `backlogRemaining` is a row count and reads as a work count, which it is not: rows sharing
  // a bill-level relation are one fact. `causeCount` is that number's predicate.
  const causeCount = { escalatedRows: attributed.rows.length, distinctCauses: attributed.distinctCauses, rowsExplainedByRelation: attributed.rowsExplainedByRelation };
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), batch: Number(BATCH), backlogRemaining: unread.length, causeCount, queued: queue.length, pairs: queue }, null, 1));
  console.log(`collision queue: ${queue.length} of ${unread.length} unread → ${OUT}`);
  console.log(`  ${renderCauseCount(attributed)}`);
  for (const q of queue) console.log(`  ${q.lawRef} · ${q.billA}×${q.billB} · §§ ${q.genuineParagraphs.join(",")}`);
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
