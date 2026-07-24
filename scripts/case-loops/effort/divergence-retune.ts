/* Case ② Effort — Q-effort-6: re-tune componentDivergence (batch 003).
 *
 * batch-002 lens was near-degenerate: componentDivergence = stddev of the 6 ABSOLUTE
 * normalized components (0-1 scale each), same formula for every MP regardless of club
 * norms or how much participation opportunity they'd actually had. Result: most MPs
 * clustered 0.4-0.48 with little spread — not usable for ranking (kernel discriminative-
 * power guardrail, docs/case-loops.md step 2).
 *
 * Retune (per the frontier note + batch-002 steering):
 *   1. CLUB-RELATIVE: each component is compared against its COHORT mean/sd (z-score),
 *      not an absolute 0-1 scale — "one-sided vs this MP's own club norm", not vs a
 *      universal yardstick that ignores club-level baseline differences (opposition clubs
 *      structurally get fewer committee chairs, government clubs structurally speak less
 *      on the floor, etc).
 *   2. PARTICIPATION-PAIRED: the cohort is (club × tenure_class) — using batch 003's new
 *      Q-effort-5 tenure annotation — not just club. A 35-day replacement MP's near-zero
 *      components are compared against OTHER short-tenure MPs' baseline, not against
 *      full-term clubmates who had 9+ months of participation opportunity; comparing a
 *      short-tenure MP to a full-term denominator was exactly the miscategorization risk
 *      the batch-002 steering flagged. Cohorts under 3 members fall back to club-wide,
 *      then population-wide, so small clubs / the 7-MP replacement pool still get a
 *      defined baseline.
 *
 * componentDivergenceV2 = stddev of the 6 per-component cohort z-scores. This measures
 * "how one-sided is this MP's WORK PROFILE relative to comparable peers" instead of
 * "how far is each raw component from the middle of its own 0-1 range" (the old, mostly
 * mechanical, definition).
 *
 * Emits a distribution comparison (old vs new) as validation evidence BEFORE triage.ts
 * is allowed to rank on the new metric — the kernel's own guardrail.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/divergence-retune.ts
 */
import { writeFileSync } from "node:fs";
import { getStore } from "@/lib/db/store";

const TERM = "PSP10";
const OUT = "docs/data-analysis/case-effort";
const COMMITTEE_SAT = 3, LEGIS_SAT = 4, SPEECH_SAT = 40;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);

interface Row {
  pspId: number; name: string; club: string; tenureClass: "full_term" | "replacement";
  comps: number[]; // 6 normalized 0-1 components, same order every row
  oldDivergence: number;
  newDivergence: number;
  basis?: "cohort" | "club" | "population";
}

function meanSd(vals: number[]): { mean: number; sd: number } {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1e-9;
  return { mean, sd };
}

