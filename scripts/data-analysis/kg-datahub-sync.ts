/* Phase 5 (OPTIONAL, DISPOSABLE): project the derived knowledge graph
 * (kg_node/kg_edge — tier 2) into DataHub as datasets + lineage, so an external
 * agent can navigate the graph and trace every edge back to the raw psp.cz tables.
 *
 * A PURE PROJECTION of tier 2 (design §2, §11): it only READS kg_* and emits their
 * metadata; it never writes the store and can never hold an unbacked fact. The loop
 * is fully functional with this turned off — nothing depends on it. Metadata only:
 * no civic rows, no node payloads beyond counts/schema/provenance are sent.
 *
 * Datasets published (platform `politicas`, same catalog as datahub-sync.ts):
 *   store.kg_node · store.kg_edge          — the two tables (schema §3 + counts)
 *   kg.node.<kind>  (person|party|organ|bloc|theme)   — per-kind views + lineage
 *   kg.edge.<rel>   (co_votes_with|rebels_against|influential_in|belongs_to|about)
 * Lineage (recomputability, §3): every deterministic edge rel → its raw corpus
 * tables (vote_ballot / membership / organ / vote_event); derived rels/kinds →
 * their kg upstreams (belongs_to ← co_votes_with; bloc ← co_votes_with; about,
 * theme ← vote_event). store.kg_edge ← every kg.edge.<rel>; likewise nodes.
 *
 *   npx tsx scripts/data-analysis/kg-datahub-sync.ts                 # build + write aspects file (no DataHub needed)
 *   npx tsx scripts/data-analysis/kg-datahub-sync.ts --push --gms=http://localhost:8080   # POST to a GMS
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const PLATFORM = "urn:li:dataPlatform:politicas";
const ACTOR = "urn:li:corpuser:data-analysis";
const BATCH = 25;

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const ENV = arg("env", "PROD");
const GMS = arg("gms", process.env.DATAHUB_GMS_URL || "http://localhost:8080").replace(/\/+$/, "");
const clean = (s: string) => s.replace(/[.\-]/g, "_");
const datasetUrn = (name: string) => `urn:li:dataset:(${PLATFORM},${name},${ENV})`;
/** Reference the SAME corpus dataset urns datahub-sync.ts publishes, so lineage joins up. */
const corpusUrn = (source: string, entity: string) => datasetUrn(`corpus.${clean(source)}.${entity}`);

type Entity = Record<string, unknown>;
const envelope = (urn: string, aspect: Record<string, unknown>): Entity => ({ entityType: "dataset", entityUrn: urn, aspect });
const props = (name: string, description: string, custom: Record<string, string>) => ({ __type: "DatasetProperties", name, description, customProperties: custom });
const profile = (ms: number, rowCount: number) => ({ __type: "DatasetProfile", timestampMillis: ms, rowCount });
const operation = (ms: number) => ({ __type: "Operation", timestampMillis: ms, lastUpdatedTimestamp: ms, operationType: "UPDATE" });
const lineage = (upstreams: string[], ms: number) => ({
  __type: "UpstreamLineage",
  upstreams: upstreams.map((dataset) => ({ auditStamp: { time: ms, actor: ACTOR }, dataset, type: "TRANSFORMED" })),
});
function schemaOf(name: string, fields: { field: string; doc: string; type?: string }[]) {
  return {
    __type: "SchemaMetadata", schemaName: name, platform: PLATFORM, version: 0, hash: "",
    platformSchema: { __type: "OtherSchema", rawSchema: "" },
    fields: fields.map((f) => ({ fieldPath: f.field, description: f.doc, nativeDataType: f.type ?? "string", type: { type: { __type: f.type === "number" ? "NumberType" : "StringType" } } })),
  };
}

const KG_NODE_FIELDS = [
  { field: "id", doc: "urn: a raw entity (psp:person:<id>, psp:organ:<id>) or a derived node (bloc:<slug>, theme:<slug>)." },
  { field: "kind", doc: "person | party | organ | bloc | theme | company | contract (extensible)." },
  { field: "label", doc: "Human label." },
  { field: "props", doc: "Derived attributes (rebellion_rate, cohesion, contestedness, control_timeline…), each enrichment carrying its own nested *_provenance." },
  { field: "first_seen_pass", doc: "The loop pass that created the node (self-awareness).", type: "number" },
  { field: "provenance", doc: "{pass, method: deterministic|verdict, ref, computedAt} — the node's identity provenance." },
];
const KG_EDGE_FIELDS = [
  { field: "src", doc: "kg_node.id." },
  { field: "rel", doc: "co_votes_with | rebels_against | belongs_to | about | influential_in | linked_to | supplies." },
  { field: "dst", doc: "kg_node.id." },
  { field: "weight", doc: "Per-rel: agreement rate | rebellion rate | role rank | roll-call count.", type: "number" },
  { field: "props", doc: "Per-edge detail + rationale." },
  { field: "provenance", doc: "{pass, method, ref, computedAt} — required; every edge is recomputable from raw rows." },
];

