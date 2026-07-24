/* Case ② Effort — deterministic role_window_mismatch backfill (Q-effort-12 build).
 *
 * The batch-003 army surfaced a THIRD structural floor-artifact class: an MP took
 * a bigger job mid-term (minister/deputy PM/PM/institutional promotion), and the
 * young-term score window predates or excludes the new role. These facts were
 * already gathered and cited during batch-003's own dossiers (psp.cz + vlada.gov +
 * party sources — see docs/data-analysis/case-effort/batch-003.md §Headline
 * finding); this script only ENCODES them as the closed-vocabulary
 * `effort_low_score_reason` prop the existing LowScoreReasonBadge already renders
 * (batch-002 build, O-effort-2) — no new component needed, no LLM call needed,
 * this is annotation of already-verified facts, not new enrichment.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/role-window-mismatch.ts
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-effort/payloads/batch-004-role-window-mismatch.json";

// Sourced from batch-003.md §Headline finding (all dates already cited there against
// vlada.gov.cz / psp.cz / party sources during that batch's army dossiers). Urbanová is
// the one genuinely NEW vocabulary case (institutional_promotion — Deputy Speaker is a
// promotion within the chamber, not an executive-branch departure); the other five reuse
// the existing minister/deputy_pm/prime_minister values.
const ASSIGNMENTS: { pspId: number; name: string; reason: string; publicRole: string }[] = [
  { pspId: 6621, name: "Karel Havlíček", reason: "deputy_pm", publicRole: "1. místopředseda vlády a ministr průmyslu a obchodu od 15. 12. 2025." },
  { pspId: 7022, name: "Petr Macinka", reason: "deputy_pm", publicRole: "Místopředseda vlády a ministr zahraničních věcí od prosince 2025." },
  { pspId: 6545, name: "Alena Schillerová", reason: "minister", publicRole: "Ministryně financí od 15. 12. 2025." },
  { pspId: 6150, name: "Andrej Babiš", reason: "prime_minister", publicRole: "Předseda vlády od 9. 12. 2025." },
  { pspId: 6544, name: "Lubomír Metnar", reason: "minister", publicRole: "Ministr vnitra od 15. 12. 2025 (jeho třetí ministerský post)." },
  { pspId: 6788, name: "Barbora Urbanová", reason: "institutional_promotion", publicRole: "Zvolena místopředsedkyní Poslanecké sněmovny 5. 6. 2026." },
];

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
  const byPsp = new Map(persons.map((p) => [Number(p.id.split(":").pop()), p]));

  const proposals = ASSIGNMENTS.map((a) => {
    const node = byPsp.get(a.pspId);
    if (!node) throw new Error(`${a.name} (${a.pspId}) not found in graph`);
    if (node.label !== a.name) throw new Error(`name mismatch for pspId ${a.pspId}: graph has "${node.label}", expected "${a.name}"`);
    return {
      id: node.id,
      name: node.label,
      props: {
        effort_low_score_reason: a.reason,
        effort_public_role: a.publicRole,
      },
    };
  });

  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: "Q-effort-12 build: role_window_mismatch meta-class backfill (batch-003 §Headline finding, already-cited facts, deterministic encode-only — see docs/case-loops.md role_window_mismatch proposal).",
    proposals,
  }, null, 2));
  console.log(`Wrote ${proposals.length} role_window_mismatch proposals to ${OUT}`);
  proposals.forEach((p) => console.log(`  ${p.name.padEnd(24)} -> ${p.props.effort_low_score_reason}`));
  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
