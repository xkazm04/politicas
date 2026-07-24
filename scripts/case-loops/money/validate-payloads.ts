/* Gate: validate every batch-001 corroboration payload against the graph copy.
 * Each proposal is a props-merge onto an EXISTING linked_to edge — so the gate is
 * entity-id membership: (src, rel, dst) must already exist in kg_edge, and both the
 * person node and the company node must exist. A proposal that fails is DROPPED and
 * logged — never persisted (the kg-verdict discipline). Read-only on the copy.
 *
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/validate-payloads.ts
 */
import { getStore } from "@/lib/db/store";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");

  const fs = await import("node:fs/promises");
  const payload = JSON.parse(
    await fs.readFile("docs/data-analysis/case-money/payloads/batch-001-corroboration.json", "utf8"),
  ) as { edges: { src: string; rel: string; dst: string; mp: string; company: string }[] };

  const nodes = await store.listKgNodes({ limit: 200_000 });
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = await store.listKgEdges({ rel: "linked_to", limit: 200_000 });
  const edgeKey = new Set(edges.map((e) => `${e.src}|${e.rel}|${e.dst}`));

  let ok = 0;
  const drops: string[] = [];
  for (const e of payload.edges) {
    const problems: string[] = [];
    if (!nodeIds.has(e.src)) problems.push(`missing person node ${e.src}`);
    if (!nodeIds.has(e.dst)) problems.push(`missing company node ${e.dst}`);
    if (!edgeKey.has(`${e.src}|${e.rel}|${e.dst}`)) problems.push(`missing linked_to edge`);
    if (problems.length) {
      drops.push(`✗ ${e.mp} → ${e.company} [${e.src} ${e.rel} ${e.dst}]: ${problems.join("; ")}`);
    } else {
      ok++;
    }
  }

  console.log(`GATE: ${ok}/${payload.edges.length} corroboration proposals validate against the graph copy.`);
  if (drops.length) {
    console.log(`DROPPED ${drops.length}:`);
    for (const d of drops) console.log("  " + d);
    process.exitCode = 1;
  } else {
    console.log("All proposals reference existing (person, linked_to, company) triples — none fabricated.");
  }
  await store.close();
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
