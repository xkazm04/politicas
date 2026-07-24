/* Case ② Effort — GATE the batch-001 wire proposals against the graph COPY.
 *
 * id-membership validation (the kg-verdict pattern): every proposed prop target
 * must resolve to a real person node in the graph, and the enrichment props must
 * be structurally sane (no contribution_* number proposed — computeContribution
 * owns those). Drops + logs any failure; NEVER writes.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts
 */
import { readFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const FORBIDDEN_PROP = /^(contribution_score|participation_rate|committee_count|leadership_count|absence_rate|bills_authored|interpellations|speech_turns|contribution_provenance)$/;

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const payload = JSON.parse(readFileSync("docs/data-analysis/case-effort/payloads/batch-001-props.json", "utf8"));
  const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
  const personIds = new Set(persons.map((p) => p.id));

  let ok = 0;
  const drops: string[] = [];
  for (const prop of payload.proposals as { id: string; name: string; props: Record<string, unknown> }[]) {
    if (!personIds.has(prop.id)) {
      drops.push(`${prop.id} (${prop.name}) — id not a person node in graph`);
      continue;
    }
    const forbidden = Object.keys(prop.props).filter((k) => FORBIDDEN_PROP.test(k));
    if (forbidden.length) {
      drops.push(`${prop.id} (${prop.name}) — proposes deterministic-owned prop(s): ${forbidden.join(", ")}`);
      continue;
    }
    // every effort_* prop must be namespaced
    const badNs = Object.keys(prop.props).filter((k) => !k.startsWith("effort_"));
    if (badNs.length) {
      drops.push(`${prop.id} (${prop.name}) — non-namespaced prop(s): ${badNs.join(", ")}`);
      continue;
    }
    ok++;
  }

  console.log(`GATE · ${payload.proposals.length} proposals · ${ok} PASS · ${drops.length} DROP`);
  if (drops.length) {
    console.log("DROPS:");
    drops.forEach((d) => console.log(`  ✗ ${d}`));
  } else {
    console.log("All proposals reference real person nodes, are effort_*-namespaced, and touch no deterministic-owned number.");
  }
  await store.close();
  process.exit(drops.length ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
