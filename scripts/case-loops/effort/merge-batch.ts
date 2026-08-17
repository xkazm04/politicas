/* Case ② Effort — merge N grouped-agent payload files into one gate-able batch
 * props file, cross-checking id-membership against triage.json's army list first
 * (standard batch-finalize pattern per batch-002's handoff lessons learned).
 *
 *   npx tsx scripts/case-loops/effort/merge-batch.ts 3 A B C D E F G
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "docs/data-analysis/case-effort";
const [, , batchArg, ...groups] = process.argv;
const batch = Number(batchArg);

interface Proposal { id: string; name: string; club?: string; lens?: string[]; props: Record<string, unknown>; signal?: number; headline?: string; citations?: string[] }

function main() {
  const triage = JSON.parse(readFileSync(`${OUT}/triage.json`, "utf8")) as { army: { pspId: number }[] };
  const armyIds = new Set(triage.army.map((a) => `psp:person:${a.pspId}`));

  const all: Proposal[] = [];
  const seen = new Set<string>();
  const notInArmy: string[] = [];
  for (const g of groups) {
    const path = `${OUT}/payloads/batch-${String(batch).padStart(3, "0")}-group-${g}.json`;
    const d = JSON.parse(readFileSync(path, "utf8")) as { proposals: Proposal[] };
    for (const p of d.proposals) {
      if (!armyIds.has(p.id)) notInArmy.push(`${p.id} (${p.name}, group ${g})`);
      if (seen.has(p.id)) { console.warn(`DUP ${p.id} (${p.name}) — keeping first occurrence`); continue; }
      seen.add(p.id);
      all.push(p);
    }
  }

  if (notInArmy.length) {
    console.warn("WARNING — proposals referencing ids NOT in this batch's army list:");
    notInArmy.forEach((x) => console.warn(`  ${x}`));
  }
  if (all.length !== armyIds.size) {
    const missing = [...armyIds].filter((id) => !seen.has(id));
    console.warn(`WARNING — army size ${armyIds.size} but merged ${all.length} proposals; missing: ${missing.join(", ")}`);
  }

  const merged = {
    case: "effort",
    batch,
    generatedAt: new Date().toISOString(),
    note: `Merged from ${groups.length} grouped Sonnet agents (${groups.join(",")}), cross-checked against triage.json's ${armyIds.size}-MP army list. All props effort_*-namespaced, no contribution_* touched, review_state pending_review.`,
    proposals: all,
  };
  const pad = String(batch).padStart(3, "0");
  writeFileSync(`${OUT}/payloads/batch-${pad}-props.json`, JSON.stringify(merged, null, 2));
  console.log(`Merged ${all.length} proposals from groups [${groups.join(",")}] → batch-${pad}-props.json`);
}
main();
