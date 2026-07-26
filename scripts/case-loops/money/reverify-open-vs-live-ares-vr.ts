/* Money loop — batch 008, Q-money-15: re-verify the LIVE-open corroboration negatives
 * (corroboration = "conflicting" | "registry-unconfirmed") against the LIVE ARES VR
 * endpoint — no caching layer, no reuse of any prior batch's snapshot. Batch 006's Opus
 * pass proved two of these negatives false (ARES VR's live endpoint already had both
 * matches the batch-002 full-population reconciliation missed) — this script generalizes
 * that spot-check to the WHOLE open population instead of trusting the rest by inheritance.
 *
 * Deterministic (no LLM) — same match discipline as reconcile-ares-vr.ts (exact birth-date
 * hinge over statutarniOrgany + ostatniOrgany + spolecnici). A tie only "flips" when the
 * live fetch finds an exact birth-date match the stored props do not currently reflect.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b8 npx tsx scripts/case-loops/money/reverify-open-vs-live-ares-vr.ts
 */
import { getStore } from "@/lib/db/store";
import { AresClient } from "@/lib/analysis/money-feed";

const VR_BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr";
const THROTTLE_MS = 200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}

interface VrFunkce { vznikFunkce?: string; zanikFunkce?: string; nazev?: string; }
interface VrFyzickaOsoba { datumNarozeni?: string; jmeno?: string; prijmeni?: string; }
interface VrClenOrganu { datumZapisu?: string; datumVymazu?: string; clenstvi?: { funkce?: VrFunkce }; fyzickaOsoba?: VrFyzickaOsoba; }
interface VrStatutarniOrgan { clenoveOrganu?: VrClenOrganu[]; }
interface VrPodil { datumZapisu?: string; datumVymazu?: string; velikostPodilu?: { typObnos?: string; hodnota?: string }; }
interface VrSpolecnikOsoba { datumZapisu?: string; datumVymazu?: string; podil?: VrPodil[]; osoba?: { fyzickaOsoba?: VrFyzickaOsoba }; }
interface VrSpolecnici { spolecnik?: VrSpolecnikOsoba[]; }
interface VrZaznam {
  primarniZaznam?: boolean;
  stavSubjektu?: string;
  statutarniOrgany?: VrStatutarniOrgan[];
  ostatniOrgany?: VrStatutarniOrgan[];
  spolecnici?: VrSpolecnici[];
}
interface VrResponse { kod?: string; zaznamy?: VrZaznam[]; }

interface MatchedEntry {
  functionName: string | null;
  validFrom: string | null;
  validTo: string | null;
  stakePct: number | null;
}

