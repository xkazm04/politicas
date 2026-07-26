/* Q-effort-15 baseline measurement — how many live person nodes fail jargonViolations()
 * on effort_notes/effort_public_role/effort_bill_focus today, and how many of those
 * violations render right now vs are withheld by the render-time guard.
 *
 * PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/measure-baseline.ts
 */
import { getStore } from "@/lib/db/store";
import { jargonViolations } from "@/lib/analysis/public-copy";

const FIELDS = ["effort_notes", "effort_public_role", "effort_bill_focus"] as const;

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const persons = await store.listKgNodes({ kind: "person", limit: 1000 });

  let leakingNodes = 0;
  let fieldInstances = 0;
  let ruleHits = 0;
  const perField: Record<string, number> = { effort_notes: 0, effort_public_role: 0, effort_bill_focus: 0 };
  const rows: { id: string; name: string; field: string; violations: string[]; snippet: string }[] = [];

  for (const p of persons) {
    let nodeLeaks = false;
    for (const field of FIELDS) {
      const text = p.props[field];
      if (typeof text !== "string" || text.length === 0) continue;
      const v = jargonViolations(text);
      if (v.length) {
        nodeLeaks = true;
        fieldInstances++;
        ruleHits += v.length;
        perField[field]++;
        rows.push({ id: p.id, name: p.props.name as string, field, violations: v, snippet: text.slice(0, 160) });
      }
    }
    if (nodeLeaks) leakingNodes++;
  }

  console.log(`BASELINE (live-graph copy) · ${persons.length} person nodes`);
  console.log(`leaking nodes: ${leakingNodes}/${persons.length}`);
  console.log(`field-instances: ${fieldInstances}`);
  console.log(`rule-hits (sum of matched rules across fields): ${ruleHits}`);
  console.log(`by field: ${JSON.stringify(perField)}`);
  console.log(`\nDetail:`);
  for (const r of rows) {
    console.log(`  ${r.id} (${r.name}) — ${r.field}: [${r.violations.join(", ")}] "${r.snippet}"`);
  }

  // Full dump (untruncated text, all three fields per leaking node + club/score context)
  // for the rewrite army to work from.
  const fs = await import("node:fs");
  const full: Record<string, unknown>[] = [];
  for (const p of persons) {
    const leaks: Record<string, string[]> = {};
    for (const field of FIELDS) {
      const text = p.props[field];
      if (typeof text !== "string" || text.length === 0) continue;
      const v = jargonViolations(text);
      if (v.length) leaks[field] = v;
    }
    if (Object.keys(leaks).length === 0) continue;
    full.push({
      id: p.id,
      name: p.props.name,
      club: p.props.club,
      contribution_score: p.props.contribution_score,
      effort_notes: p.props.effort_notes ?? null,
      effort_public_role: p.props.effort_public_role ?? null,
      effort_bill_focus: p.props.effort_bill_focus ?? null,
      effort_low_score_reason: p.props.effort_low_score_reason ?? null,
      effort_analyst_note: p.props.effort_analyst_note ?? null,
      bills_authored: p.props.bills_authored ?? null,
      interpellations: p.props.interpellations ?? null,
      speech_turns: p.props.speech_turns ?? null,
      effort_tenure_days: p.props.effort_tenure_days ?? null,
      leaking_fields: leaks,
    });
  }
  fs.writeFileSync("docs/data-analysis/case-effort/payloads/batch-007-baseline-leaking.json", JSON.stringify({ generatedAt: new Date().toISOString(), leakingNodes, fieldInstances, ruleHits, perField, nodes: full }, null, 2));
  console.log(`\nFull dump written: docs/data-analysis/case-effort/payloads/batch-007-baseline-leaking.json (${full.length} nodes)`);

  await store.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
