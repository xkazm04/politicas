/* Case ② Effort — Q-effort-5: deterministic TENURE annotation over the 207 PSP10 person nodes.
 *
 * Batch-003. Contextual annotation ONLY — writes NO contribution_* number, never touches
 * computeContribution's inputs or outputs. Grounds P38 (replacement-MP tenure artifact,
 * discovered batch 002 via LLM enrichment on 4 named MPs) with a real deterministic date
 * source, extended to the full population.
 *
 * Data source: the person's own MEMBERSHIP row in organ 174 (abbrev "PSP10", the chamber
 * itself, organTypeCz "Poslanecká sněmovna", kind="member"). `fromAt` on that row is the
 * date the person's PSP10 mandate began — for the 200 MPs seated at the 2025-10-04 general
 * election this is the election date; for MPs seated mid-term (replacement after a
 * predecessor declined/resigned) it is their individual swearing-in date. Verified this is
 * populated for all 207/207 persons (the mandate table's own mandateFrom/mandateTo columns
 * are almost entirely null in this ingest — NOT usable; membership.fromAt on organ 174 is
 * the only reliable per-person date in the current schema).
 *
 * tenure_class (END-DATE-AWARE — the batch-003 Opus reflection caught that a fromAt-only
 * version misclassified every departed MP, including the four never-sworn phantoms, as a
 * 293-day full_term; membership.toAt on the same organ-174 row carries the departure date
 * and is populated for exactly the 7 departed seats):
 *   - "full_term"    fromAt == the population-mode start date (2025-10-04) and no toAt
 *   - "replacement"  fromAt later than the mode date — seated mid-term
 *   - "departed"     toAt set (mandate ended mid-term) and the MP actually served
 *   - "never_seated" toAt set AND participation_rate==0 && committee_count==0 (the
 *                    never_cast_ballot signature) — mandate arose but was never exercised;
 *                    tenure_days for this class is reported as the formal mandate span, but
 *                    the class itself marks it as not-actually-served
 * NOTE on semantics: fromAt is the date the MANDATE AROSE (mandát vznikl), not the oath
 * date — e.g. Nerušil's mandate arose 2026-03-11, oath 24.3.2026. Any UI copy must say
 * "mandát vznikl", not "složil(a) slib".
 *
 * Output: docs/data-analysis/case-effort/payloads/batch-003-tenure.json — effort_tenure_days
 * (int, as of REFERENCE_DATE) + effort_tenure_class (full_term|replacement) for all 207,
 * gate-able via gate.ts like any other props payload.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/tenure.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const TERM = "PSP10";
const OUT = "docs/data-analysis/case-effort";
const CHAMBER_ORGAN_PSP_ID = 174; // organ.abbrev === "PSP10", the term chamber itself
const REFERENCE_DATE = new Date("2026-07-24T00:00:00.000Z"); // batch-003 run date

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");

  const persons = (await store.listKgNodes({ kind: "person", limit: 1000 })) ?? [];
  const memberships = (await store.listMemberships({ termCode: TERM, limit: 200_000 })) ?? [];

  const chamberRowByPerson = new Map<number, { fromAt: string; toAt: string | null }>();
  for (const m of memberships) {
    if (m.organPspId === CHAMBER_ORGAN_PSP_ID && m.kind === "member" && m.fromAt) {
      // a person should have exactly one; if the ingest ever produces >1, keep the earliest
      const existing = chamberRowByPerson.get(m.personPspId);
      if (!existing || m.fromAt < existing.fromAt) chamberRowByPerson.set(m.personPspId, { fromAt: m.fromAt, toAt: m.toAt ?? null });
    }
  }

  // ── mode start date (the election-day baseline) ────────────────────────────
  const freq = new Map<string, number>();
  for (const d of chamberRowByPerson.values()) {
    const day = d.fromAt.slice(0, 10);
    freq.set(day, (freq.get(day) ?? 0) + 1);
  }
  let modeDay = "";
  let modeCount = 0;
  for (const [day, n] of freq) if (n > modeCount) { modeDay = day; modeCount = n; }

  const missing: number[] = [];
  const rows: {
    pspId: number;
    name: string;
    fromDate: string | null;
    toDate: string | null;
    tenureDays: number | null;
    tenureClass: "full_term" | "replacement" | "departed" | "never_seated" | null;
  }[] = [];

  for (const p of persons) {
    const pspId = Number(p.id.split(":").pop());
    const row = chamberRowByPerson.get(pspId) ?? null;
    if (!row) {
      missing.push(pspId);
      rows.push({ pspId, name: p.label, fromDate: null, toDate: null, tenureDays: null, tenureClass: null });
      continue;
    }
    const fromDate = row.fromAt.slice(0, 10);
    const toDate = row.toAt ? row.toAt.slice(0, 10) : null;
    const end = row.toAt ? new Date(row.toAt) : REFERENCE_DATE;
    const tenureDays = Math.round((end.getTime() - new Date(row.fromAt).getTime()) / 86_400_000);
    const neverCast = (typeof p.props.participation_rate !== "number" || p.props.participation_rate === 0)
      && (typeof p.props.committee_count !== "number" || p.props.committee_count === 0);
    const tenureClass = row.toAt
      ? (neverCast ? "never_seated" : "departed")
      : fromDate === modeDay ? "full_term" : "replacement";
    rows.push({ pspId, name: p.label, fromDate, toDate, tenureDays, tenureClass });
  }

  const replacements = rows.filter((r) => r.tenureClass === "replacement");
  const departed = rows.filter((r) => r.tenureClass === "departed" || r.tenureClass === "never_seated");

  mkdirSync(`${OUT}/payloads`, { recursive: true });
  const payload = {
    case: "effort",
    batch: 3,
    generatedAt: new Date().toISOString(),
    note:
      "Q-effort-5 tenure annotation (deterministic, no LLM). Source: membership.fromAt/toAt on organ 174 (the PSP10 chamber itself). " +
      `Mode start date = ${modeDay} (${modeCount}/${rows.length} MPs, the 2025-10-04 general election). ` +
      "END-DATE-AWARE (batch-003 reflection fix): toAt-bearing rows classify as departed/never_seated with tenure_days bounded " +
      "by the departure date, not the reference date. fromAt = date the mandate AROSE (mandát vznikl), NOT the oath date. " +
      "Annotation-only: no contribution_* number touched. review_state stays pending_review.",
    modeStartDate: modeDay,
    modeCount,
    referenceDate: REFERENCE_DATE.toISOString().slice(0, 10),
    missingCount: missing.length,
    missingPspIds: missing,
    replacementCount: replacements.length,
    departedCount: departed.length,
    proposals: rows
      .filter((r) => r.tenureClass !== null)
      .map((r) => ({
        id: `psp:person:${r.pspId}`,
        name: r.name,
        props: {
          effort_tenure_days: r.tenureDays,
          effort_tenure_class: r.tenureClass,
          effort_tenure_start: r.fromDate,
          ...(r.toDate ? { effort_tenure_end: r.toDate } : {}),
        },
      })),
  };
  writeFileSync(`${OUT}/payloads/batch-003-tenure.json`, JSON.stringify(payload, null, 2));

  console.log(`TENURE · ${rows.length} MPs · mode start ${modeDay} (${modeCount}) · ${missing.length} missing fromAt`);
  console.log(`replacement MPs (fromAt != mode day, still serving): ${replacements.length}`);
  replacements
    .sort((a, b) => (a.tenureDays! - b.tenureDays!))
    .forEach((r) => console.log(`  ⚑ ${r.name.padEnd(28)} mandate arose ${r.fromDate} · tenure ${r.tenureDays}d`));
  console.log(`departed/never_seated (toAt set): ${departed.length}`);
  departed
    .sort((a, b) => (a.tenureDays! - b.tenureDays!))
    .forEach((r) => console.log(`  ⚐ ${r.name.padEnd(28)} ${r.fromDate} → ${r.toDate} · ${r.tenureDays}d · ${r.tenureClass}`));

  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
