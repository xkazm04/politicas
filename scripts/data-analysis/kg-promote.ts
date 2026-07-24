/* Promote GATED knowledge-graph verdicts into the graph (tier 2) — the KG analogue
 * of promote-verdicts.ts. Reads one verdict file (--verdict) or a directory of them
 * (--verdicts), RE-RUNS THE GATE against the live graph (schema + entity-id
 * membership), and upserts the surviving nodes/edges into kg_node/kg_edge with
 * provenance {method:"verdict"}. Drifted or fabricated verdicts are reported and
 * skipped — never persisted.
 *
 * The deterministic edges (co_votes_with, rebels_against, influential_in) are NOT
 * written here — kg-compute owns those. This script only lands the INTERPRETIVE
 * layer (bloc/theme nodes, belongs_to/about edges) a subagent proposed.
 *
 * DEFAULT DRY-RUN. Pass --commit to write. PGlite is single-connection — no dev
 * server may hold ./.pglite during a --commit.
 *
 *   npx tsx scripts/data-analysis/kg-promote.ts --verdict=verdict.json --pass=2
 *   npx tsx scripts/data-analysis/kg-promote.ts --verdicts=./.kg-analysis/verdicts --pass=2 --commit
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { getStore } from "@/lib/db/store";
import { parseAndValidateKgVerdict, type KgVerdict } from "@/lib/analysis/kg-verdict";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function verdictFiles(): string[] {
  const single = arg("verdict");
  const dir = arg("verdicts");
  const files: string[] = [];
  if (single) files.push(single);
  if (dir && existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json") || f.endsWith(".txt"))) files.push(join(dir, f));
  }
  return files;
}

function toRows(v: KgVerdict, pass: number, computedAt: string): { nodes: KgNodeRow[]; edges: KgEdgeRow[] } {
  const provenance = { pass, method: "verdict", ref: v.target, computedAt };
  const nodes: KgNodeRow[] = v.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    props: { rationale: n.rationale },
    firstSeenPass: pass,
    provenance,
  }));
  const edges: KgEdgeRow[] = v.edges.map((e) => ({
    src: e.src,
    rel: e.rel,
    dst: e.dst,
    weight: e.weight ?? null,
    props: { rationale: e.rationale },
    provenance,
  }));
  return { nodes, edges };
}

async function main() {
  const pass = Number(arg("pass", "0"));
  const commit = process.argv.includes("--commit");
  const computedAt = new Date().toISOString();
  const files = verdictFiles();
  if (files.length === 0) {
    console.error("no verdicts — pass --verdict=<file> or --verdicts=<dir>");
    process.exit(1);
  }
  if (!Number.isInteger(pass) || pass < 1) {
    console.error("pass must be a positive integer — pass --pass=<n>");
    process.exit(1);
  }

  const store = await getStore();
  if (!store) {
    console.error("no store");
    process.exit(1);
  }

  // Known ids = existing kg_node ids + raw entity urns (the membership gate base).
  const known = new Set<string>();
  for (const n of await store.listKgNodes()) known.add(n.id);
  for (const p of await store.listPersons()) known.add(p.id);
  for (const o of await store.listOrgans()) known.add(o.id);
  for (const v of await store.listVoteEvents()) known.add(v.id);

  const allNodes: KgNodeRow[] = [];
  const allEdges: KgEdgeRow[] = [];
  let gated = 0;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const parsed = parseAndValidateKgVerdict(text, { knownIds: known });
    if (!parsed.ok || !parsed.value) {
      console.log(`\n  DRIFT in ${file} — skipped:`);
      for (const e of parsed.errors.slice(0, 6)) console.log(`    • ${e}`);
      continue;
    }
    gated++;
    const { nodes, edges } = toRows(parsed.value, pass, computedAt);
    // A node this verdict declares becomes a valid endpoint for the NEXT file too.
    for (const n of nodes) known.add(n.id);
    allNodes.push(...nodes);
    allEdges.push(...edges);
    console.log(`  gated ${file}: +${nodes.length} nodes, +${edges.length} edges  (target: ${parsed.value.target})`);
  }

  console.log(`\n${gated}/${files.length} verdicts passed the gate → ${allNodes.length} nodes, ${allEdges.length} edges`);
  if (!commit) {
    console.log("\nDRY-RUN — pass --commit to upsert into kg_node/kg_edge.");
    await store.close();
    return;
  }
  const wroteNodes = await store.upsertKgNodes(allNodes);
  const wroteEdges = await store.upsertKgEdges(allEdges);
  console.log(
    `\ncommitted: ${wroteNodes} nodes · ${wroteEdges} edges → ` +
      `kg_node=${await store.countKgNodes()} kg_edge=${await store.countKgEdges()} ${JSON.stringify(await store.countKgEdgesByRel())}`,
  );
  await store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
