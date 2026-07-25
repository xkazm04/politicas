/* Gate for batch-006's three dataor payloads — same discipline as validate-payloads.ts
 * (entity-id membership; a proposal that fails is DROPPED and logged, never persisted),
 * extended for the two new proposal shapes batch 006 introduces (node-create,
 * edge-repoint) that the batch-001/002 edge-only validator doesn't cover.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b6 npx tsx scripts/case-loops/money/validate-batch006.ts
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

  // 1. dataor-corroboration — same shape as batch-001/002, props-merge onto EXISTING edges.
  {
    const file = "docs/data-analysis/case-money/payloads/batch-006-dataor-corroboration.json";
    const payload = JSON.parse(await fs.readFile(file, "utf8")) as { edges: { src: string; rel: string; dst: string; mp: string; company: string }[] };
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
    console.log(`GATE ${file}: ${ok}/${payload.edges.length} corroboration proposals validate.`);
    if (drops.length) {
      allOk = false;
      console.log(`  DROPPED ${drops.length}:`);
      for (const d of drops) console.log("    " + d);
    }
  }

  // 2. prak-repoint — oldEdge must be a real, currently-graphed edge; the node-create
  //    target must not already collide with a different node kind.
  {
    const file = "docs/data-analysis/case-money/payloads/batch-006-prak-repoint.json";
    const payload = JSON.parse(await fs.readFile(file, "utf8")) as {
      nodeCreateProposal: { id: string; kind: string };
      edgeRepointProposals: { oldEdge: { src: string; rel: string; dst: string }; newEdge: { src: string; rel: string; dst: string } }[];
    };
    const newNodeId = payload.nodeCreateProposal.id;
    const collision = nodeIds.has(newNodeId);
    console.log(`GATE ${file}: node-create ${newNodeId} — ${collision ? "✗ ALREADY EXISTS (would silently overwrite — orchestrator must props-merge, not insert)" : "ok, does not yet exist"}`);
    let ok = 0;
    for (const rp of payload.edgeRepointProposals) {
      const oldKey = `${rp.oldEdge.src}|${rp.oldEdge.rel}|${rp.oldEdge.dst}`;
      const problems: string[] = [];
      if (!edgeKey.has(oldKey)) problems.push(`old edge ${oldKey} does not exist in graph — cannot re-point what isn't there`);
      if (!nodeIds.has(rp.newEdge.src)) problems.push(`new edge src ${rp.newEdge.src} missing`);
      if (rp.newEdge.dst !== newNodeId) problems.push(`new edge dst ${rp.newEdge.dst} does not match the payload's own node-create id ${newNodeId}`);
      if (problems.length) {
        allOk = false;
        console.log(`  ✗ ${rp.oldEdge.src}: ${problems.join("; ")}`);
      } else ok++;
    }
    console.log(`  ${ok}/${payload.edgeRepointProposals.length} edge re-point proposal(s) validate.`);
  }

  // 3. ownership-chains — every `dst` (the already-graphed child company) must exist;
  //    every `src` (the parent/shareholder) must exist either already or as one of this
  //    payload's own node-create proposals (no dangling edge endpoint).
  {
    const file = "docs/data-analysis/case-money/payloads/batch-006-ownership-chains.json";
    const payload = JSON.parse(await fs.readFile(file, "utf8")) as {
      nodeCreateProposals: { id: string }[];
      ownsStakeEdgeProposals: { src: string; dst: string }[];
    };
    const proposedIds = new Set(payload.nodeCreateProposals.map((n) => n.id));
    let ok = 0;
    const drops: string[] = [];
    for (const e of payload.ownsStakeEdgeProposals) {
      const problems: string[] = [];
      if (!nodeIds.has(e.dst)) problems.push(`dst ${e.dst} not an existing graphed company — this proposal claims it's an already-tied company but it isn't`);
      if (!nodeIds.has(e.src) && !proposedIds.has(e.src)) problems.push(`src ${e.src} neither exists nor is proposed by this payload's own nodeCreateProposals`);
      if (problems.length) drops.push(`✗ ${e.src} → ${e.dst}: ${problems.join("; ")}`);
      else ok++;
    }
    console.log(`GATE ${file}: ${ok}/${payload.ownsStakeEdgeProposals.length} owns_stake proposals validate (${payload.nodeCreateProposals.length} new parent-company nodes proposed).`);
    if (drops.length) {
      allOk = false;
      console.log(`  DROPPED ${drops.length}:`);
      for (const d of drops) console.log("    " + d);
    }
  }

  console.log(allOk ? "\nALL batch-006 payloads validate cleanly." : "\nSOME batch-006 proposals failed validation — see DROPPED lines above.");
  await store.close();
  process.exit(allOk ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
