/* Gate for batch-008's one graph-write proposal (Q-money-15's live-ARES-VR flip payload).
 * Same discipline as validate-payloads.ts / validate-batch006.ts: entity-id membership,
 * edge-existence check. A proposal that fails is DROPPED and logged, never persisted.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b8 npx tsx scripts/case-loops/money/validate-batch008.ts
 */
import { getStore } from "@/lib/db/store";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const nodes = await store.listKgNodes({ limit: 200_000 });
  const nodeIds = new Set(nodes.map((n) => n.id));
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 200_000 });
  const edgeKey = new Set(linked.map((e) => `${e.src}|${e.rel}|${e.dst}`));

  let allOk = true;
  const file = "docs/data-analysis/case-money/payloads/batch-008-qmoney15-live-flips.json";
  const payload = JSON.parse(await fs.readFile(file, "utf8")) as {
    edges: { src: string; rel: string; dst: string; mp: string; company: string }[];
  };
  let ok = 0;
  const drops: string[] = [];
  for (const e of payload.edges) {
    const key = `${e.src}|${e.rel}|${e.dst}`;
    const problems: string[] = [];
    if (!nodeIds.has(e.src)) problems.push(`missing person node ${e.src}`);
    if (!nodeIds.has(e.dst)) problems.push(`missing company node ${e.dst}`);
    if (!edgeKey.has(key)) problems.push("missing linked_to edge");
    if (problems.length) drops.push(`✗ ${e.mp} → ${e.company}: ${problems.join("; ")}`);
    else ok++;
  }
  console.log(`GATE ${file}: ${ok}/${payload.edges.length} live-flip proposals validate.`);
  if (drops.length) {
    allOk = false;
    console.log(`  DROPPED ${drops.length}:`);
    for (const d of drops) console.log("    " + d);
  }

  console.log(allOk ? "\nALL batch-008 payloads validate cleanly." : "\nSOME batch-008 proposals failed validation.");
  await store.close();
  process.exit(allOk ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
