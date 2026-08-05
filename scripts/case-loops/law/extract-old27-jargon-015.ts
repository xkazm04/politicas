/* batch-015 P1: which reader-facing strings on the ORIGINAL 27 verdicts (passes 12–20, restored
 * from the pass-42 backup) does the render gate withhold, and why. PREPARE step for the sweep. */
import { writeFileSync } from "node:fs";

import { lawJargonIssues } from "@/lib/analysis/law-verdict";
import { czechCopyOrNull } from "@/lib/analysis/language-gate";
import { getStore } from "@/lib/db/store";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const bills = await store.listKgNodes({ kind: "bill" });
  const rows: { cislo: number; field: string; issues: string[]; text: string }[] = [];
  for (const b of bills) {
    const p = b.props as Record<string, unknown>;
    const prov = (p.forensic_provenance ?? {}) as Record<string, unknown>;
    if (!p.forensic_severity || (typeof prov.pass === "number" && prov.pass >= 45)) continue;
    const cislo = Number(p.cislo);
    const fields: [string, unknown][] = [
      ["forensic_stated_reasoning", p.forensic_stated_reasoning],
      ["forensic_researched_context", p.forensic_researched_context],
      ["forensic_conflict_assessment", p.forensic_conflict_assessment],
    ];
    if (Array.isArray(p.forensic_unstated_effects))
      (p.forensic_unstated_effects as Record<string, unknown>[]).forEach((u, i) => {
        fields.push([`forensic_unstated_effects[${i}].effect`, u.effect], [`forensic_unstated_effects[${i}].whoBenefits`, u.whoBenefits], [`forensic_unstated_effects[${i}].evidence`, u.evidence]);
      });
    if (Array.isArray(p.forensic_citations))
      (p.forensic_citations as Record<string, unknown>[]).forEach((c, i) => fields.push([`forensic_citations[${i}].claim`, c.claim]));
    for (const [label, v] of fields) {
      if (typeof v !== "string") continue;
      const issues = lawJargonIssues(v);
      if (czechCopyOrNull(v) === null) issues.push("fails the Czech gate");
      if (issues.length > 0) rows.push({ cislo, field: label, issues, text: v });
    }
  }
  writeFileSync("docs/data-analysis/case-law/payloads/batch-015-old27-jargon.json", JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, rows }, null, 1));
  console.log(`${rows.length} withheld strings across ${new Set(rows.map((r) => r.cislo)).size} bills`);
  for (const r of rows) console.log(`  tisk ${r.cislo} · ${r.field} · ${r.issues[0]}`);
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
