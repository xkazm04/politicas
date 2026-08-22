/* Case ③ Law loop — batch-013 P1: additive census completion (the two live undercounts the
 * batch-012 verdicts disclosed on their own pages).
 *
 * ROOT CAUSE (diagnosed, not assumed): the batch-008 census was CORRECT — it extracted all
 * 10 statutes for tisk 250 and all 7 for tisk 69 — but the regen could not emit edges for five
 * of those refs because the graph carried no law node for them, and it SAID so in its own
 * `missingLawNodeCensus` (132/2010 ← tisk 69; 330/2025, 387/2024, 505/1990, 539/1992 ←
 * tisk 250). The batch-005 missing-node ingest predates that census, so the five fell in the
 * gap between the two passes. This is the insert-capable, node-then-edge apply path the case
 * backlog (D3/D4) called for, in miniature: 5 nodes, then 5 edges, nothing else.
 *
 * Anti-fabrication: nodes come from ingest-missing-laws.ts's e-Sbírka registry resolution
 * (batch-013-missing-law-nodes.json, 5/5 resolved, verbatim titles); edges come from the
 * batch-008 regen's own census rows (each bill's cached text carries the citation — verified
 * by the census extractor and re-verified by the batch-012 audit's hand count).
 *
 *   npx tsx scripts/case-loops/law/apply-census-completion-013.ts [--commit] [--pass=46]
 */
import { readFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

const NODES_IN = "docs/data-analysis/case-law/payloads/batch-013-missing-law-nodes.json";
const REGEN_IN = "docs/data-analysis/case-law/payloads/batch-008-amends-regen.json";
const COMMIT = process.argv.includes("--commit");
const PASS = Number(process.argv.find((a) => a.startsWith("--pass="))?.slice(7) ?? 46);

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const computedAt = new Date().toISOString();

  const nodePayload = JSON.parse(readFileSync(NODES_IN, "utf8")) as {
    resolved: { id: string; kind: "law"; label: string; props: Record<string, unknown>; provenance: Record<string, unknown> }[];
  };
  const regen = JSON.parse(readFileSync(REGEN_IN, "utf8")) as {
    missingLawNodeCensus: { statute: string; sampleBillIds: string[] }[];
  };

  // The 5 edges: each census row names exactly the citing bill(s) whose cached text carries
  // the citation. Edge target ids follow the regen's own `law:sb:<n>-<rok>` convention.
  const wantedEdges: { src: string; ref: string; dst: string }[] = [];
  for (const m of regen.missingLawNodeCensus) {
    const dst = `law:sb:${m.statute.replace("/", "-")}`;
    for (const src of m.sampleBillIds) wantedEdges.push({ src, ref: m.statute, dst });
  }

  // Sanity: every edge target must be covered by the node payload; every src must exist live.
  const nodeIds = new Set(nodePayload.resolved.map((n) => n.id));
  for (const e of wantedEdges) if (!nodeIds.has(e.dst)) throw new Error(`edge target ${e.dst} not in node payload — refusing`);
  const bills = await store.listKgNodes({ kind: "bill" });
  const billIds = new Set(bills.map((b) => b.id));
  for (const e of wantedEdges) if (!billIds.has(e.src)) throw new Error(`edge src ${e.src} is not a live bill node — refusing`);
  const existingLaws = new Set((await store.listKgNodes({ kind: "law" })).map((n) => n.id));
  const dupNodes = nodePayload.resolved.filter((n) => existingLaws.has(n.id));
  if (dupNodes.length > 0) throw new Error(`node(s) already live: ${dupNodes.map((d) => d.id).join(", ")} — this script is additive-only, investigate first`);
  const existingAmends = await store.listKgEdges({ rel: "amends" });
  const dupEdges = wantedEdges.filter((w) => existingAmends.some((e) => e.src === w.src && e.dst === w.dst));
  if (dupEdges.length > 0) throw new Error(`edge(s) already live: ${dupEdges.map((d) => `${d.src}→${d.dst}`).join(", ")} — refusing`);

  const nodeRows: KgNodeRow[] = nodePayload.resolved.map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    props: n.props,
    firstSeenPass: PASS,
    provenance: { track: "law", pass: PASS, method: "deterministic", ref: "amends-census-completion-013", computedAt },
  }));
  const edgeRows: KgEdgeRow[] = wantedEdges.map((e) => ({
    src: e.src,
    rel: "amends",
    dst: e.dst,
    weight: null,
    props: { source: "census_full", ref: e.ref },
    provenance: { track: "law", pass: PASS, method: "deterministic", ref: "amends-census-completion-013", computedAt },
  }));

  console.log(`nodes to insert: ${nodeRows.length}`);
  for (const n of nodeRows) console.log(`  + ${n.id}  ${String(n.label).slice(0, 80)}`);
  console.log(`edges to insert: ${edgeRows.length}`);
  for (const e of edgeRows) console.log(`  + ${e.src} —amends→ ${e.dst}`);

  if (COMMIT) {
    const nn = await store.upsertKgNodes(nodeRows); // nodes FIRST
    const ne = await store.upsertKgEdges(edgeRows); // then edges
    console.log(`\nCOMMITTED: ${nn} nodes, ${ne} edges (pass ${PASS}).`);
  } else {
    console.log("\nDRY-RUN — add --commit to write.");
  }
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
