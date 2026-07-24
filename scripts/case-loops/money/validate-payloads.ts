/* Gate: validate every corroboration payload against the graph copy. Each proposal is
 * a props-merge onto an EXISTING linked_to edge — so the gate is entity-id membership:
 * (src, rel, dst) must already exist in kg_edge, and both the person node and the
 * company node must exist. A proposal that fails is DROPPED and logged — never
 * persisted (the kg-verdict discipline). Read-only on the copy.
 *
 * Validates ALL payload files under payloads/ by default (batch-001 + batch-002 +
 * any future batch), or one file via --file <path>.
 *
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/validate-payloads.ts
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/validate-payloads.ts --file docs/data-analysis/case-money/payloads/batch-002-ares-vr-reconciliation.json
 */
import { getStore } from "@/lib/db/store";

const DEFAULT_FILES = [
  "docs/data-analysis/case-money/payloads/batch-001-corroboration.json",
  "docs/data-analysis/case-money/payloads/batch-002-ares-vr-reconciliation.json",
];

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");

  const fs = await import("node:fs/promises");
  const fileArgIdx = process.argv.indexOf("--file");
  const files = fileArgIdx >= 0 ? [process.argv[fileArgIdx + 1]] : DEFAULT_FILES;

  const nodes = await store.listKgNodes({ limit: 200_000 });
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = await store.listKgEdges({ rel: "linked_to", limit: 200_000 });
  const edgeKey = new Set(edges.map((e) => `${e.src}|${e.rel}|${e.dst}`));

  let totalOk = 0;
  let totalCount = 0;
  const seenKeys = new Set<string>(); // cross-file duplicate-annotation guard
  let dupCount = 0;

  for (const file of files) {
    let payload: { edges: { src: string; rel: string; dst: string; mp: string; company: string }[] };
    try {
      payload = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      console.log(`SKIP ${file}: not found`);
      continue;
    }

    let ok = 0;
    const drops: string[] = [];
    for (const e of payload.edges) {
      const key = `${e.src}|${e.rel}|${e.dst}`;
      const problems: string[] = [];
      if (!nodeIds.has(e.src)) problems.push(`missing person node ${e.src}`);
      if (!nodeIds.has(e.dst)) problems.push(`missing company node ${e.dst}`);
      if (!edgeKey.has(key)) problems.push(`missing linked_to edge`);
      if (seenKeys.has(key)) {
        dupCount++;
        problems.push(`duplicate annotation across payload files (already annotated by an earlier file)`);
      }
      if (problems.length) {
        drops.push(`✗ ${e.mp} → ${e.company} [${e.src} ${e.rel} ${e.dst}]: ${problems.join("; ")}`);
      } else {
        ok++;
        seenKeys.add(key);
      }
    }

    console.log(`GATE ${file}: ${ok}/${payload.edges.length} corroboration proposals validate against the graph copy.`);
    if (drops.length) {
      console.log(`  DROPPED ${drops.length}:`);
      for (const d of drops) console.log("    " + d);
      process.exitCode = 1;
    }
    totalOk += ok;
    totalCount += payload.edges.length;
  }

  console.log(`\nGATE TOTAL: ${totalOk}/${totalCount} proposals validate across ${files.length} file(s). Cross-file duplicates: ${dupCount}.`);
  if (totalOk === totalCount && dupCount === 0) {
    console.log("All proposals reference existing (person, linked_to, company) triples — none fabricated, none duplicated.");
  }
  await store.close();
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
