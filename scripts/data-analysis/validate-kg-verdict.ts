/* Deterministic gate for a knowledge-graph-loop subagent verdict — the executable
 * "validate every proposal before it touches the graph" rule (design §4.5). The
 * KG analogue of validate-verdict.ts.
 *
 * Reads the verdict text (a file-path arg, or stdin) and checks it against the
 * KgVerdict schema PLUS the entity-id membership gate: every edge endpoint and
 * every `psp:*` urn cited in prose must be a REAL entity (an existing kg_node id
 * or a raw person/organ/vote urn) or a node the verdict itself declares. This is
 * what keeps a hallucinated politician or a fabricated edge out of the graph.
 *
 * Known ids are derived from the live store (PGlite is single-connection — run
 * against a copy if a dev server holds ./.pglite), or supplied offline:
 *
 *   npm run da:validate-kg-verdict -- path/to/verdict.json
 *   some-subagent | npm run da:validate-kg-verdict
 *   npm run da:validate-kg-verdict -- verdict.json --known=known-ids.json   # offline
 */
import { readFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";
import { parseAndValidateKgVerdict } from "@/lib/analysis/kg-verdict";

const knownArg = process.argv.find((a) => a.startsWith("--known="));

function readInput(): string {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (arg) return readFileSync(arg, "utf8");
  return readFileSync(0, "utf8"); // fd 0 = stdin
}

async function knownIds(): Promise<string[]> {
  if (knownArg) {
    const arr: unknown = JSON.parse(readFileSync(knownArg.slice("--known=".length), "utf8"));
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  }
  const store = await getStore();
  if (!store) return [];
  const ids = new Set<string>();
  for (const n of await store.listKgNodes()) ids.add(n.id);
  for (const p of await store.listPersons()) ids.add(p.id);
  for (const o of await store.listOrgans()) ids.add(o.id);
  for (const v of await store.listVoteEvents()) ids.add(v.id); // enables `about` (theme) edges
  await store.close();
  return [...ids];
}

async function main() {
  const text = readInput();
  const ids = await knownIds();
  const result = parseAndValidateKgVerdict(text, { knownIds: ids });

  if (result.ok) {
    const v = result.value!;
    console.log(`OK  target="${v.target}"  (known ids: ${ids.length})`);
    console.log(
      `    nodes=${v.nodes.length} edges=${v.edges.length} patterns=${v.patterns.length} ` +
        `opportunities=${v.featureOpportunities.length} frontier=${v.frontier.length}`,
    );
    process.exit(0);
  }

  console.error(`DRIFT — ${result.errors.length} problem(s); discard and re-run the subagent:`);
  for (const e of result.errors) console.error(`  • ${e}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
