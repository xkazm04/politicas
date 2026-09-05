import { describe, expect, it } from "vitest";
import { moneyGraphToKgRows } from "./kg-money-ingest";
import type { MoneyGraph } from "@/lib/analysis/kg-money";

/* D1 (batch 004) made `linked_to` EDGES merge-preserving in this writer; the NODES it
 * writes were still built fresh — `props: n.props`, `firstSeenPass: opts.pass` — so a
 * re-ingest wholesale-replaced every company node's props (the same `upsertKgNodes`
 * replace kg-compute learned to read-merge on 2026-08-13) and restamped which pass
 * CREATED the node. Annotations other passes leave on a company node
 * (`ico_unresolvable_in_ares`, reconcile fields) were erased on each run
 * (2026-09-06, scan-sweep, bounty-hunter). */

const graph = {
  nodes: [
    { id: "company:ico:00000001", kind: "company", label: "Alfa", props: { ico: "00000001", subsidies_total_czk: 5 } },
    { id: "contract:x", kind: "contract", label: "X", props: { amount: 1 } },
  ],
  edges: [],
  stats: {},
} as unknown as MoneyGraph;
const opts = { pass: 9, computedAt: "2026-09-06T00:00:00.000Z", ref: "money-feed:test" };

describe("moneyGraphToKgRows — nodes read-merge and keep their creating pass (2026-09-06)", () => {
  it("a stored prop this run does not compute survives; a computed one wins", () => {
    const existing = new Map([
      ["company:ico:00000001", { props: { ico: "00000001", ico_unresolvable_in_ares: true, subsidies_total_czk: 1 }, firstSeenPass: 3 }],
    ]);
    const { nodes } = moneyGraphToKgRows(graph, { ...opts, existingNodes: existing });
    expect(nodes[0]!.props).toEqual({ ico: "00000001", ico_unresolvable_in_ares: true, subsidies_total_czk: 5 });
    expect(nodes[0]!.firstSeenPass).toBe(3);
  });

  it("a node not yet in the store is created at this pass with exactly its computed props", () => {
    const { nodes } = moneyGraphToKgRows(graph, { ...opts, existingNodes: new Map() });
    expect(nodes[1]!.props).toEqual({ amount: 1 });
    expect(nodes[1]!.firstSeenPass).toBe(9);
  });

  it("without the map (a caller that has not been updated) the behaviour is the pre-fix one", () => {
    const { nodes } = moneyGraphToKgRows(graph, opts);
    expect(nodes[0]!.firstSeenPass).toBe(9);
  });
});