function findMatches(rec: VrZaznam, birthDate: string): MatchedEntry[] {
  const out: MatchedEntry[] = [];
  for (const org of [...(rec.statutarniOrgany ?? []), ...(rec.ostatniOrgany ?? [])]) {
    for (const m of org.clenoveOrganu ?? []) {
      if (m.fyzickaOsoba?.datumNarozeni === birthDate) {
        out.push({
          functionName: m.clenstvi?.funkce?.nazev ?? null,
          validFrom: m.clenstvi?.funkce?.vznikFunkce ?? m.datumZapisu ?? null,
          validTo: m.clenstvi?.funkce?.zanikFunkce ?? m.datumVymazu ?? null,
          stakePct: null,
        });
      }
    }
  }
  for (const grp of rec.spolecnici ?? []) {
    for (const s of grp.spolecnik ?? []) {
      if (s.osoba?.fyzickaOsoba?.datumNarozeni === birthDate) {
        const activePodil = (s.podil ?? []).find((p) => !p.datumVymazu) ?? s.podil?.[s.podil.length - 1];
        const pct =
          activePodil?.velikostPodilu?.typObnos === "PROCENTA" && activePodil.velikostPodilu.hodnota
            ? Number(activePodil.velikostPodilu.hodnota.replace(",", "."))
            : null;
        out.push({
          functionName: "společník",
          validFrom: s.datumZapisu ?? null,
          validTo: s.datumVymazu ?? null,
          stakePct: Number.isFinite(pct) ? pct : null,
        });
      }
    }
  }
  return out;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const rosterPersons = await store.listPersons();

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const personById = new Map(persons.map((p) => [p.id, p]));
  const birthByPspId = new Map(rosterPersons.map((p) => [p.pspId, p.birthDateUnknown ? null : p.birthDate]));

  const open = linked.filter((e) => {
    const c = String((e.props as Record<string, unknown>)?.corroboration ?? "");
    return c === "conflicting" || c === "registry-unconfirmed";
  });

  console.log(`=== Q-money-15: re-verifying ${open.length} live-open ties (conflicting + registry-unconfirmed) against LIVE ARES VR ===`);

  const ares = new AresClient();
  // Report rows are heterogeneous per bucket (a flip carries the matched officer
  // record, a negative carries why it stayed negative) — one open record type keeps
  // that honest without an `any`.
  type ReportRow = Record<string, unknown>;
  const flips: ReportRow[] = [];
  const confirmedNegatives: ReportRow[] = [];
  const stillUnresolvable: ReportRow[] = [];
  let processed = 0;

  for (const e of open) {
    const comp = companyById.get(e.dst);
    const pspId = pspIdFromNodeId(e.src);
    const person = personById.get(e.src);
    const priorCorr = String((e.props as Record<string, unknown>)?.corroboration ?? "");
    if (!comp || pspId == null) continue;
    const ico = String(comp.props?.ico ?? comp.id.split(":").pop() ?? "");
    const mp = person?.label ?? String(pspId);
    processed++;
    console.log(`  [${processed}/${open.length}] ${mp} <-> ${comp.label} (${ico}) [prior: ${priorCorr}]`);

    let vr: VrResponse | null;
    try {
      vr = (await ares.vrRecord(ico)) as VrResponse;
    } catch (err) {
      vr = null;
      console.warn(`    fetch failed: ${(err as Error).message}`);
    }
    await sleep(THROTTLE_MS);

    const birthDate = birthByPspId.get(pspId) ?? null;

    if (!vr || vr.kod === "NENALEZENO" || !vr.zaznamy?.length) {
      stillUnresolvable.push({ src: e.src, dst: e.dst, mp, company: comp.label, ico, priorCorr, reason: "vr-ico-not-found-live" });
      continue;
    }
    if (!birthDate) {
      stillUnresolvable.push({ src: e.src, dst: e.dst, mp, company: comp.label, ico, priorCorr, reason: "person-birthdate-unknown" });
      continue;
    }

    const rec = vr.zaznamy.find((z) => z.primarniZaznam) ?? vr.zaznamy[0];
    const matches = findMatches(rec, birthDate);

    if (matches.length > 0) {
      // LIVE finds a match — this is a flip candidate regardless of prior label.
      const roles = [...new Set(matches.map((m) => m.functionName).filter(Boolean))];
      const froms = matches.map((m) => m.validFrom).filter(Boolean).sort();
      const anyOngoing = matches.some((m) => !m.validTo);
      const tos = matches.map((m) => m.validTo).filter(Boolean).sort();
      flips.push({
        src: e.src, rel: "linked_to", dst: e.dst, mp, company: comp.label, ico,
        priorCorr,
        propsMerge: {
          corroboration: "registry-confirmed",
          corroboration_source: `${VR_BASE}/${ico}`,
          role_valid_from: froms[0] ?? null,
          role_valid_to: anyOngoing ? null : (tos[tos.length - 1] ?? null),
          reviewer_note: `Q-money-15 (batch 008): live ARES VR re-check flipped ${priorCorr} → registry-confirmed. Role(s): ${roles.join("/") || "?"}.`,
          flags: ["q-money-15-live-flip"],
        },
      });
    } else {
      // Still no birth-date match live — the negative holds against the live endpoint.
      confirmedNegatives.push({ src: e.src, dst: e.dst, mp, company: comp.label, ico, priorCorr, checkedAt: new Date().toISOString().slice(0, 10) });
    }
  }

  const dir = "docs/data-analysis/case-money";
  const payload = {
    batch: 8,
    track: "money",
    kind: "linked_to-corroboration-annotation",
    generatedAt: new Date().toISOString().slice(0, 10),
    note:
      "PROPOSALS ONLY — props-merge onto EXISTING linked_to edges. Q-money-15: live-endpoint " +
      "re-verification of the open (conflicting + registry-unconfirmed) population against " +
      "ARES VR fetched fresh (no cache). Never creates a person↔company edge, never touches review_state.",
    edges: flips,
  };
  await fs.writeFile(`${dir}/payloads/batch-008-qmoney15-live-flips.json`, JSON.stringify(payload, null, 2));
  await fs.writeFile(`${dir}/qmoney15-summary.json`, JSON.stringify({ processed, flips: flips.length, confirmedNegatives, stillUnresolvable }, null, 2));

  console.log("\n=== Q-MONEY-15 SUMMARY ===");
  console.log(`processed: ${processed}`);
  console.log(`FLIPS (negative → registry-confirmed on live re-check): ${flips.length}`);
  console.log(`confirmed negatives (still no match live): ${confirmedNegatives.length}`);
  console.log(`still unresolvable: ${stillUnresolvable.length}`);
  for (const f of flips) console.log(`  FLIP: ${f.mp} <-> ${f.company} (was ${f.priorCorr})`);

  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
