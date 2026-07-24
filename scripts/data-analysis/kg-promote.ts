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
import { pathToFileURL } from "node:url";

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

// D-gap-1 (batch 004, Opus re-audit): this script's header says it "only lands the
// INTERPRETIVE layer (bloc/theme nodes, belongs_to/about edges)" — but that was never
// enforced in code. Its only gate is parseAndValidateKgVerdict's checkEnum(x.rel,
// KG_EDGE_RELS, ...), and KG_EDGE_RELS (lib/analysis/kg-verdict.ts) also lists
// `linked_to` and `supplies` — money's edges, alongside owns/sponsors/amends/
// assigned_to which belong to OTHER case loops. Those rels are all owned by their
// respective case loops' own merge-preserving ingest paths (see
// lib/analysis/kg-money.ts's mergePreservedTieProps for money's), which read the
// CURRENT props before writing. This script's toRows() does not — it builds a FRESH
// props object and hands it straight to upsertKgEdges, which is a wholesale replace
// by design (lib/db/pglite/repositories/kg.ts). An LLM-authored verdict proposing a
// `linked_to`/`supplies` edge would pass the shared enum gate and, on --commit,
// silently destroy that edge's human-gated props (review_state, corroboration,
// tie_class, reviewer_note, …) — worse than the original D1 bug, via a different
// script. Fix: this script refuses to promote any edge whose rel is one of the
// case-owned rels below; a verdict targeting one is dropped and reported, never
// upserted. This is scoped to kg-promote.ts only — it does not touch the shared
// KG_EDGE_RELS enum (other case loops' own promote/ingest paths still use those
// rels correctly, through their own merge-preserving writers).
export const CASE_OWNED_EDGE_RELS = new Set<string>(["linked_to", "supplies"]);

export function toRows(v: KgVerdict, pass: number, computedAt: string): { nodes: KgNodeRow[]; edges: KgEdgeRow[]; droppedRels: string[] } {
  const provenance = { pass, method: "verdict", ref: v.target, computedAt };
  const nodes: KgNodeRow[] = v.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    props: { rationale: n.rationale },
    firstSeenPass: pass,
    provenance,
  }));
  const droppedRels: string[] = [];
  const edges: KgEdgeRow[] = [];
  for (const e of v.edges) {
    if (CASE_OWNED_EDGE_RELS.has(e.rel)) {
      droppedRels.push(e.rel);
      continue;
    }
    edges.push({
      src: e.src,
      rel: e.rel,
      dst: e.dst,
      weight: e.weight ?? null,
      props: { rationale: e.rationale },
      provenance,
    });
  }
  return { nodes, edges, droppedRels };
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
    const { nodes, edges, droppedRels } = toRows(parsed.value, pass, computedAt);
    // A node this verdict declares becomes a valid endpoint for the NEXT file too.
    for (const n of nodes) known.add(n.id);
    allNodes.push(...nodes);
    allEdges.push(...edges);
    console.log(`  gated ${file}: +${nodes.length} nodes, +${edges.length} edges  (target: ${parsed.value.target})`);
    if (droppedRels.length > 0) {
      console.log(
        `    REFUSED ${droppedRels.length} edge(s) with case-owned rel(s) ${JSON.stringify([...new Set(droppedRels)])} — ` +
          `linked_to/supplies belong to their own case loop's merge-preserving ingest, never this generic promote path.`,
      );
    }
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

// Guard: only self-execute when run directly (npx tsx kg-promote.ts …), not when
// imported (e.g. by kg-promote.test.ts, which needs toRows()/CASE_OWNED_EDGE_RELS
// without triggering a live store connection + process.exit on import).
const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
