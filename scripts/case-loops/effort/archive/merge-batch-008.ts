/* Batch 008 — merge the four group outputs into batch-008-props.json, with the
 * P53 lesson enforced IN CODE: every proposal's public/analyst text must start
 * with the pre-batch text VERBATIM (append-only rewrite). A violation drops the
 * proposal loudly; nothing is silently truncated.
 *
 *   npx tsx scripts/case-loops/effort/merge-batch-008.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "docs/data-analysis/case-effort/payloads";
const inputs = JSON.parse(readFileSync(`${DIR}/batch-008-inputs.json`, "utf8")) as {
  units: { id: string; name: string; current_effort_bill_focus: string | null; current_effort_analyst_note: string | null }[];
};
const priorById = new Map(inputs.units.map((u) => [u.id, u]));

interface Proposal {
  id: string;
  name: string;
  lens: string[];
  headline?: string;
  signal?: number;
  props: Record<string, unknown>;
  citations?: unknown[];
}

const proposals: Proposal[] = [];
const drops: string[] = [];
for (const g of ["A", "B", "C", "D"]) {
  const payload = JSON.parse(readFileSync(`${DIR}/batch-008-group-${g}.json`, "utf8")) as { proposals: Proposal[] };
  for (const p of payload.proposals) {
    const prior = priorById.get(p.id);
    if (!prior) {
      drops.push(`${p.id} (${p.name}) — not a batch-008 unit`);
      continue;
    }
    const checks: [string, string | null][] = [
      ["effort_bill_focus", prior.current_effort_bill_focus],
      ["effort_analyst_note", prior.current_effort_analyst_note],
    ];
    let ok = true;
    for (const [field, priorText] of checks) {
      const v = p.props[field];
      if (priorText == null || priorText.length === 0) continue; // nothing to preserve
      if (typeof v !== "string" || !v.startsWith(priorText)) {
        drops.push(`${p.id} (${p.name}) — ${field} does NOT start with the pre-batch text verbatim (append-only violated)`);
        ok = false;
      }
    }
    if (ok) proposals.push(p);
  }
}

console.log(`merged: ${proposals.length} proposals · dropped: ${drops.length}`);
for (const d of drops) console.log(`  DROP ${d}`);
writeFileSync(
  `${DIR}/batch-008-props.json`,
  JSON.stringify(
    {
      case: "effort",
      batch: 8,
      generatedAt: new Date().toISOString(),
      note: "Batch 008 — role-signal dossier extensions (pass-34/35 data: rapporteur, amendments, signature split, floor engagement). Append-only over prior public text, enforced in this merge script.",
      proposals,
    },
    null,
    2,
  ),
);
console.log(`written: ${DIR}/batch-008-props.json`);
