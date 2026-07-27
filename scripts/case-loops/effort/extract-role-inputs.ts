/* Batch 008 — pre-extract full unit context for the role-signal army (the
 * dossier-inputs.json pattern: army agents never open the DB copy).
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/extract-role-inputs.ts
 * Output: docs/data-analysis/case-effort/payloads/batch-008-inputs.json
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

// 8 rapporteur workhorses + 6 heavy amenders + 2 signature-farming tops (triage 2026-07-27).
const UNITS: number[] = [
  // rapporteur workhorses (≥3 bills)
  6470, // placeholders replaced below by name lookup — see NAMES
];
const NAMES = [
  "Zuzana Ožanová",
  "Marek Novák",
  "Patrik Pařil",
  "Ondřej Babka",
  "Katerina Demetrashvili",
  "Libor Vondráček",
  "Marek Benda",
  "Jiří Pospíšil",
  "Marian Jurečka",
  "Karel Haas",
  "Olga Richterová",
  "Veronika Kovářová",
  "Lucie Sedmihradská",
  "Barbora Urbanová",
  "Tomio Okamura",
  "Marie Kršková",
];

async function main() {
  void UNITS;
  const store = await getStore();
  if (!store) throw new Error("no store");
  const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
  const bills = await store.listKgNodes({ kind: "bill", limit: 5000 });
  const billById = new Map(bills.map((b) => [b.id, b]));
  const sponsors = await store.listKgEdges({ rel: "sponsors", limit: 100_000 });
  const rapporteur = await store.listKgEdges({ rel: "rapporteur", limit: 100_000 });
  const spoke = await store.listKgEdges({ rel: "spoke_on", limit: 100_000 });
  const amend = await store.listKgEdges({ rel: "proposes_amendment", limit: 100_000 });

  const byName = new Map(persons.map((p) => [(p.props.name as string) ?? p.label, p]));
  const out: unknown[] = [];
  const missing: string[] = [];
  for (const name of NAMES) {
    const node = byName.get(name);
    if (!node) {
      missing.push(name);
      continue;
    }
    const p = node.props as Record<string, unknown>;
    const billInfo = (id: string) => {
      const b = billById.get(id);
      const bp = (b?.props ?? {}) as Record<string, unknown>;
      return {
        cislo: bp.cislo ?? null,
        title: b?.label ?? id,
        stav: bp.stav ?? null,
        fate_sb: bp.fate_sb ?? null,
        summary_cz: bp.summary_cz ?? null,
      };
    };
    out.push({
      id: node.id,
      name,
      club: p.club ?? null,
      contribution_score: p.contribution_score ?? null,
      bills_authored: p.bills_authored ?? null,
      bills_first_signed: p.bills_first_signed ?? null,
      bills_co_signed: p.bills_co_signed ?? null,
      amendments_authored: p.amendments_authored ?? null,
      speech_turns: p.speech_turns ?? null,
      effort_tenure_class: p.effort_tenure_class ?? null,
      current_effort_bill_focus: p.effort_bill_focus ?? null,
      current_effort_public_role: p.effort_public_role ?? null,
      current_effort_notes: p.effort_notes ?? null,
      current_effort_analyst_note: p.effort_analyst_note ?? null,
      current_effort_work_themes: p.effort_work_themes ?? null,
      first_signed_bills: sponsors
        .filter((e) => e.src === node.id && (e.props as Record<string, unknown>).role === "predkladatel")
        .map((e) => billInfo(e.dst)),
      co_signed_bills: sponsors
        .filter((e) => e.src === node.id && (e.props as Record<string, unknown>).role === "spolupodepsal")
        .map((e) => billInfo(e.dst)),
      rapporteur_bills: rapporteur
        .filter((e) => e.src === node.id)
        .map((e) => ({ ...billInfo(e.dst), scopes: (e.props as Record<string, unknown>).scopes ?? [] })),
      amendment_bills: amend
        .filter((e) => e.src === node.id)
        .map((e) => ({ ...billInfo(e.dst), amendments: e.weight, sd_cislos: (e.props as Record<string, unknown>).sd_cislos ?? [] })),
      spoke_on_bills: spoke
        .filter((e) => e.src === node.id)
        .map((e) => ({ ...billInfo(e.dst), turns: e.weight }))
        .sort((a, b) => (b.turns as number) - (a.turns as number)),
    });
  }
  if (missing.length) console.warn("MISSING (name lookup failed):", missing.join(", "));
  writeFileSync(
    "docs/data-analysis/case-effort/payloads/batch-008-inputs.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), units: out }, null, 2),
  );
  console.log(`Written ${out.length} units → payloads/batch-008-inputs.json`);
  await store.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
