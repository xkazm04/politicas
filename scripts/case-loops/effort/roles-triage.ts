/* Batch 008 triage — the pass-34/35 role signals, computed deterministically.
 *
 * Four new lenses over the 207-MP population (run on a copy; read-only):
 *   1. signature-farming: bills_authored high but bills_first_signed == 0 —
 *      the batch-001 Haas/Šťastný/Vesecká observation, now computed for all.
 *   2. rapporteur load: # of rapporteur edges (scopes counted) — the assigned
 *      analytical work the contribution index cannot see (positive symmetry).
 *   3. amendment activity: amendments_authored (86 nonzero measured at pass 35).
 *   4. sponsor-never-spoke: first-signatory bills where the MP has NO spoke_on
 *      edge on their own bill (floor absence on own agenda).
 * Kernel guardrail: discriminative power is printed for each lens BEFORE any
 * ranking use — a signal firing on >50 % of units is degenerate.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/roles-triage.ts
 * Output: docs/data-analysis/case-effort/payloads/batch-008-roles-triage.json
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

interface UnitSignals {
  pspId: number;
  name: string;
  club: string | null;
  contribution: number | null;
  billsAuthored: number;
  firstSigned: number;
  coSigned: number;
  rapporteurBills: number;
  rapporteurScopes: string[];
  amendments: number;
  spokeOnBills: number;
  spokeTurns: number;
  ownBillsNotSpokenOn: number; // first-signed bills with no spoke_on edge
  signatureFarming: boolean; // authored ≥3, first-signed 0
  flags: string[];
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const nodes = await store.listKgNodes({ kind: "person", limit: 1000 });
  const sponsors = await store.listKgEdges({ rel: "sponsors", limit: 100_000 });
  const rapporteur = await store.listKgEdges({ rel: "rapporteur", limit: 100_000 });
  const spoke = await store.listKgEdges({ rel: "spoke_on", limit: 100_000 });

  const spokeByPerson = new Map<string, { bills: Set<string>; turns: number }>();
  for (const e of spoke) {
    const s = spokeByPerson.get(e.src) ?? { bills: new Set<string>(), turns: 0 };
    s.bills.add(e.dst);
    s.turns += typeof e.weight === "number" ? e.weight : 0;
    spokeByPerson.set(e.src, s);
  }
  const rapByPerson = new Map<string, { bills: Set<string>; scopes: Set<string> }>();
  for (const e of rapporteur) {
    const s = rapByPerson.get(e.src) ?? { bills: new Set<string>(), scopes: new Set<string>() };
    s.bills.add(e.dst);
    const scopes = Array.isArray(e.props.scopes) ? (e.props.scopes as string[]) : [];
    for (const sc of scopes) s.scopes.add(sc);
    rapByPerson.set(e.src, s);
  }
  const firstSignedBillsByPerson = new Map<string, string[]>();
  for (const e of sponsors) {
    if ((e.props as Record<string, unknown>).role !== "predkladatel") continue;
    const arr = firstSignedBillsByPerson.get(e.src) ?? [];
    arr.push(e.dst);
    firstSignedBillsByPerson.set(e.src, arr);
  }

  const units: UnitSignals[] = [];
  for (const n of nodes) {
    const p = n.props as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const spokeS = spokeByPerson.get(n.id);
    const rapS = rapByPerson.get(n.id);
    const ownBills = firstSignedBillsByPerson.get(n.id) ?? [];
    const ownNotSpoken = ownBills.filter((b) => !spokeS?.bills.has(b)).length;
    const billsAuthored = num(p.bills_authored);
    const firstSigned = num(p.bills_first_signed);
    const u: UnitSignals = {
      pspId: Number(n.id.split(":").pop()),
      name: typeof p.name === "string" ? p.name : n.label,
      club: typeof p.club === "string" ? p.club : null,
      contribution: typeof p.contribution_score === "number" ? p.contribution_score : null,
      billsAuthored,
      firstSigned,
      coSigned: num(p.bills_co_signed),
      rapporteurBills: rapS?.bills.size ?? 0,
      rapporteurScopes: [...(rapS?.scopes ?? [])].sort(),
      amendments: num(p.amendments_authored),
      spokeOnBills: spokeS?.bills.size ?? 0,
      spokeTurns: spokeS?.turns ?? 0,
      ownBillsNotSpokenOn: ownNotSpoken,
      signatureFarming: billsAuthored >= 3 && firstSigned === 0,
      flags: [],
    };
    if (u.signatureFarming) u.flags.push("signature_farming_candidate");
    if (u.rapporteurBills >= 3) u.flags.push("rapporteur_workhorse");
    if (u.amendments >= 10) u.flags.push("heavy_amender");
    if (u.ownBillsNotSpokenOn > 0) u.flags.push("own_bill_not_defended_on_floor");
    units.push(u);
  }

  // Discriminative power per lens (kernel guardrail: >50 % fire = degenerate).
  const fires = (f: (u: UnitSignals) => boolean) => units.filter(f).length;
  const lenses = {
    signature_farming: fires((u) => u.signatureFarming),
    rapporteur_any: fires((u) => u.rapporteurBills > 0),
    rapporteur_workhorse_ge3: fires((u) => u.rapporteurBills >= 3),
    amendments_any: fires((u) => u.amendments > 0),
    heavy_amender_ge10: fires((u) => u.amendments >= 10),
    own_bill_not_defended: fires((u) => u.ownBillsNotSpokenOn > 0),
    spoke_on_any_bill: fires((u) => u.spokeOnBills > 0),
  };
  console.log(`Batch 008 roles triage · ${units.length} units`);
  for (const [k, v] of Object.entries(lenses)) {
    const pct = ((100 * v) / units.length).toFixed(1);
    console.log(`  ${k}: ${v}/${units.length} (${pct} %)${v / units.length > 0.5 ? "  ⚠ DEGENERATE (>50 %)" : ""}`);
  }

  const top = (key: (u: UnitSignals) => number, n = 8) =>
    [...units].sort((a, b) => key(b) - key(a)).slice(0, n).filter((u) => key(u) > 0);
  console.log(`\nTop rapporteur load:`);
  for (const u of top((x) => x.rapporteurBills)) console.log(`  ${u.name} (${u.club}) — ${u.rapporteurBills} bills [${u.rapporteurScopes.join(",")}] · contribution ${u.contribution}`);
  console.log(`\nTop amenders:`);
  for (const u of top((x) => x.amendments)) console.log(`  ${u.name} (${u.club}) — ${u.amendments} amendments · contribution ${u.contribution}`);
  console.log(`\nSignature-farming candidates (authored ≥3, first-signed 0):`);
  for (const u of units.filter((x) => x.signatureFarming).sort((a, b) => b.billsAuthored - a.billsAuthored))
    console.log(`  ${u.name} (${u.club}) — authored ${u.billsAuthored}, all co-signed · contribution ${u.contribution}`);
  console.log(`\nOwn bill never defended on floor:`);
  for (const u of units.filter((x) => x.ownBillsNotSpokenOn > 0).sort((a, b) => b.ownBillsNotSpokenOn - a.ownBillsNotSpokenOn).slice(0, 12))
    console.log(`  ${u.name} (${u.club}) — ${u.ownBillsNotSpokenOn} of ${u.firstSigned} first-signed bills without a floor turn`);

  writeFileSync(
    "docs/data-analysis/case-effort/payloads/batch-008-roles-triage.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), lenses, units }, null, 2),
  );
  console.log(`\nWritten: payloads/batch-008-roles-triage.json`);
  await store.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