function histogram(vals: number[], width = 0.05, max = 1.0): { bucket: string; count: number }[] {
  const buckets = new Map<number, number>();
  for (const v of vals) {
    const b = Math.min(Math.floor(v / width), Math.floor(max / width));
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([b, c]) => ({
    bucket: `${round(b * width, 2)}-${round((b + 1) * width, 2)}`,
    count: c,
  }));
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");

  const persons = (await store.listKgNodes({ kind: "person", limit: 1000 })) ?? [];
  const mandates = (await store.listMandates({ termCode: TERM })) ?? [];
  const clubByMandate = await store.clubByMandate(TERM);
  const memberships = (await store.listMemberships({ termCode: TERM, limit: 200_000 })) ?? [];

  const clubByPerson = new Map<number, string>();
  for (const m of mandates) {
    const club = clubByMandate.get(m.pspId);
    if (club) clubByPerson.set(m.personPspId, club);
  }

  // ── tenure class, same source as tenure.ts (organ 174 fromAt) ──────────────
  const chamberFrom = new Map<number, string>();
  for (const m of memberships) {
    if (m.organPspId === 174 && m.kind === "member" && m.fromAt) {
      const existing = chamberFrom.get(m.personPspId);
      if (!existing || m.fromAt < existing) chamberFrom.set(m.personPspId, m.fromAt);
    }
  }
  const freq = new Map<string, number>();
  for (const d of chamberFrom.values()) freq.set(d.slice(0, 10), (freq.get(d.slice(0, 10)) ?? 0) + 1);
  let modeDay = "", modeCount = 0;
  for (const [d, n] of freq) if (n > modeCount) { modeDay = d; modeCount = n; }

  const rows: Row[] = persons.map((p) => {
    const pspId = Number(p.id.split(":").pop());
    const club = clubByPerson.get(pspId) ?? "—";
    const committeeCount = num(p.props.committee_count);
    const leadershipCount = num(p.props.leadership_count);
    const participationRate = num(p.props.participation_rate);
    const absenceRate = num(p.props.absence_rate);
    const billsAuthored = num(p.props.bills_authored);
    const interpellations = num(p.props.interpellations);
    const speechTurns = num(p.props.speech_turns);

    const committee = clamp01(committeeCount / COMMITTEE_SAT);
    const leadership = leadershipCount > 0 ? 1 : 0;
    const participation = participationRate;
    const attendance = 1 - absenceRate;
    const legislative = clamp01((billsAuthored + interpellations) / LEGIS_SAT);
    const speech = clamp01(speechTurns / SPEECH_SAT);
    const comps = [committee, leadership, participation, attendance, legislative, speech];

    const oldMean = comps.reduce((a, b) => a + b, 0) / comps.length;
    const oldVariance = comps.reduce((a, b) => a + (b - oldMean) ** 2, 0) / comps.length;

    const fromIso = chamberFrom.get(pspId);
    const tenureClass: Row["tenureClass"] = fromIso && fromIso.slice(0, 10) === modeDay ? "full_term" : "replacement";

    return { pspId, name: p.label, club, tenureClass, comps, oldDivergence: round(Math.sqrt(oldVariance)), newDivergence: 0 };
  });

  // ── cohort = (club, tenureClass); fallback club-wide, then population-wide ─
  const COMPONENT_NAMES = ["committee", "leadership", "participation", "attendance", "legislative", "speech"];
  const cohortKey = (r: Row) => `${r.club}::${r.tenureClass}`;
  const byCohort = new Map<string, Row[]>();
  const byClub = new Map<string, Row[]>();
  for (const r of rows) {
    (byCohort.get(cohortKey(r)) ?? byCohort.set(cohortKey(r), []).get(cohortKey(r))!).push(r);
    (byClub.get(r.club) ?? byClub.set(r.club, []).get(r.club)!).push(r);
  }
  const MIN_COHORT = 3;

  const statsFor = (group: Row[], compIdx: number) => meanSd(group.map((r) => r.comps[compIdx]));
  const popStats = COMPONENT_NAMES.map((_, i) => meanSd(rows.map((r) => r.comps[i])));

  for (const r of rows) {
    let group = byCohort.get(cohortKey(r))!;
    let basis: "cohort" | "club" | "population" = "cohort";
    if (group.length < MIN_COHORT) { group = byClub.get(r.club)!; basis = "club"; }
    if (group.length < MIN_COHORT) basis = "population";

    const zScores = COMPONENT_NAMES.map((_, i) => {
      const { mean, sd } = basis === "population" ? popStats[i] : statsFor(group, i);
      return (r.comps[i] - mean) / sd;
    });
    const { sd: divSd } = meanSd(zScores);
    r.newDivergence = round(divSd);
    r.basis = basis;
  }

  // ── distribution comparison: evidence of discriminative power gain ─────────
  const oldVals = rows.map((r) => r.oldDivergence);
  const newVals = rows.map((r) => r.newDivergence);
  const oldStats = meanSd(oldVals);
  const newStats = meanSd(newVals);
  const oldHist = histogram(oldVals, 0.05, 1.0);
  // new metric is a z-score-of-z-scores spread, unbounded; use a wider bucket + higher max for readability
  const newMax = Math.max(1.5, Math.ceil(Math.max(...newVals) * 2) / 2);
  const newHist = histogram(newVals, newMax / 20, newMax);

  const uniqueOld = new Set(oldVals.map((v) => round(v, 2))).size;
  const uniqueNew = new Set(newVals.map((v) => round(v, 2))).size;

  const evidence = {
    case: "effort",
    batch: 3,
    generatedAt: new Date().toISOString(),
    method:
      "componentDivergenceV2 = stddev of 6 per-component z-scores computed against a (club × tenure_class) cohort baseline " +
      "(fallback club-wide, then population-wide, for cohorts under 3 members). Old metric: stddev of the 6 raw 0-1 " +
      "normalized components with no cohort comparison at all.",
    old: { mean: round(oldStats.mean), sd: round(oldStats.sd), min: round(Math.min(...oldVals)), max: round(Math.max(...oldVals)), distinctValuesAt2dp: uniqueOld, histogram: oldHist },
    new: { mean: round(newStats.mean), sd: round(newStats.sd), min: round(Math.min(...newVals)), max: round(Math.max(...newVals)), distinctValuesAt2dp: uniqueNew, histogram: newHist },
    verdict:
      newStats.sd > oldStats.sd * 1.5
        ? "PASS — new metric shows materially higher spread (sd " + round(newStats.sd) + " vs " + round(oldStats.sd) + "), safe to use for ranking."
        : "FAIL — spread did not improve enough; do not rank on this yet.",
    cohortSizes: [...byCohort.entries()].map(([k, v]) => ({ cohort: k, n: v.length })),
  };
  writeFileSync(`${OUT}/payloads/batch-003-divergence-validation.json`, JSON.stringify(evidence, null, 2));

  console.log("OLD componentDivergence: mean", round(oldStats.mean), "sd", round(oldStats.sd), "distinct(2dp)", uniqueOld);
  console.log("  histogram:", oldHist.map((h) => `${h.bucket}:${h.count}`).join(" "));
  console.log("NEW componentDivergenceV2: mean", round(newStats.mean), "sd", round(newStats.sd), "distinct(2dp)", uniqueNew);
  console.log("  histogram:", newHist.map((h) => `${h.bucket}:${h.count}`).join(" "));
  console.log(evidence.verdict);

  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
