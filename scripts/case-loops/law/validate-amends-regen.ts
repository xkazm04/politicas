/* Case ③ Law loop — batch-004 Q-law-8 validator. Standalone check the orchestrator runs against
 * `docs/data-analysis/case-law/payloads/batch-004-amends-regen.json` (built by `amends-regen.ts`)
 * BEFORE any live-graph write. Read-only against the graph (a copy, or the live store — this
 * script never calls any write/mutate method). Checks:
 *
 *   1. id-membership — every edge's `from` (bill) and `to` (law) resolve to real node ids in the
 *      graph; every `missingLawNodeCensus` entry is confirmed to genuinely have NO law node (not
 *      just omitted from the edge set for some other reason).
 *   2. no duplicate edges — no repeated (from,to) pair in the regenerated set.
 *   3. no fabricated law numbers — every edge's `ref` traces back to either the bill's census
 *      `amended_laws_full` proposal (source: census_full) or its title-derived `amended_laws`
 *      graph prop (source: title_fallback); a ref that appears in neither source is a fabrication
 *      and fails hard.
 *
 * Same style as gate-verdicts.ts: load → check → per-item report → pass/fail summary → exit code.
 *
 *   PGLITE_PATH=./.pglite-copy-law-regen npx tsx scripts/case-loops/law/validate-amends-regen.ts
 */
import { readFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

const PAYLOAD = "docs/data-analysis/case-law/payloads/batch-004-amends-regen.json";
const PROPOSAL_IN = "docs/data-analysis/case-law/payloads/amended-laws-full-proposal.json";

interface EdgeProposal {
  from: string;
  to: string;
  ref: string;
  provenance: { track: string; method: string; ref: string };
  source: "census_full" | "title_fallback";
}
interface Payload {
  stats: Record<string, unknown>;
  missingLawNodeCensus: { statute: string; citingBillCount: number; sampleBillIds: string[] }[];
  edges: EdgeProposal[];
}
interface ProposalFile {
  proposals: { billNodeId: string; amended_laws_full: string[] }[];
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to a copy (never the live ./.pglite for a write) or the live store for a read-only check");

  const payload: Payload = JSON.parse(readFileSync(PAYLOAD, "utf8"));
  const proposal: ProposalFile = JSON.parse(readFileSync(PROPOSAL_IN, "utf8"));
  const proposalByBillId = new Map(proposal.proposals.map((p) => [p.billNodeId, new Set(p.amended_laws_full)]));

  const nodes = await store.listKgNodes();
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const bills = nodes.filter((n) => n.kind === "bill");
  const laws = nodes.filter((n) => n.kind === "law");
  const lawNodeByRef = new Map(laws.map((n) => [String((n.props as Record<string, unknown>).ref ?? ""), n.id]));
  const billAmendedLawsById = new Map(
    bills.map((b) => {
      const p = b.props as Record<string, unknown>;
      return [b.id, new Set(Array.isArray(p.amended_laws) ? (p.amended_laws as string[]) : [])];
    }),
  );

  console.log(`Graph copy: ${nodes.length} nodes (${bills.length} bills, ${laws.length} laws). Payload: ${payload.edges.length} edge proposals, ${payload.missingLawNodeCensus.length} missing-law-node statutes.\n`);

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1a. id-membership on edges
  let idMembershipFails = 0;
  for (const e of payload.edges) {
    if (!nodesById.has(e.from)) {
      errors.push(`edge ${e.from} -> ${e.to}: 'from' does not resolve to a graph node`);
      idMembershipFails++;
      continue;
    }
    if (nodesById.get(e.from)!.kind !== "bill") {
      errors.push(`edge ${e.from} -> ${e.to}: 'from' resolves but is not a bill node (kind=${nodesById.get(e.from)!.kind})`);
      idMembershipFails++;
    }
    if (!nodesById.has(e.to)) {
      errors.push(`edge ${e.from} -> ${e.to}: 'to' does not resolve to a graph node`);
      idMembershipFails++;
      continue;
    }
    if (nodesById.get(e.to)!.kind !== "law") {
      errors.push(`edge ${e.from} -> ${e.to}: 'to' resolves but is not a law node (kind=${nodesById.get(e.to)!.kind})`);
      idMembershipFails++;
    }
    // the resolved law node's own ref prop must equal the edge's declared ref (no silent drift)
    const toNode = nodesById.get(e.to);
    if (toNode) {
      const toRef = String((toNode.props as Record<string, unknown>).ref ?? "");
      if (toRef !== e.ref) {
        errors.push(`edge ${e.from} -> ${e.to}: declared ref "${e.ref}" does not match law node's own ref prop "${toRef}"`);
        idMembershipFails++;
      }
    }
  }

  // 1b. missing-law-node census entries genuinely have no law node
  let missingLawFalsePositives = 0;
  for (const m of payload.missingLawNodeCensus) {
    if (lawNodeByRef.has(m.statute)) {
      errors.push(`missingLawNodeCensus lists ${m.statute} as unresolved, but a law node ${lawNodeByRef.get(m.statute)} exists for it — should have become an edge`);
      missingLawFalsePositives++;
    }
  }

  // 2. no duplicate (from,to) edges
  const seen = new Map<string, number>();
  for (const e of payload.edges) {
    const key = `${e.from}|${e.to}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
  for (const [key, count] of duplicates) errors.push(`duplicate edge ${key.replace("|", " -> ")} appears ${count} times`);

  // 3. no fabricated law numbers — every edge's ref traces to its bill's actual source data
  let fabricationFails = 0;
  for (const e of payload.edges) {
    if (e.source === "census_full") {
      const validRefs = proposalByBillId.get(e.from);
      if (!validRefs || !validRefs.has(e.ref)) {
        errors.push(`edge ${e.from} -> ${e.to} (ref ${e.ref}): source=census_full but "${e.ref}" is NOT in ${e.from}'s amended_laws_full census proposal — possible fabrication`);
        fabricationFails++;
      }
    } else if (e.source === "title_fallback") {
      const validRefs = billAmendedLawsById.get(e.from);
      if (!validRefs || !validRefs.has(e.ref)) {
        errors.push(`edge ${e.from} -> ${e.to} (ref ${e.ref}): source=title_fallback but "${e.ref}" is NOT in ${e.from}'s amended_laws graph prop — possible fabrication`);
        fabricationFails++;
      }
    } else {
      errors.push(`edge ${e.from} -> ${e.to}: unknown source tag "${e.source}" — cannot verify provenance`);
      fabricationFails++;
    }
  }

  // Sanity cross-check: edge count should equal stats.regeneratedAmendsEdgeCount
  const statedCount = (payload.stats as Record<string, unknown>).regeneratedAmendsEdgeCount;
  if (typeof statedCount === "number" && statedCount !== payload.edges.length) {
    warnings.push(`stats.regeneratedAmendsEdgeCount (${statedCount}) does not match payload.edges.length (${payload.edges.length})`);
  }

  console.log(`1. id-membership: ${idMembershipFails === 0 ? "PASS" : `FAIL (${idMembershipFails} issues)`}`);
  console.log(`   missing-law-node census cross-check: ${missingLawFalsePositives === 0 ? "PASS" : `FAIL (${missingLawFalsePositives} false positives)`}`);
  console.log(`2. duplicate edges: ${duplicates.length === 0 ? "PASS" : `FAIL (${duplicates.length} duplicate keys)`}`);
  console.log(`3. no-fabrication (ref traces to source): ${fabricationFails === 0 ? "PASS" : `FAIL (${fabricationFails} unverifiable refs)`}`);

  if (errors.length > 0) {
    console.log(`\n${errors.length} error(s):`);
    for (const e of errors.slice(0, 50)) console.log(`  ✗ ${e}`);
    if (errors.length > 50) console.log(`  … and ${errors.length - 50} more`);
  }
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }

  const ok = errors.length === 0;
  console.log(`\nVALIDATE-AMENDS-REGEN: ${ok ? "PASS" : "FAIL"} — ${payload.edges.length} edges checked, ${errors.length} errors, ${warnings.length} warnings.`);
  await store.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
