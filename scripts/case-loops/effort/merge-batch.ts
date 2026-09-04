/* Case ② Effort — merge N grouped-agent payload files into one gate-able batch
 * props file, cross-checking id-membership against triage.json's army list first
 * (standard batch-finalize pattern per batch-002's handoff lessons learned).
 *
 *   npx tsx scripts/case-loops/effort/merge-batch.ts 3 A B C D E F G
 */
import { readFileSync, writeFileSync } from "node:fs";
import { EFFORT_VERDICT_FIELDS } from "../../../lib/analysis/verdict-provenance";

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

  // ── Stamp the rung (G2, deck #12) ──────────────────────────────────────────
  // Every effort verdict about a NAMED PERSON leaves this loop as `machine`:
  // the pipeline said it, nobody has looked. That is the bottom rung, and it is
  // the ONLY one a script may write — `verified` is producible exclusively by
  // ReviewRepository.setReviewState, so no enrichment pass can promote its own
  // claim to a human-confirmed one.
  //
  // Merge-preserving in both directions: an existing `effort_provenance` keeps
  // every key it had (computedAt, pass, track…), and a verdict entry a human has
  // ALREADY decided is left exactly as it is — re-running the loop must never
  // reset a reviewed claim back to "nobody looked at this".
  let stamped = 0;
  let preserved = 0;
  for (const p of all) {
    const prov = (p.props.effort_provenance ?? {}) as Record<string, unknown>;
    const verdicts = { ...((prov.verdicts ?? {}) as Record<string, unknown>) };
    let touched = false;
    for (const field of EFFORT_VERDICT_FIELDS) {
      if (p.props[field] === undefined || p.props[field] === null) continue;
      if (verdicts[field] !== undefined) {
        preserved++;
        continue;
      }
      verdicts[field] = { review_state: "machine" };
      stamped++;
      touched = true;
    }
    if (touched || Object.keys(verdicts).length > 0) {
      p.props.effort_provenance = { ...prov, verdicts };
    }
  }

  const merged = {
    case: "effort",
    batch,
    generatedAt: new Date().toISOString(),
    note: `Merged from ${groups.length} grouped Sonnet agents (${groups.join(",")}), cross-checked against triage.json's ${armyIds.size}-MP army list. All props effort_*-namespaced, no contribution_* touched. Every verdict prop stamped effort_provenance.verdicts.<field>.review_state = "machine" — the bottom rung; only ReviewRepository.setReviewState can raise it.`,
    proposals: all,
  };
  console.log(`Rung stamp: ${stamped} verdict(s) stamped machine, ${preserved} left as already-decided.`);
  const pad = String(batch).padStart(3, "0");
  writeFileSync(`${OUT}/payloads/batch-${pad}-props.json`, JSON.stringify(merged, null, 2));
  console.log(`Merged ${all.length} proposals from groups [${groups.join(",")}] → batch-${pad}-props.json`);
}
main();
