/* Diff the live store's jsonb prop keys against lib/kg/prop-registry.json.
 *
 * Two modes:
 *   npm run da:props-check            — exit 1 on any key in the store that the registry
 *                                        does not list (the drift guard)
 *   npm run da:props-check -- --seed  — (re)write the registry from the live store.
 *                                        Use ONLY to grandfather a deliberate, documented
 *                                        addition; the normal path is to add the key by
 *                                        hand together with its graph-schema.md entry.
 *
 * Runs against whatever PGLITE_PATH points at — a COPY, per the single-connection rule.
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { PROP_REGISTRY, unregisteredKeys } from "@/lib/kg/propRegistry";

const REG_PATH = "lib/kg/prop-registry.json";

async function main() {
  const seed = process.argv.includes("--seed");
  const store = await getStore();
  if (!store) throw new Error("no store");
  const nodes = await store.listKgNodes({ limit: KG_READ_CAP });
  const edges = await store.listKgEdges({ limit: KG_READ_CAP });
  await store.close();

  if (seed) {
    const nk = new Map<string, Set<string>>();
    const ek = new Map<string, Set<string>>();
    for (const n of nodes) {
      const s = nk.get(n.kind) ?? new Set();
      for (const k of Object.keys(n.props ?? {})) s.add(k);
      nk.set(n.kind, s);
    }
    for (const e of edges) {
      const s = ek.get(e.rel) ?? new Set();
      for (const k of Object.keys(e.props ?? {})) s.add(k);
      ek.set(e.rel, s);
    }
    const out = {
      ...PROP_REGISTRY,
      seededAt: new Date().toISOString().slice(0, 10),
      nodes: Object.fromEntries([...nk].sort().map(([k, v]) => [k, [...v].sort()])),
      edges: Object.fromEntries([...ek].sort().map(([k, v]) => [k, [...v].sort()])),
    };
    writeFileSync(REG_PATH, JSON.stringify(out, null, 1) + "\n", "utf8");
    console.log(`seeded ${REG_PATH} from the live store`);
    return;
  }

  const drift = new Map<string, number>();
  for (const n of nodes) for (const k of unregisteredKeys({ kind: n.kind }, n.props)) drift.set(`node:${n.kind}.${k}`, (drift.get(`node:${n.kind}.${k}`) ?? 0) + 1);
  for (const e of edges) for (const k of unregisteredKeys({ rel: e.rel }, e.props)) drift.set(`edge:${e.rel}.${k}`, (drift.get(`edge:${e.rel}.${k}`) ?? 0) + 1);

  if (drift.size === 0) {
    console.log(`props-check: clean — every key in ${nodes.length} nodes / ${edges.length} edges is registered`);
    return;
  }
  console.error(`props-check: ${drift.size} UNREGISTERED key(s) in the live store:`);
  for (const [k, n] of [...drift].sort((a, b) => b[1] - a[1])) console.error(`  ${k}  (${n} rows)`);
  console.error(`\nadd them to ${REG_PATH} + docs/data-analysis/graph-schema.md, or --seed to grandfather deliberately`);
  process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0));
