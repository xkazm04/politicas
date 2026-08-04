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

const QUEUE_SIZE = 16;
const OUT = "docs/data-analysis/case-law/payloads/batch-012-collision-queue.json";

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
  const closedDuplicate = (a: number, b: number) => (a === 68 && b === 90) || (a === 90 && b === 68);
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
    .map((p) => ({ ...p, lawTitle: lawByRef.get(p.lawRef) ?? null, cachedTextsA: cachedTexts(p.billA), cachedTextsB: cachedTexts(p.billB) }));
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), batch: 12, backlogRemaining: unread.length, queued: queue.length, pairs: queue }, null, 1));
  console.log(`collision queue: ${queue.length} of ${unread.length} unread → ${OUT}`);
  for (const q of queue) console.log(`  ${q.lawRef} · ${q.billA}×${q.billB} · §§ ${q.genuineParagraphs.join(",")}`);
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
