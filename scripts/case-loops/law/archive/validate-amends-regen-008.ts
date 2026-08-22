/* Case ③ Law loop — batch-008 validator, re-pointed at batch-008-amends-regen.json and extended
 * per the batch-006 independent audit's N3 minimum-to-ready item: "have the validator actually
 * gate provenance shape + independently re-check the act-type gate" (the old validator trusted the
 * generator's D8 act-type gate without re-deriving it). Standalone check the orchestrator runs
 * BEFORE any live-graph write. Read-only against the graph (a copy, or the live store).
 *
 * Checks (1-3 unchanged from validate-amends-regen-005.ts; 4-5 new, batch-008):
 *   1. id-membership — every edge's `from`/`to` resolve to real graph nodes of the right kind.
 *   2. no duplicate edges.
 *   3. no fabricated law numbers — every edge's `ref` traces to its bill's census/title source.
 *   4. provenance shape — every edge's provenance carries the full 5-field kernel contract
 *      ({track, pass, method, ref, computedAt}) — batch-006's audit (N3) found computedAt missing
 *      on all 567 edges and nothing ever checked for it.
 *   5. act-type gate, independently re-derived — for every edge, re-read the target law node's
 *      OWN esbirka_title prop and re-apply the same non-act-prefix blacklist the generator uses,
 *      rather than trusting the generator's excludedNonActRefs list was applied correctly.
 *
 *   PGLITE_PATH=./.pglite-copy-law-008 npx tsx scripts/case-loops/law/validate-amends-regen-007.ts
 */
import { readFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

const PAYLOAD = "docs/data-analysis/case-law/payloads/batch-008-amends-regen.json";
const PROPOSAL_IN = "docs/data-analysis/case-law/payloads/batch-008-amended-laws-full-proposal-v2.json";

interface EdgeProposal {
  from: string;
  to: string;
  ref: string;
  provenance: { track?: string; pass?: number; method?: string; ref?: string; computedAt?: string };
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

const NON_ACT_PREFIXES = ["Nařízení vlády", "Vyhláška", "Sdělení", "Usnesení", "Opatření"];

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

  // 3. no fabricated law numbers
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

  // 4. provenance shape (N3 fix) — the kernel 5-field contract
  let provenanceShapeFails = 0;
  for (const e of payload.edges) {
    const p = e.provenance ?? {};
    const missing = (["track", "pass", "method", "ref", "computedAt"] as const).filter((k) => p[k] === undefined || p[k] === null);
    if (missing.length > 0) {
      errors.push(`edge ${e.from} -> ${e.to}: provenance missing field(s) [${missing.join(", ")}]`);
      provenanceShapeFails++;
    }
  }

  // 5. act-type gate, independently re-derived (N3/N6 fix) — do not trust the generator's
  // excludedNonActRefs list; re-check every applied edge's OWN target node title directly.
  let actTypeGateFails = 0;
  let actTypeGateFailOpenCount = 0;
  for (const e of payload.edges) {
    const toNode = nodesById.get(e.to);
    if (!toNode) continue; // already flagged by id-membership above
    const title = String((toNode.props as Record<string, unknown>).esbirka_title ?? "");
    if (!title) {
      actTypeGateFailOpenCount++;
      continue; // fail-open by design (N6) — no title on record, cannot classify; logged, not an error
    }
    if (NON_ACT_PREFIXES.some((pfx) => title.startsWith(pfx))) {
      errors.push(`edge ${e.from} -> ${e.to} (ref ${e.ref}): target's esbirka_title "${title}" is a non-act prefix (${NON_ACT_PREFIXES.find((pfx) => title.startsWith(pfx))}) — should have been excluded by the D8 gate but is present in this payload`);
      actTypeGateFails++;
    }
  }

  // Sanity cross-check: edge count should equal stats.regeneratedAmendsEdgeCount
  const statedCount = (payload.stats as Record<string, unknown>).regeneratedAmendsEdgeCount;
  if (typeof statedCount === "number" && statedCount !== payload.edges.length) {
    warnings.push(`stats.regeneratedAmendsEdgeCount (${statedCount}) does not match payload.edges.length (${payload.edges.length})`);
  }
  if (actTypeGateFailOpenCount > 0) {
    warnings.push(`${actTypeGateFailOpenCount} edge(s) target a law node with no esbirka_title on record — act-type gate fail-open (N6), not independently verifiable either way`);
  }

  console.log(`1. id-membership: ${idMembershipFails === 0 ? "PASS" : `FAIL (${idMembershipFails} issues)`}`);
  console.log(`   missing-law-node census cross-check: ${missingLawFalsePositives === 0 ? "PASS" : `FAIL (${missingLawFalsePositives} false positives)`}`);
  console.log(`2. duplicate edges: ${duplicates.length === 0 ? "PASS" : `FAIL (${duplicates.length} duplicate keys)`}`);
  console.log(`3. no-fabrication (ref traces to source): ${fabricationFails === 0 ? "PASS" : `FAIL (${fabricationFails} unverifiable refs)`}`);
  console.log(`4. provenance shape (5-field contract): ${provenanceShapeFails === 0 ? "PASS" : `FAIL (${provenanceShapeFails} edges missing fields)`}`);
  console.log(`5. act-type gate (independently re-derived): ${actTypeGateFails === 0 ? "PASS" : `FAIL (${actTypeGateFails} non-act targets present)`} (${actTypeGateFailOpenCount} fail-open/unclassifiable)`);

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
  console.log(`\nVALIDATE-AMENDS-REGEN-007: ${ok ? "PASS" : "FAIL"} — ${payload.edges.length} edges checked, ${errors.length} errors, ${warnings.length} warnings.`);
  await store.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
