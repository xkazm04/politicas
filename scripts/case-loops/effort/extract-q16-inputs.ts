/* Batch 009 (Q-effort-16) — extract the sample-scoped self-reference debt:
 * every person-node field the strengthened public-copy rule withholds, with
 * full text + matched substrings + the role stats needed to restate a
 * payload-scoped superlative absolutely (or de-scope it).
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/extract-q16-inputs.ts
 * Output: docs/data-analysis/case-effort/payloads/batch-009-inputs.json
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { jargonViolationDetails } from "@/lib/analysis/public-copy";

const FIELDS = ["effort_notes", "effort_public_role", "effort_bill_focus"] as const;

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
  const spoke = await store.listKgEdges({ rel: "spoke_on", limit: 100_000 });
  const rap = await store.listKgEdges({ rel: "rapporteur", limit: 100_000 });
  const amend = await store.listKgEdges({ rel: "proposes_amendment", limit: 100_000 });
  const bills = await store.listKgNodes({ kind: "bill", limit: 5000 });
  const cisloById = new Map(bills.map((b) => [b.id, b.props.cislo]));

  const perPerson = (edges: typeof spoke, id: string) =>
    edges
      .filter((e) => e.src === id)
      .map((e) => ({ cislo: cisloById.get(e.dst) ?? null, weight: e.weight, props: e.props }));

  const units: unknown[] = [];
  let instances = 0;
  for (const n of persons) {
    const p = n.props as Record<string, unknown>;
    const leaking: Record<string, { text: string; matches: { what: string; match: string }[] }> = {};
    for (const f of FIELDS) {
      const t = p[f];
      if (typeof t !== "string" || t.length === 0) continue;
      const v = jargonViolationDetails(t);
      if (v.length > 0) {
        leaking[f] = { text: t, matches: v };
        instances++;
      }
    }
    if (Object.keys(leaking).length === 0) continue;
    units.push({
      id: n.id,
      name: p.name ?? n.label,
      leaking,
      // absolute-restatement material
      bills_authored: p.bills_authored ?? null,
      bills_first_signed: p.bills_first_signed ?? null,
      bills_co_signed: p.bills_co_signed ?? null,
      amendments_authored: p.amendments_authored ?? null,
      speech_turns: p.speech_turns ?? null,
      effort_rapporteur_load: p.effort_rapporteur_load ?? null,
      spoke_on_bills: perPerson(spoke, n.id),
      rapporteur_bills: perPerson(rap, n.id),
      amendment_bills: perPerson(amend, n.id),
    });
  }
  console.log(`leaking nodes: ${units.length} · field-instances: ${instances}`);
  writeFileSync(
    "docs/data-analysis/case-effort/payloads/batch-009-inputs.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), nodes: units.length, instances, units }, null, 2),
  );
  console.log("written: payloads/batch-009-inputs.json");
  await store.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
