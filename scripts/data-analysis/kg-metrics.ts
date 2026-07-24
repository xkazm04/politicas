/* Phase-4 per-pass metrics for the knowledge-graph loop (design §7). Reads the
 * kg_* tables (authoritative structural facts) + an optional cost log
 * (.kg-analysis/pass-costs.json: tokens/patterns/reuse per pass) and renders the
 * flywheel curves: nodes/edges CREATED vs nodes ENRICHED per pass, by method/rel,
 * plus cost-per-discovery and reuse-rate. Read-only.
 *
 *   npm run da:kg-metrics                       # against ./.pglite (or a copy)
 *   PGLITE_PATH=./.pglite-copy npm run da:kg-metrics
 */
import { existsSync, readFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

interface PassCost { pass: number; kind?: string; target?: string; tokens?: number; patterns?: number; reuseRate?: number | null; note?: string }

const provPass = (p: unknown): number | null => {
  const o = p as Record<string, unknown> | undefined;
  return o && typeof o.pass === "number" ? o.pass : null;
};

async function main() {
  const store = await getStore();
  if (!store) { console.error("no store"); process.exit(1); }
  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();

  // creation: node.firstSeenPass, edge.provenance.pass
  // enrichment: any props value that is an object carrying a numeric .pass (a *_provenance sub-object)
  const created = new Map<number, { nodes: number; edges: number }>();
  const enriched = new Map<number, number>();
  const bump = (m: Map<number, { nodes: number; edges: number }>, p: number, k: "nodes" | "edges") => {
    const r = m.get(p) ?? { nodes: 0, edges: 0 }; r[k]++; m.set(p, r);
  };
  for (const n of nodes) {
    if (n.firstSeenPass) bump(created, n.firstSeenPass, "nodes");
    for (const v of Object.values(n.props)) {
      const p = provPass(v);
      if (p !== null && p !== n.firstSeenPass) enriched.set(p, (enriched.get(p) ?? 0) + 1);
    }
  }
  for (const e of edges) { const p = provPass(e.provenance); if (p !== null) bump(created, p, "edges"); }

  const nodesByKind = tally(nodes.map((n) => n.kind));
  const edgesByRel = tally(edges.map((e) => e.rel));
  const nodeMethod = tally(nodes.map((n) => String((n.provenance as Record<string, unknown>).method ?? "?")));
  const edgeMethod = tally(edges.map((e) => String((e.provenance as Record<string, unknown>).method ?? "?")));

  console.log(`\n== knowledge-graph metrics ==`);
  console.log(`nodes ${nodes.length}  [${fmt(nodesByKind)}]  methods [${fmt(nodeMethod)}]`);
  console.log(`edges ${edges.length}  [${fmt(edgesByRel)}]  methods [${fmt(edgeMethod)}]`);

  const costs: PassCost[] = existsSync("./.kg-analysis/pass-costs.json")
    ? (JSON.parse(readFileSync("./.kg-analysis/pass-costs.json", "utf8")).passes ?? [])
    : [];
  const costByPass = new Map(costs.map((c) => [c.pass, c]));

  const passes = [...new Set([...created.keys(), ...enriched.keys(), ...costByPass.keys()])].sort((a, b) => a - b);
  console.log(`\npass  method         created(n/e)  enriched  patterns  discoveries  tokens    cost/disc  reuse`);
  for (const p of passes) {
    const c = created.get(p) ?? { nodes: 0, edges: 0 };
    const en = enriched.get(p) ?? 0;
    const cost = costByPass.get(p);
    const pat = cost?.patterns ?? 0;
    const disc = c.nodes + c.edges + en + pat; // structural + narrative discoveries
    const tok = cost?.tokens ?? 0;
    const cpd = disc ? Math.round(tok / disc) : 0;
    const reuse = cost?.reuseRate ?? null;
    console.log(
      `  ${String(p).padEnd(4)}${(cost?.kind ?? "?").padEnd(15)}${`${c.nodes}/${c.edges}`.padEnd(13)} ${String(en).padStart(6)}   ${String(pat).padStart(6)}    ${String(disc).padStart(6)}     ${String(tok).padStart(7)}   ${String(cpd).padStart(7)}   ${reuse === null ? "-" : reuse}`,
    );
  }

  // flywheel read: verdict (LLM) passes cost tokens; deterministic passes ~0.
  const llm = costs.filter((c) => (c.kind ?? "").includes("verdict"));
  const det = costs.filter((c) => (c.kind ?? "").includes("deterministic"));
  if (llm.length && det.length) {
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    console.log(`\nflywheel: LLM passes avg ${avg(llm.map((c) => c.tokens ?? 0))} tok · deterministic-compounding passes avg ${avg(det.map((c) => c.tokens ?? 0))} tok`);
    console.log(`          reuse-rate — LLM ${llm.map((c) => c.reuseRate).join("/")}  ·  deterministic ${det.map((c) => c.reuseRate).join("/")}`);
  }
  await store.close();
}

function tally(xs: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return new Map([...m.entries()].sort((a, b) => b[1] - a[1]));
}
function fmt(m: Map<string, number>): string {
  return [...m.entries()].map(([k, n]) => `${k} ${n}`).join(" · ");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
