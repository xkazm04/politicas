// Orchestrator one-shot: recover the per-claim CITATIONS that batches 001–005
// collected and `persist-batch.ts` silently dropped (it merged `props` only —
// fixed 2026-07-25, this script recovers the history).
//
// CITATIONS ONLY. It reads each payload's `citations` array and writes nothing
// else — deliberately, because some payloads' `props` were withheld at persist
// time on review grounds (batch-003's money sentences, held back per the Opus
// money-crossover verification). Re-merging whole payloads would silently
// resurrect them; merging only citations cannot.
//
// Union-with-dedupe in batch order, so a later batch's re-verified citation set
// adds to rather than replaces an earlier one.
//
//   npx tsx scripts/case-loops/backfill-citations.ts [--ns=effort] [--commit]
//     PGLITE_PATH governs the target; --commit without it refuses (live guard).

import { readFileSync } from "node:fs";
import { getStore } from "../../lib/db/store";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const flag = (k: string) => process.argv.includes(`--${k}`);

/** Merged per-batch payloads, oldest first. Group files are subsets — skipped. */
const SOURCES = [
  "case-effort/payloads/batch-001-props.json",
  "case-effort/payloads/batch-002-props.json",
  "case-effort/payloads/batch-003-props.json",
  "case-effort/payloads/batch-004-props.json",
  "case-effort/payloads/batch-004-rewrites.json",
  "case-effort/payloads/batch-005-props.json",
];

async function main() {
  const ns = arg("ns") ?? "effort";
  const commit = flag("commit");
  if (commit && !process.env.PGLITE_PATH && !flag("confirm-live")) {
    console.error("REFUSED: --commit with PGLITE_PATH unset targets the LIVE ./.pglite. Pass --confirm-live if intentional.");
    process.exit(1);
  }

  // nodeId → citations, deduped on canonical JSON so a repeated source lands once.
  const byNode = new Map<string, { list: unknown[]; seen: Set<string> }>();
  for (const rel of SOURCES) {
    let payload: { proposals?: { id: string; citations?: unknown[] }[] };
    try {
      payload = JSON.parse(readFileSync(`docs/data-analysis/${rel}`, "utf8"));
    } catch (err) {
      console.warn(`  skip ${rel} (unreadable)`, err instanceof Error ? err.message : err);
      continue;
    }
    let added = 0;
    for (const p of payload.proposals ?? []) {
      if (!Array.isArray(p.citations) || p.citations.length === 0) continue;
      const slot = byNode.get(p.id) ?? { list: [], seen: new Set<string>() };
      for (const c of p.citations) {
        const key = JSON.stringify(c);
        if (slot.seen.has(key)) continue;
        slot.seen.add(key);
        slot.list.push(c);
        added++;
      }
      byNode.set(p.id, slot);
    }
    console.log(`  ${rel}: +${added} new citations`);
  }

  const store = await getStore();
  if (!store) throw new Error("no store");
  const nodes = await store.listKgNodes({});
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const merged = [];
  let missing = 0;
  for (const [id, slot] of byNode) {
    const n = byId.get(id);
    if (!n) { missing++; continue; } // never insert — the payload's node must already exist
    merged.push({ ...n, props: { ...n.props, [`${ns}_citations`]: slot.list } });
  }
  const total = [...byNode.values()].reduce((s, v) => s + v.list.length, 0);
  console.log(`\n${merged.length} nodes carry ${total} deduped citations${missing ? ` (${missing} payload nodes not in graph — skipped)` : ""}`);

  if (commit) {
    console.log(`COMMITTED: ${await store.upsertKgNodes(merged)} nodes`);
  } else {
    console.log("DRY-RUN — add --commit to write.");
  }
  await store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
