/* Promote GATED knowledge-graph verdicts into the graph (tier 2) — the KG analogue
 * of promote-verdicts.ts. Reads one verdict file (--verdict) or a directory of them
 * (--verdicts), RE-RUNS THE GATE against the live graph (schema + entity-id
 * membership), and upserts the surviving nodes/edges into kg_node/kg_edge with
 * provenance {method:"verdict"}. Drifted or fabricated verdicts are reported and
 * skipped — never persisted.
 *
 * The deterministic edges (co_votes_with, rebels_against, influential_in) are NOT
 * written here — kg-compute owns those. This script only lands the INTERPRETIVE
 * layer (bloc/theme nodes, belongs_to/about edges) a subagent proposed — and since
 * 2026-08-13 that sentence is ENFORCED ON BOTH HALVES, not just asserted:
 * `CASE_OWNED_EDGE_RELS` refuses another loop's rels (2026-07-24) and
 * `CASE_OWNED_NODE_KINDS` refuses another loop's node kinds. Both are refusals with a
 * printed reason, never a silent drop.
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
import { KG_NODE_KINDS, parseAndValidateKgVerdict, type KgVerdict } from "@/lib/analysis/kg-verdict";
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

// D5 (2026-08-13): the edge half of that fix left the NODE half open, and the node
// half is worse. `toRows` builds `props: { rationale: n.rationale }` for ANY declared
// node id, and the only kind gate is the shared `KG_NODE_KINDS` enum — which admits
// person, party, organ, company, contract, bill, law and notice. So a verdict
// declaring `psp:person:6790` passed the gate and, on --commit, replaced that MP's
// props with `{rationale}` alone: contribution_score, the six components,
// contribution_psp9, every effort_* dossier field — gone, exactly as the edge case
// would have destroyed a human-gated tie's review state. A bill node would have lost
// its summary_cz and all forensic_* verdicts; a company node its money layer.
//
// The rule is an ALLOW-list, deliberately, and derived from the enum rather than
// written out: this script's own header says it "only lands the INTERPRETIVE layer
// (bloc/theme nodes, belongs_to/about edges)", and the graph-log agrees — pass 2 wrote
// 2 `bloc` nodes, pass 3 wrote 13 `theme` nodes, and this path has never legitimately
// written any other kind. Everything else is CASE-OWNED: created and enriched by a
// writer that read-merges. Deriving the deny-list as "the enum minus what we own"
// means a kind a future pass adds to KG_NODE_KINDS is refused HERE the day it lands,
// without anyone remembering to come back to this file — the opposite of how the
// `linked_to`/`supplies` hole opened.
//
// A refused node is dropped and reported, never upserted, and — unlike a kept one —
// its id is NOT added to the kg-resident set, so an edge cannot come to rest on a
// node this batch declared and then refused to create.
export const PROMOTABLE_NODE_KINDS = new Set<string>(["bloc", "theme"]);
export const CASE_OWNED_NODE_KINDS: ReadonlySet<string> = new Set(
  KG_NODE_KINDS.filter((k) => !PROMOTABLE_NODE_KINDS.has(k)),
);

// Sentinel finding 2026-07-31 (orphan-edges invariant): the membership gate's
// known-id base deliberately includes raw entity urns (persons, organs, VOTE
// EVENTS) so verdicts can *reference* real entities — but vote events exist only
// in the relational `vote_event` table, never as kg nodes. An edge endpoint that
// is merely "a known entity" can therefore dangle forever: 179
// `psp:hlasovani:* -about-> theme:*` edges landed with a src no kg_node row will
// ever back. Edge endpoints must be KG-RESIDENT — an existing kg_node id or a
// node the gated verdict batch itself declares. Edges that fail this are dropped
// and reported, never upserted (same posture as CASE_OWNED_EDGE_RELS).
export function dropNonResidentEdges(
  edges: KgEdgeRow[],
  kgResident: ReadonlySet<string>,
): { kept: KgEdgeRow[]; droppedEndpoints: string[] } {
  const kept: KgEdgeRow[] = [];
  const droppedEndpoints: string[] = [];
  for (const e of edges) {
    const bad = [e.src, e.dst].filter((id) => !kgResident.has(id));
    if (bad.length > 0) {
      droppedEndpoints.push(...bad);
      continue;
    }
    kept.push(e);
  }
  return { kept, droppedEndpoints };
}

export function toRows(
  v: KgVerdict,
  pass: number,
  computedAt: string,
): { nodes: KgNodeRow[]; edges: KgEdgeRow[]; droppedRels: string[]; droppedKinds: string[] } {
  const provenance = { pass, method: "verdict", ref: v.target, computedAt };
  const droppedKinds: string[] = [];
  const nodes: KgNodeRow[] = [];
  for (const n of v.nodes) {
    if (CASE_OWNED_NODE_KINDS.has(n.kind)) {
      droppedKinds.push(n.kind);
      continue;
    }
    nodes.push({
      id: n.id,
      kind: n.kind,
      label: n.label,
      props: { rationale: n.rationale },
      firstSeenPass: pass,
      provenance,
    });
  }
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
  return { nodes, edges, droppedRels, droppedKinds };
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
  // KG-resident ids = ids an edge endpoint may use (existing kg nodes + nodes
  // declared by gated verdicts in this batch). Raw urns (e.g. vote events) are
  // "known" for reference purposes but are NOT valid edge endpoints — see
  // dropNonResidentEdges above.
  const kgResident = new Set<string>();
  for (const n of await store.listKgNodes()) {
    known.add(n.id);
    kgResident.add(n.id);
  }
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
    const { nodes, edges, droppedRels, droppedKinds } = toRows(parsed.value, pass, computedAt);
    // A node this verdict declares AND THIS SCRIPT WILL CREATE becomes a valid
    // endpoint for the NEXT file too. A refused one must not: it is never upserted,
    // so an edge resting on it would dangle (the orphan-edges invariant below).
    for (const n of nodes) {
      known.add(n.id);
      kgResident.add(n.id);
    }
    const { kept, droppedEndpoints } = dropNonResidentEdges(edges, kgResident);
    allNodes.push(...nodes);
    allEdges.push(...kept);
    console.log(`  gated ${file}: +${nodes.length} nodes, +${kept.length} edges  (target: ${parsed.value.target})`);
    if (droppedKinds.length > 0) {
      console.log(
        `    REFUSED ${droppedKinds.length} node(s) of case-owned kind(s) ${JSON.stringify([...new Set(droppedKinds)])} — ` +
          `this path writes props {rationale} only, so promoting one would erase that node's whole enrichment layer ` +
          `(a person's contribution_score/effort_*, a bill's summary_cz/forensic_*). Only ${JSON.stringify([...PROMOTABLE_NODE_KINDS])} are promotable here.`,
      );
    }
    if (droppedRels.length > 0) {
      console.log(
        `    REFUSED ${droppedRels.length} edge(s) with case-owned rel(s) ${JSON.stringify([...new Set(droppedRels)])} — ` +
          `linked_to/supplies belong to their own case loop's merge-preserving ingest, never this generic promote path.`,
      );
    }
    if (droppedEndpoints.length > 0) {
      console.log(
        `    REFUSED ${droppedEndpoints.length} non-kg-resident endpoint(s) ${JSON.stringify([...new Set(droppedEndpoints)].slice(0, 5))} — ` +
          `edge endpoints must be existing kg nodes or nodes this batch declares (sentinel orphan-edges invariant).`,
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