/** Per-relation docs + weight meaning + upstreams (recomputability lineage). */
const EDGE_REL: Record<string, { doc: string; weight: string; up: string[] }> = {
  co_votes_with: { doc: "person↔person agreement over shared positional (yes/no) non-voided votes; minShared=50; undirected, src<dst.", weight: "agreement rate", up: [corpusUrn("psp-hlasovani", "vote_ballot"), corpusUrn("psp-hlasovani", "vote_event")] },
  rebels_against: { doc: "person→party; votes against the club's positional majority; minEligible=50; voided excluded.", weight: "rebellion rate", up: [corpusUrn("psp-hlasovani", "vote_ballot"), corpusUrn("psp-poslanci", "membership"), corpusUrn("psp-poslanci", "organ")] },
  influential_in: { doc: "person→organ (committee); committee membership, max role.", weight: "role rank (chair 1 / vice 0.6 / member 0.3)", up: [corpusUrn("psp-poslanci", "membership"), corpusUrn("psp-poslanci", "organ")] },
  belongs_to: { doc: "party→bloc; club assigned to a voting bloc (gated verdict over the co-voting matrix).", weight: "mean intra-bloc agreement", up: [datasetUrn("kg.edge.co_votes_with")] },
  about: { doc: "vote→theme; a roll call's legislative subject (gated verdict over vote titles).", weight: "roll-call count on the subject", up: [corpusUrn("psp-hlasovani", "vote_event")] },
};
/** Per-kind docs + upstreams. */
const NODE_KIND: Record<string, { doc: string; up: string[] }> = {
  person: { doc: "PSP10 MP; props rebellion_rate, committee_count, contested_rebellion_score, budget_*, cross_bloc_agreement.", up: [corpusUrn("psp-poslanci", "person"), corpusUrn("psp-poslanci", "mandate")] },
  party: { doc: "Parliamentary club; props cohesion, seats, control_timeline (blocs), fiscal_divergence (ODS).", up: [corpusUrn("psp-poslanci", "organ")] },
  organ: { doc: "Committee (výbor/komise); prop member_count.", up: [corpusUrn("psp-poslanci", "organ")] },
  bloc: { doc: "Derived voting bloc; props overall_win_rate, control_timeline (verdict-named over the co-voting matrix).", up: [datasetUrn("kg.edge.co_votes_with")] },
  theme: { doc: "Derived legislative theme; props opposed_fraction/contestedness (verdict-named over vote titles).", up: [corpusUrn("psp-hlasovani", "vote_event")] },
};

async function post(entities: Entity[]): Promise<void> {
  const url = `${GMS}/openapi/entities/v1/`;
  const token = process.env.DATAHUB_TOKEN;
  for (let i = 0; i < entities.length; i += BATCH) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(entities.slice(i, i + BATCH)), signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`POST ${url} → ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 500)}`);
    process.stdout.write(`  … ${Math.min(i + BATCH, entities.length)}/${entities.length}\r`);
  }
}

