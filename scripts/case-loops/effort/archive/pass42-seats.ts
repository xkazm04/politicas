/* Case ② Effort — batch 010: the ACTUAL seat list behind each contested committee count.
 *
 * The prose rewrite needs the bodies themselves, not just the corrected integer: several
 * of the 14 stale sentences enumerate organs („výborů a komisí"), and a rewrite that only
 * swaps a numeral would be as unsourced as the number it replaces.
 *
 * Also emits the population-wide organ-type census, because `committee_count` counts
 * DISTINCT BODIES across COMMITTEE_ORGAN_TYPES (Výbor · Komise · Delegace · Vyšetřovací
 * komise · Podvýbor) — so how many seats of each type actually EXIST in the ingest
 * decides whether a „podvýbor" sentence is comparable to the prop at all.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/pass42-seats.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { getStore } from "@/lib/db/store";
import { COMMITTEE_ORGAN_TYPES, isCommitteeSeat, isLeadership, type CommitteeSeat } from "@/lib/analysis/contribution";

const OUT = "docs/data-analysis/case-effort";
const TERM = "PSP10";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");

  const scan = JSON.parse(readFileSync(`${OUT}/payloads/batch-010-prose-scan.json`, "utf8")) as {
    findings: { pspId: number; name: string; field: string; claimed: number; corrected: number; preCorrection: number; raw: string; window: string }[];
  };
  const targets = new Map(scan.findings.map((f) => [f.pspId, f]));

  // Organ identity/type exactly as extract-dossiers.ts builds it — `organTypeCz` is the
  // field `isCommitteeSeat` is written against; do not re-derive it another way.
  const organs = (await store.listOrgans({ limit: 5000 })) ?? [];
  const organById = new Map(organs.map((o) => [o.pspId, o]));
  const memberships = (await store.listMemberships({ termCode: TERM, limit: 200_000 })) ?? [];

  // ── population census: which organ types actually carry membership rows ──────
  const typeCensus = new Map<string, number>();
  for (const m of memberships) {
    const t = (m.organPspId != null ? organById.get(m.organPspId)?.organTypeCz : null) ?? "(unknown)";
    typeCensus.set(t, (typeCensus.get(t) ?? 0) + 1);
  }
  console.log("membership rows by organ type (PSP10):");
  for (const [t, n] of [...typeCensus].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${t}${(COMMITTEE_ORGAN_TYPES as readonly string[]).includes(t) ? "   ← counted by committee_count" : ""}`);
  }

  // ── per-target seat list ────────────────────────────────────────────────────
  interface SeatRow { organPspId: number | null; organName: string; organType: string | null; functionType: string | null; seat: CommitteeSeat; fromAt: string | null; toAt: string | null }
  const seatsByPerson = new Map<number, SeatRow[]>();
  for (const m of memberships) {
    if (!targets.has(m.personPspId)) continue;
    const o = m.organPspId != null ? organById.get(m.organPspId) : undefined;
    const organType = o?.organTypeCz ?? null;
    const row: SeatRow = {
      organPspId: m.organPspId,
      organName: o?.nameCz ?? o?.abbrev ?? `organ ${m.organPspId}`,
      organType,
      functionType: m.functionTypeCz,
      seat: { organPspId: m.organPspId, organType, functionType: m.functionTypeCz },
      fromAt: m.fromAt ?? null,
      toAt: m.toAt ?? null,
    };
    seatsByPerson.set(m.personPspId, [...(seatsByPerson.get(m.personPspId) ?? []), row]);
  }

  const units = [...targets.values()].map((f) => {
    const seats = seatsByPerson.get(f.pspId) ?? [];
    const counted = seats.filter((s) => isCommitteeSeat(s.seat));
    // Same identity rule as computeContribution's seatKey: distinct ORGAN, and a row with
    // no organ id keeps its own identity rather than being merged on a guess.
    const distinctBodies = new Map<string, { organName: string; organType: string | null; roles: string[]; leads: boolean }>();
    counted.forEach((s, i) => {
      const key = typeof s.organPspId === "number" ? `organ:${s.organPspId}` : `row:${i}`;
      const e = distinctBodies.get(key) ?? { organName: s.organName, organType: s.organType, roles: [], leads: false };
      const role = s.functionType ?? "člen";
      if (!e.roles.includes(role)) e.roles.push(role);
      if (isLeadership(s.seat)) e.leads = true;
      distinctBodies.set(key, e);
    });
    return {
      ...f,
      allSeatRows: seats.length,
      countedSeatRows: counted.length,
      distinctBodyCount: distinctBodies.size,
      bodies: [...distinctBodies.entries()].map(([key, b]) => ({ key, ...b, filedTwice: b.roles.length > 1 })),
      nonCommitteeOrganTypes: [...new Set(seats.filter((s) => !isCommitteeSeat(s.seat)).map((s) => s.organType ?? "(unknown)"))],
    };
  });

  console.log(`\n${units.length} target MPs — seat rows vs distinct bodies:`);
  for (const u of units.sort((a, b) => a.name.localeCompare(b.name, "cs"))) {
    const ok = u.distinctBodyCount === u.corrected ? "✓" : "✗ MISMATCH vs stored committee_count";
    console.log(`\n  ${u.name} — prose claims ${u.claimed} · stored (pass 42) ${u.corrected} · pre-42 ${u.preCorrection} · recomputed distinct bodies ${u.distinctBodyCount} ${ok}`);
    console.log(`    counted rows ${u.countedSeatRows} (all rows ${u.allSeatRows}); bodies:`);
    for (const b of u.bodies) console.log(`      · ${b.organName} [${b.organType}] roles=${b.roles.join(" + ")}${b.filedTwice ? "  ← filed twice (the pass-42 defect)" : ""}`);
    if (u.nonCommitteeOrganTypes.length) console.log(`    (not counted: ${u.nonCommitteeOrganTypes.join(", ")})`);
  }

  mkdirSync(`${OUT}/payloads`, { recursive: true });
  writeFileSync(`${OUT}/payloads/batch-010-seats.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    organTypeCensus: Object.fromEntries(typeCensus),
    committeeOrganTypes: COMMITTEE_ORGAN_TYPES,
    units,
  }, null, 2));
  console.log(`\nwrote ${OUT}/payloads/batch-010-seats.json`);

  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