async function main() {
  const push = process.argv.includes("--push");
  const out = arg("out", "./.kg-analysis/datahub-kg-aspects.json");
  const store = await getStore();
  if (!store) { console.error("no store"); process.exit(1); }
  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const ms = Date.now();

  const nodesByKind = new Map<string, number>();
  const nodeMethod = new Map<string, number>();
  for (const n of nodes) { nodesByKind.set(n.kind, (nodesByKind.get(n.kind) ?? 0) + 1); const m = String((n.provenance as Record<string, unknown>).method ?? "?"); nodeMethod.set(m, (nodeMethod.get(m) ?? 0) + 1); }
  const edgesByRel = new Map<string, number>();
  const edgeMethod = new Map<string, number>();
  for (const e of edges) { edgesByRel.set(e.rel, (edgesByRel.get(e.rel) ?? 0) + 1); const m = String((e.provenance as Record<string, unknown>).method ?? "?"); edgeMethod.set(m, (edgeMethod.get(m) ?? 0) + 1); }
  const fmt = (m: Map<string, number>) => Object.fromEntries([...m.entries()].map(([k, v]) => [k, String(v)]));

  const entities: Entity[] = [];
  const nodeUrn = datasetUrn("store.kg_node");
  const edgeUrn = datasetUrn("store.kg_edge");

  // the two store tables
  entities.push(
    envelope(nodeUrn, props("store/kg_node", "Derived knowledge-graph nodes (tier 2). Typed, provenanced, recomputable metadata — never a source-of-truth for a raw entity. See docs/knowledge-graph-loop.md §3.", { total: String(nodes.length), ...fmt(nodesByKind), ...Object.fromEntries([...nodeMethod].map(([k, v]) => [`method_${k}`, String(v)])) })),
    envelope(nodeUrn, schemaOf("store.kg_node", KG_NODE_FIELDS)),
    envelope(nodeUrn, profile(ms, nodes.length)), envelope(nodeUrn, operation(ms)),
    envelope(edgeUrn, props("store/kg_edge", "Derived knowledge-graph edges (tier 2). Typed, weighted, provenanced; composite key (src,rel,dst). Every edge recomputable from raw rows.", { total: String(edges.length), ...fmt(edgesByRel), ...Object.fromEntries([...edgeMethod].map(([k, v]) => [`method_${k}`, String(v)])) })),
    envelope(edgeUrn, schemaOf("store.kg_edge", KG_EDGE_FIELDS)),
    envelope(edgeUrn, profile(ms, edges.length)), envelope(edgeUrn, operation(ms)),
  );

  // per-kind node datasets
  const nodeKindUrns: string[] = [];
  for (const [kind, count] of nodesByKind) {
    const meta = NODE_KIND[kind];
    const urn = datasetUrn(`kg.node.${kind}`);
    nodeKindUrns.push(urn);
    entities.push(
      envelope(urn, props(`kg/node/${kind}`, meta?.doc ?? `Nodes of kind ${kind}.`, { kind, count: String(count) })),
      envelope(urn, profile(ms, count)), envelope(urn, operation(ms)),
    );
    if (meta?.up.length) entities.push(envelope(urn, lineage(meta.up, ms)));
  }

  // per-rel edge datasets
  const edgeRelUrns: string[] = [];
  for (const [rel, count] of edgesByRel) {
    const meta = EDGE_REL[rel];
    const urn = datasetUrn(`kg.edge.${rel}`);
    edgeRelUrns.push(urn);
    entities.push(
      envelope(urn, props(`kg/edge/${rel}`, meta?.doc ?? `Edges of relation ${rel}.`, { rel, count: String(count), weight_meaning: meta?.weight ?? "n/a" })),
      envelope(urn, profile(ms, count)), envelope(urn, operation(ms)),
    );
    if (meta?.up.length) entities.push(envelope(urn, lineage(meta.up, ms)));
  }

  // roll-ups: store tables derive from the per-kind / per-rel views
  entities.push(envelope(nodeUrn, lineage(nodeKindUrns, ms)), envelope(edgeUrn, lineage(edgeRelUrns, ms)));

  mkdirSync("./.kg-analysis", { recursive: true });
  writeFileSync(out, JSON.stringify(entities, null, 1));
  console.log(`built ${entities.length} aspects — ${nodesByKind.size} node-kind + ${edgesByRel.size} edge-rel + 2 store datasets → ${out}`);
  console.log(`  nodes ${nodes.length} [${[...nodesByKind].map(([k, v]) => `${k} ${v}`).join(" · ")}]`);
  console.log(`  edges ${edges.length} [${[...edgesByRel].map(([k, v]) => `${k} ${v}`).join(" · ")}]`);
  console.log(`  lineage: each kg.edge.<rel> → its raw corpus tables (recomputability); belongs_to/about/bloc/theme → their kg upstreams.`);

  if (push) {
    console.log(`\npushing ${entities.length} aspects → ${GMS}`);
    await post(entities);
    console.log(`\ndone (DataHub is a disposable mirror — rebuildable from kg_* any time).`);
  } else {
    console.log(`\n(no --push: aspects written to file only; the projection is optional and DataHub-free-verifiable.)`);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
