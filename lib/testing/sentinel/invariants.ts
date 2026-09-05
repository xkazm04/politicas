/*
 * LIVE-GRAPH SENTINEL — invariant evaluation (batch-7 item 7E). PURE: takes two
 * collected fact passes + the evaluation instant and returns a verdict; no I/O,
 * no Date.now(), so the same facts always produce the same report (tested in
 * ./sentinel.test.ts against fixture stores).
 *
 * Ground truths (read, never redefined here):
 *   • manifest bounds  — features/data-releases/manifest.ts deriveReleaseManifest
 *     (version cut, degraded flag, published totals).
 *   • readiness floors — lib/db/readiness.ts CARDINALITY_FLOORS via floorVerdicts.
 *   • freshness        — lib/analysis/atlas.ts SOURCE_CADENCE_DAYS + the shared
 *     staleness vocabulary (stalenessOf; "zastaralé" = age > cadence × 2, the same
 *     threshold the /admin loops call "stalled").
 *   • audit chain      — lib/db/pglite/ledger.ts verifyAuditChain (already run
 *     during collection; judged here).
 *
 * Triage convention (proposal infrastructure-observability.md § M2): a red
 * sentinel is a DATA problem, not a code bug — fix the data or the ingest,
 * never loosen the invariant to make the run green.
 */

import {
  ageDaysBetween,
  deriveAtlas,
  stalenessOf,
  SOURCE_CADENCE_DAYS,
} from "@/lib/analysis/atlas";
import {
  computeContribution,
  CONTRIBUTION_FORMULA_REF,
  type CommitteeSeat,
  type ContributionInputs,
} from "@/lib/analysis/contribution";
import { canonicalJson, sha256Hex } from "@/lib/db/pglite/ledger";
import { loaderFailureDisplayPath } from "@/lib/db/loaderFailureLog";
import { reviewTier, TIE_CLASSES, type TieClass } from "@/features/money/reviewTypes";
import { floorVerdicts } from "@/lib/db/readiness";
import { deriveReleaseManifest, type ReleaseManifest } from "@/features/data-releases/manifest";
import type { PersonScoreFact, SentinelFacts } from "./facts";
import type { SentinelCheck, SentinelReport } from "./report";
import { SENTINEL_SCHEMA, sentinelVerdict } from "./report";

const ok = (id: string, label: string, detail: string): SentinelCheck => ({
  id,
  label,
  status: "ok",
  detail,
});
const violation = (id: string, label: string, detail: string): SentinelCheck => ({
  id,
  label,
  status: "violation",
  detail,
});
/**
 * NOT ok and NOT a violation: there was nothing here to judge. Use it only when
 * the ABSENCE of a judgement is the truth — an empty ledger, a layer the run
 * never reached. Never for "the data looks wrong but I'd rather not say".
 */
const unevaluable = (id: string, label: string, detail: string): SentinelCheck => ({
  id,
  label,
  status: "unevaluable",
  detail,
});

/* ── individual invariants ─────────────────────────────────────────────────── */

function checkManifestBounds(manifest: ReleaseManifest, facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "manifest-bounds";
  const label = SENTINEL_CHECK_LABELS[id];
  const problems: string[] = [];
  if (manifest.version === null) {
    problems.push("no released version (no finished ok ingest run — an unreleased store has no bounds to hold)");
  }
  if (manifest.degraded) {
    problems.push(
      `manifest is DEGRADED: ${manifest.verdicts
        .filter((v) => !v.ok)
        .map((v) => `${v.kind} ${v.count}<${v.floor}`)
        .join(", ")}`,
    );
  }
  const kindSum = facts.releaseStats.kindCounts.reduce((n, k) => n + k.count, 0);
  if (kindSum !== manifest.counts.kgNodes) {
    problems.push(`kind counts sum ${kindSum} ≠ published node total ${manifest.counts.kgNodes}`);
  }
  const relSum = manifest.counts.edgeRels.reduce((n, r) => n + r.count, 0);
  if (relSum !== manifest.counts.kgEdges) {
    problems.push(`edge-rel counts sum ${relSum} ≠ published edge total ${manifest.counts.kgEdges}`);
  }
  if (problems.length > 0) return violation(id, label, problems.join("; "));
  return ok(
    id,
    label,
    `version ${manifest.version} · ${manifest.counts.kgNodes} nodes / ${manifest.counts.kgEdges} edges / ` +
      `${manifest.counts.voteBallots} ballots · totals reconcile with per-kind and per-rel sums`,
  );
}

function checkReadinessFloors(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "readiness-floors";
  const label = SENTINEL_CHECK_LABELS[id];
  const verdicts = floorVerdicts(
    Object.fromEntries(facts.releaseStats.kindCounts.map((k) => [k.kind, k.count])),
  );
  const failing = verdicts.filter((v) => !v.ok);
  const summary = verdicts.map((v) => `${v.kind} ${v.count}/${v.floor}`).join(" · ");
  if (failing.length > 0) {
    return violation(id, label, `below floor: ${failing.map((v) => `${v.kind} ${v.count}<${v.floor}`).join(", ")}`);
  }
  return ok(id, label, summary);
}

/**
 * The chain, judged against the LEDGER it is supposed to cover.
 *
 * What this used to be, and why it was worse than useless (fixed 2026-08-13):
 * every chain read filters `where chain_pos is not null`, so an empty filtered
 * set was reported as "chain is empty — trivially valid". Tamper with one row
 * and the invariant fires; run `update review_audit set chain_pos = null` and
 * the whole tamper-evident ledger disappears with a PASS. The erasure was the
 * cheapest attack on the chain AND the only one the sentinel endorsed.
 *
 * Three findings now, because they are three different facts:
 *   • rows outside the chain      → VIOLATION, naming both counts;
 *   • no rows at all              → UNEVALUABLE (nothing has been decided, so
 *                                   the chain proves nothing — that is not a pass);
 *   • chained rows that verify    → ok.
 */
function checkAuditChain(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "audit-chain";
  const label = SENTINEL_CHECK_LABELS[id];
  const chain = facts.chain;
  const { total, chained } = facts.auditCounts;
  if (!chain.ok) {
    const d = chain.firstDivergence;
    return violation(
      id,
      label,
      `chain of ${chain.length} diverges at pos ${d.chainPos} (row ${d.id}): ${d.reason} — expected ${d.expected}, actual ${d.actual}`,
    );
  }
  if (chained < total) {
    return violation(
      id,
      label,
      `${chained} of ${total} review_audit row(s) carry a chain_pos — ${total - chained} decision(s) sit ` +
        `OUTSIDE the tamper-evident chain. No writer in this repo produces an unchained row ` +
        `(setTieReviewState appends the chained row in its own transaction), so this is erasure or a ` +
        `foreign write, not a gap. The chain cannot vouch for what it does not cover.`,
    );
  }
  if (total === 0) {
    return unevaluable(
      id,
      label,
      "review_audit holds no rows — no review decision has ever been recorded, so there is no chain to " +
        "verify. Not a pass: an empty ledger proves nothing about tamper-evidence.",
    );
  }
  return ok(id, label, `all ${total} review_audit rows are chained and verify; head ${chain.headHash}`);
}

/* ── [G2 review door] two checks over the door itself ─────────────────────── */

/**
 * REVIEW COVERAGE: per claim kind, how much of the population a human has
 * decided — decided / pending / total, NEVER a rate without its denominator.
 *
 * This check does not fail on a low number. A queue nobody has worked yet is a
 * fact about the operation, not a defect in the data, and a sentinel that goes
 * red for it would be turned off within a week. What it refuses is a MISSING
 * DENOMINATOR: a kind whose population it cannot count is `unevaluable`, because
 * „0 decided" is meaningless without the number it is 0 of — and that meaningless
 * pair is exactly what /zakony printed for 141 bills for months.
 */
function checkReviewCoverage(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "review-coverage";
  const label = SENTINEL_CHECK_LABELS[id];
  const rows = facts.reviewCoverage;
  if (rows.length === 0) {
    return unevaluable(id, label, "no claim-kind populations could be counted — nothing to state coverage over");
  }
  const empty = rows.filter((r) => r.total === 0);
  const line = rows.map((r) => `${r.kind} ${r.decided}/${r.total} decided, ${r.pending} pending`).join("; ");
  if (empty.length === rows.length) {
    return unevaluable(
      id,
      label,
      `every claim kind has an EMPTY population (${line}) — a store with no claims proves nothing ` +
        `about whether the door covers them.`,
    );
  }
  return ok(id, label, line);
}

/**
 * EFFORT REVIEW CHAIN: every effort verdict that CLAIMS a human decision has an
 * audit row behind it.
 *
 * A person-level verdict whose stored rung says `verified` or `rejected` asserts
 * that a named human looked at a claim about a named MP. The only writer that
 * can produce those two states appends a chained audit row first, in the same
 * transaction — so a claimed decision with no row is either a script that
 * promoted its own verdict or a hand-edited node, and both are precisely what
 * the door exists to make impossible.
 *
 * The converse is deliberately NOT checked. An audit row with no matching
 * claimed decision is normal: `needs-more` returns a verdict to pending and
 * leaves its row behind, exactly as intended.
 */
function checkEffortReviewChain(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "effort-review-chain";
  const label = SENTINEL_CHECK_LABELS[id];
  const { total, byRung, claimedDecided, auditedSubjectIds } = facts.effortVerdicts;
  if (total === 0) {
    return unevaluable(
      id,
      label,
      "no person node carries an effort verdict — there is no claim about a named MP to vouch for. " +
        "Not a pass: an empty population proves nothing about the gate.",
    );
  }
  const audited = new Set(auditedSubjectIds);
  const unbacked = claimedDecided.filter((s) => !audited.has(s));
  if (unbacked.length > 0) {
    return violation(
      id,
      label,
      `${unbacked.length} of ${claimedDecided.length} effort verdict(s) claim a HUMAN decision with no ` +
        `audit row behind it, e.g. ${unbacked.slice(0, 5).join("; ")}. ` +
        `Only ReviewRepository.setReviewState can write verified/rejected, and it appends the chained ` +
        `row in the same transaction — so this is a script that promoted its own verdict, or a ` +
        `hand-edited node. Neither may stand on a surface that names a person.`,
    );
  }
  return ok(
    id,
    label,
    `all ${claimedDecided.length} decided effort verdict(s) of ${total} are backed by an audit row ` +
      `(machine ${byRung.machine}, pending ${byRung.pending}, verified ${byRung.verified}, ` +
      `rejected ${byRung.rejected}, unrecorded ${byRung.unrecorded})`,
  );
}

function checkOrphanEdges(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "orphan-edges";
  const label = SENTINEL_CHECK_LABELS[id];
  if (facts.orphanEdges.count > 0) {
    return violation(
      id,
      label,
      `${facts.orphanEdges.count} edge(s) with a dangling endpoint, e.g. ${facts.orphanEdges.sample.join("; ")}`,
    );
  }
  return ok(id, label, `all ${facts.releaseStats.kgEdgeTotal} edges resolve both endpoints`);
}

/**
 * Freshness against the atlas cadences — plus the sources nobody declared one for.
 *
 * The loop only ever walked `SOURCE_CADENCE_DAYS`, so a source that writes into
 * `ingest_run` without a declared cadence was invisible: not stale, not fresh,
 * not mentioned. That is the same "checked and clean vs. never looked" confusion
 * this file exists to abolish, one level up — the reader of a green freshness
 * line had no way to learn the check covered 3 of 12 sources.
 *
 * An undeclared source is NOT automatically a violation: no cadence was
 * declared, so no promise was broken. It is disclosed by name, and the fix
 * (declare a cadence in lib/analysis/atlas.ts, or accept that this source is
 * batch-only) is a human call, not the sentinel's.
 */
function checkFreshness(facts: SentinelFacts, now: string): SentinelCheck {
  const id: SentinelCheckId = "freshness";
  const label = SENTINEL_CHECK_LABELS[id];
  const lines: string[] = [];
  const stale: string[] = [];
  const declared = new Set(Object.keys(SOURCE_CADENCE_DAYS));
  const undeclared = facts.runStats
    .map((r) => r.source)
    .filter((s) => !declared.has(s))
    .sort();
  const undeclaredNote =
    undeclared.length === 0
      ? ""
      : ` · NOT COVERED (no cadence declared in SOURCE_CADENCE_DAYS, so freshness was not judged for ` +
        `${undeclared.length} of ${declared.size + undeclared.length} source(s) in ingest_run): ${undeclared.join(", ")}`;
  for (const [source, cadenceDays] of Object.entries(SOURCE_CADENCE_DAYS)) {
    const stats = facts.runStats.find((r) => r.source === source);
    const lastOk = stats?.lastOkFinishedAt ?? null;
    if (lastOk === null) {
      stale.push(`${source}: no finished ok ingest run (cadence ${cadenceDays}d declared)`);
      continue;
    }
    const age = ageDaysBetween(now, lastOk);
    if (age === null) {
      stale.push(`${source}: last run instant unreadable (${lastOk})`);
      continue;
    }
    const band = stalenessOf(age, cadenceDays);
    const line = `${source}: age ${Math.round(age * 10) / 10}d vs cadence ${cadenceDays}d — ${band}`;
    if (band === "zastaralé") stale.push(line);
    else lines.push(line);
  }
  if (stale.length > 0) return violation(id, label, stale.concat(lines).join(" · ") + undeclaredNote);
  return ok(id, label, lines.join(" · ") + undeclaredNote);
}

function checkScoreSample(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "score-sample";
  const label = SENTINEL_CHECK_LABELS[id];
  if (facts.persons.length === 0) {
    return violation(id, label, "no person nodes in the graph — nothing to score");
  }
  const missing = facts.persons.filter((p) => p.score === null);
  if (missing.length > 0) {
    return violation(
      id,
      label,
      `${missing.length}/${facts.persons.length} person(s) without a finite contribution_score, ` +
        `e.g. ${missing.slice(0, 5).map((p) => p.id).join(", ")}`,
    );
  }
  return ok(id, label, `${facts.persons.length} persons, all with finite contribution_score`);
}

/* ── the four scoring invariants (2026-08-04) ───────────────────────────────
 *
 * What they close: between 2026-07-29 and 2026-08-04 the committee-dedupe correction
 * lived in lib/analysis/contribution.ts while every person node still carried pass-11
 * scores. /zebricek served the pre-correction ranking for six days and NOTHING saw it —
 * the sentinel read `contribution_score` and asserted only that it was finite, and
 * `checkDeterminism` compares the store to ITSELF (a stale store is perfectly
 * self-consistent). These four give the sentinel an edge between the FORMULA and the DATA.
 *
 * NB on execution: `.github/workflows/sentinel.yml` is a NO-OP on a hosted runner —
 * there is no `./.pglite` there, so the runner exits 2 ("store not found") and the
 * nightly proves nothing about these invariants. Local `npm run sentinel` against a copy
 * of the real store is the ONLY path on which they actually execute today. Do not read a
 * green nightly as coverage.
 */

/**
 * The composite is round1() of a sum whose terms were computed from the RAW ratios, while
 * the store publishes those ratios at 3 decimals — so a re-derivation from stored props
 * can land one displayed tenth away from the stored composite and be entirely correct.
 * Measured on the live store 2026-08-04: 13 of 207 MPs at exactly 0,1, none above. This
 * is the SAME tolerance getLeaderboardData's breakdown footnote publishes; a pass-11-era
 * store (rates at 1 decimal) blows straight through it, which is the point.
 */
export const SCORE_TOLERANCE = 0.1;

/** How many MPs the recompute invariant actually re-scores. Deterministic stride sample. */
export const RECOMPUTE_SAMPLE_SIZE = 40;

/* ── the check roster ───────────────────────────────────────────────────────
 *
 * ONE declaration of every invariant's id and label, and ONE declaration of the
 * order they report in. Declared HERE (not at the top of the file) because two
 * labels interpolate the constants above — an object literal is evaluated at
 * module init, so it must follow them; the check functions read it at call time
 * and may sit above.
 *
 * Why a roster at all: a run that cannot reach the store still owes the reader a
 * report, and that report must carry the SAME rows in the SAME order as a real
 * one — otherwise "nothing was evaluated" is indistinguishable from "the report
 * is a different shape today" (see unevaluableSentinelReport).
 */
export const SENTINEL_CHECK_LABELS = {
  "manifest-bounds": "counts within released-manifest bounds",
  "readiness-floors": "readiness floors hold (lib/db/readiness.ts)",
  "audit-chain": "review audit chain covers the ledger and verifies (lib/db/pglite/ledger.ts)",
  "orphan-edges": "no orphan edges (every kg_edge endpoint resolves to a kg_node)",
  freshness: "freshness within atlas cadences (lib/analysis/atlas.ts)",
  "score-sample": "every person resolves to a finite published score",
  "formula-ref": `stored formula ref === CONTRIBUTION_FORMULA_REF ("${CONTRIBUTION_FORMULA_REF}")`,
  "provenance-uniformity": "every person agrees on one {pass, ref}",
  "components-sum": `six components sum to the stored composite (±${SCORE_TOLERANCE})`,
  "recompute-sample": `computeContribution() over stored inputs reproduces the stored score (±${SCORE_TOLERANCE})`,
  determinism: "sampled derivations deterministic across two collection passes",
  // [G2 review door] appended at the END of the label map and the END of the
  // order array, so the existing report diffs cleanly against every prior run.
  "review-coverage": "every claim kind states decided/pending over a real denominator",
  "effort-review-chain": "every decided effort verdict has an audit row (lib/db/pglite/repositories/review.ts)",
  // ── [G5] appended 2026-09-04 (moonshot #26) ────────────────────────────────
  // The roster covered ONE of three scored layers: four checks, all contribution.
  // A half-applied money or law pass was the same "single-row generalization"
  // the sentinel exists to catch, one module over — and it went unseen for
  // weeks (memory/money-stored-review-rank-is-a-stale-cache.md).
  "money-rank-cache": "stored review_tier equals the pure reviewTier of the tie it sits on",
  "law-provenance-uniformity": "every bill verdict agrees on one {pass, ref, writer}",
  "graph-provenance-uniformity": "every kg_edge relation is internally uniform on {pass, ref, writer}",
  "amends-closure": "every amends edge resolves both ends, and a bill with a verdict has one",
  "loader-degradations": "surfaces that fell back to mock in the last 24 h are known",
} as const;

export type SentinelCheckId = keyof typeof SENTINEL_CHECK_LABELS;

/**
 * Pinned report order — reports diff cleanly. Ordered ref → uniformity → parts →
 * recompute in the scoring block: the ref names the formula, uniformity says the
 * whole chamber used ONE, and the last two actually execute it.
 */
export const SENTINEL_CHECK_ORDER: readonly SentinelCheckId[] = [
  "manifest-bounds",
  "readiness-floors",
  "audit-chain",
  "orphan-edges",
  "freshness",
  "score-sample",
  "formula-ref",
  "provenance-uniformity",
  "components-sum",
  "recompute-sample",
  "determinism",
  "review-coverage",
  "effort-review-chain",
  // [G5] appended at the END so every previous report diffs cleanly against a
  // new one: rows are added below the ones a reader already knows.
  "money-rank-cache",
  "law-provenance-uniformity",
  "graph-provenance-uniformity",
  "amends-closure",
  "loader-degradations",
];

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Deterministic sample: persons ordered by id (the collection's own order), taken at an
 * even stride. NO Date.now(), NO Math.random() — two runs over one store pick the same
 * MPs, so a violation is reproducible and a green run is not luck.
 */
export function sampleForRecompute(persons: readonly PersonScoreFact[]): PersonScoreFact[] {
  const ordered = [...persons].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (ordered.length <= RECOMPUTE_SAMPLE_SIZE) return ordered;
  const stride = Math.floor(ordered.length / RECOMPUTE_SAMPLE_SIZE);
  const out: PersonScoreFact[] = [];
  for (let i = 0; out.length < RECOMPUTE_SAMPLE_SIZE && i < ordered.length; i += stride) out.push(ordered[i]);
  return out;
}

/**
 * Rebuild the formula's INPUT from a person's stored props.
 *
 * The store publishes the scorer's derived counts (`committee_count` = distinct bodies,
 * `leadership_count` = distinct led bodies) rather than the raw membership rows, so the
 * seats are reconstructed as exactly that many distinct synthetic organs. That is faithful
 * for everything downstream of the dedupe — and the dedupe itself is guarded by the REF
 * invariant, which is the only thing that can see a change in what "one body" means.
 *
 * The rates are re-expressed over a 1 000-unit denominator: a 3-decimal rate is an exact
 * integer there, so no precision is invented. Returns null when an input is missing.
 */
export function inputsFromStored(p: PersonScoreFact): ContributionInputs | null {
  const { committeeCount, leadershipCount, participationRate, absenceRate } = p.inputs;
  if (committeeCount === null || leadershipCount === null || participationRate === null || absenceRate === null) {
    return null;
  }
  if (leadershipCount > committeeCount) return null; // incoherent: more led bodies than bodies
  const seats: CommitteeSeat[] = [];
  for (let i = 0; i < committeeCount; i++) {
    seats.push({ organPspId: 900_000 + i, organType: "Výbor", functionType: i < leadershipCount ? "předseda" : null });
  }
  return {
    personPspId: 0,
    seats,
    ballotsWithPosition: Math.round(participationRate * 1000),
    rollCallsHeld: 1000,
    excusedDays: Math.round(absenceRate * 1000),
    sessionDays: 1000,
    billsAuthored: p.inputs.billsAuthored ?? 0,
    interpellations: p.inputs.interpellations ?? 0,
    speechTurns: p.inputs.speechTurns ?? 0,
  };
}

/** (a) Every person's stored formula ref is the one lib/analysis/contribution.ts declares. */
function checkFormulaRef(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "formula-ref";
  const label = SENTINEL_CHECK_LABELS[id];
  if (facts.persons.length === 0) return violation(id, label, "no person nodes — no ref to check");
  const missing = facts.persons.filter((p) => p.provenanceRef === null);
  const wrong = facts.persons.filter((p) => p.provenanceRef !== null && p.provenanceRef !== CONTRIBUTION_FORMULA_REF);
  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(
      `${missing.length}/${facts.persons.length} person(s) carry NO contribution_provenance.ref, ` +
        `e.g. ${missing.slice(0, 3).map((p) => p.id).join(", ")}`,
    );
  }
  if (wrong.length > 0) {
    const refs = [...new Set(wrong.map((p) => p.provenanceRef))].join(", ");
    problems.push(
      `${wrong.length}/${facts.persons.length} person(s) were scored by a DIFFERENT formula (stored: ${refs}) — ` +
        `the published ranking is not the one this code computes; run scripts/data-analysis/kg-contribution-recompute.ts --commit`,
    );
  }
  if (problems.length > 0) return violation(id, label, problems.join("; "));
  return ok(id, label, `all ${facts.persons.length} persons carry ref "${CONTRIBUTION_FORMULA_REF}"`);
}

/** (b) The whole chamber agrees on ONE {pass, ref} — a half-finished recompute is a lie. */
function checkProvenanceUniformity(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "provenance-uniformity";
  const label = SENTINEL_CHECK_LABELS[id];
  if (facts.persons.length === 0) return violation(id, label, "no person nodes — nothing to compare");
  const buckets = new Map<string, number>();
  for (const p of facts.persons) {
    const key = `pass ${p.provenancePass ?? "—"} / ref ${p.provenanceRef ?? "—"}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const variants = [...buckets.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (variants.length > 1) {
    return violation(
      id,
      label,
      `${variants.length} distinct provenances across ${facts.persons.length} persons — a partially applied ` +
        `recompute publishes one ranking built from two formulas: ${variants.map(([k, n]) => `${k} ×${n}`).join(" · ")}`,
    );
  }
  return ok(id, label, `${facts.persons.length} persons, all on ${variants[0][0]}`);
}

/** (c) The six weighted components derived from stored inputs sum to the stored composite. */
function checkComponentsSum(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "components-sum";
  const label = SENTINEL_CHECK_LABELS[id];
  if (facts.persons.length === 0) return violation(id, label, "no person nodes — nothing to reconcile");
  const withoutInputs: string[] = [];
  const off: string[] = [];
  let worst = 0;
  for (const p of facts.persons) {
    const inputs = inputsFromStored(p);
    if (inputs === null || p.score === null) {
      withoutInputs.push(p.id);
      continue;
    }
    const c = computeContribution(inputs).components;
    const sum = round1(c.committee + c.leadership + c.participation + c.attendance + c.legislative + c.speech);
    const delta = round1(sum - p.score);
    if (Math.abs(delta) > SCORE_TOLERANCE) {
      worst = Math.max(worst, Math.abs(delta));
      if (off.length < 5) off.push(`${p.id}: parts ${sum} vs composite ${p.score} (Δ ${delta})`);
    }
  }
  const problems: string[] = [];
  if (withoutInputs.length > 0) {
    problems.push(
      `${withoutInputs.length}/${facts.persons.length} person(s) lack the stored inputs the components are made of, ` +
        `e.g. ${withoutInputs.slice(0, 3).join(", ")}`,
    );
  }
  if (off.length > 0) problems.push(`worst |Δ| ${round1(worst)} > ${SCORE_TOLERANCE}: ${off.join("; ")}`);
  if (problems.length > 0) return violation(id, label, problems.join(" · "));
  return ok(id, label, `${facts.persons.length} persons reconcile within ±${SCORE_TOLERANCE}`);
}

/** (d) Re-run the REAL formula on a deterministic sample of MPs' stored inputs. */
function checkRecomputeSample(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "recompute-sample";
  const label = SENTINEL_CHECK_LABELS[id];
  const sample = sampleForRecompute(facts.persons);
  if (sample.length === 0) return violation(id, label, "no person nodes to re-score");
  const failures: string[] = [];
  const withoutInputs: string[] = [];
  for (const p of sample) {
    const inputs = inputsFromStored(p);
    if (inputs === null || p.score === null) {
      withoutInputs.push(p.id);
      continue;
    }
    const recomputed = computeContribution(inputs).contributionScore;
    const delta = round1(recomputed - p.score);
    if (Math.abs(delta) > SCORE_TOLERANCE) {
      failures.push(`${p.id}: formula says ${recomputed}, store says ${p.score} (Δ ${delta})`);
    }
  }
  const problems: string[] = [];
  if (withoutInputs.length > 0) {
    problems.push(`${withoutInputs.length}/${sample.length} sampled person(s) have no usable stored inputs: ${withoutInputs.slice(0, 3).join(", ")}`);
  }
  if (failures.length > 0) {
    problems.push(
      `${failures.length}/${sample.length} sampled score(s) are NOT what this formula produces — the store was ` +
        `written by another version: ${failures.slice(0, 5).join("; ")}`,
    );
  }
  if (problems.length > 0) return violation(id, label, problems.join(" · "));
  return ok(
    id,
    label,
    `${sample.length} of ${facts.persons.length} persons re-scored (deterministic stride over id asc), all within ±${SCORE_TOLERANCE}`,
  );
}

/** Fingerprint of the leaderboard-shaped sample: persons ranked score desc, id asc. */
export function scoreSampleFingerprint(facts: SentinelFacts): string {
  const ranked = [...facts.persons].sort((a, b) =>
    (b.score ?? -1) - (a.score ?? -1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return sha256Hex(canonicalJson(ranked));
}

function checkDeterminism(a: SentinelFacts, b: SentinelFacts, now: string): SentinelCheck {
  const id: SentinelCheckId = "determinism";
  const label = SENTINEL_CHECK_LABELS[id];
  const manifestA = deriveReleaseManifest(a.releaseStats);
  const manifestB = deriveReleaseManifest(b.releaseStats);
  const atlasA = sha256Hex(
    canonicalJson(deriveAtlas({ now, entityCoverage: a.entityCoverage, runStats: a.runStats })),
  );
  const atlasB = sha256Hex(
    canonicalJson(deriveAtlas({ now, entityCoverage: b.entityCoverage, runStats: b.runStats })),
  );
  const scoresA = scoreSampleFingerprint(a);
  const scoresB = scoreSampleFingerprint(b);
  const drifted: string[] = [];
  if (manifestA.manifestHash !== manifestB.manifestHash) {
    drifted.push(`manifest hash drifted: ${manifestA.manifestHash} → ${manifestB.manifestHash}`);
  }
  if (atlasA !== atlasB) drifted.push(`atlas fingerprint drifted: ${atlasA.slice(0, 12)} → ${atlasB.slice(0, 12)}`);
  if (scoresA !== scoresB) {
    drifted.push(`leaderboard sample drifted: ${scoresA.slice(0, 12)} → ${scoresB.slice(0, 12)}`);
  }
  if (drifted.length > 0) return violation(id, label, drifted.join("; "));
  return ok(
    id,
    label,
    `manifest ${manifestA.manifestHash} · atlas ${atlasA.slice(0, 12)} · leaderboard sample ${scoresA.slice(0, 12)} — identical on both passes`,
  );
}

/* ── the report ────────────────────────────────────────────────────────────── */

export interface EvaluateOptions {
  /** Evaluation instant (ISO) — an INPUT, never Date.now(), for determinism. */
  now: string;
  /** Path of the store actually opened (the copy). */
  storePath: string;
  /** Live dir the copy was taken from; null when pointed at a copy directly. */
  copiedFrom: string | null;
}

/**
 * Evaluate every sentinel invariant over two collection passes of the SAME
 * store. Pure; the roster (SENTINEL_CHECK_ORDER) decides what is emitted and in
 * what order, so reports diff cleanly and a check cannot silently go missing —
 * an id absent from the record below fails to compile.
 */
export function evaluateSentinel(a: SentinelFacts, b: SentinelFacts, opts: EvaluateOptions): SentinelReport {
  const manifest = deriveReleaseManifest(a.releaseStats);
  const byId: Record<SentinelCheckId, SentinelCheck> = {
    "manifest-bounds": checkManifestBounds(manifest, a),
    "readiness-floors": checkReadinessFloors(a),
    "audit-chain": checkAuditChain(a),
    "orphan-edges": checkOrphanEdges(a),
    freshness: checkFreshness(a, opts.now),
    "score-sample": checkScoreSample(a),
    // The scoring edge between the formula and the data (see the block comment above
    // checkFormulaRef).
    "formula-ref": checkFormulaRef(a),
    "provenance-uniformity": checkProvenanceUniformity(a),
    "components-sum": checkComponentsSum(a),
    "recompute-sample": checkRecomputeSample(a),
    determinism: checkDeterminism(a, b, opts.now),
    // [G2 review door] appended last, matching SENTINEL_CHECK_ORDER.
    "review-coverage": checkReviewCoverage(a),
    "effort-review-chain": checkEffortReviewChain(a),
    "money-rank-cache": checkMoneyRankCache(a),
    "law-provenance-uniformity": checkLawProvenanceUniformity(a),
    "graph-provenance-uniformity": checkGraphProvenanceUniformity(a),
    "amends-closure": checkAmendsClosure(a),
    "loader-degradations": checkLoaderDegradations(a),
  };
  const checks = SENTINEL_CHECK_ORDER.map((id) => byId[id]);
  return {
    schema: SENTINEL_SCHEMA,
    ranAt: opts.now,
    storePath: opts.storePath,
    copiedFrom: opts.copiedFrom,
    manifestVersion: manifest.version,
    manifestHash: manifest.manifestHash,
    verdict: sentinelVerdict(checks),
    checks,
  };
}

/* ── [G5] the money, law and graph lanes (moonshot #26) ─────────────────────── */

/**
 * (e) The stored review order still matches the tie it sits on.
 *
 * `props.tie_class` is a JUDGEMENT — an analyst read the registry and wrote it,
 * and it WINS over the heuristic. `props.review_tier` / `review_rank` are
 * something else entirely: a pass-24 SNAPSHOT of a pure function of class ×
 * corroboration × reachable CZK. After batch-012 moved the contract corpus,
 * 153 of 208 ranks and 4 of 208 tiers no longer described their tie, and the
 * only thing that noticed was a person, weeks later.
 *
 * The population SHIPS with the verdict (law: every-cap-ships-its-population) —
 * "4 of 208" and "4 of 4" are different findings and a bare 4 hides which.
 */
const isTieClass = (v: string | null): v is TieClass => v !== null && (TIE_CLASSES as readonly string[]).includes(v);

/** Exported for the unit test in sentinelSource.test.ts; the roster calls it through evaluateSentinel. */
export function checkMoneyRankCache(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "money-rank-cache";
  const label = SENTINEL_CHECK_LABELS[id];
  const ties = facts.moneyTies;
  if (ties.length === 0) {
    return unevaluable(id, label, "no linked_to ties in the store — nothing to compare");
  }
  const stamped = ties.filter((t) => t.storedTier !== null);
  if (stamped.length === 0) {
    // Nothing stored is not a stale cache; it is no cache. The reader is told.
    return ok(
      id,
      label,
      `${ties.length} ties, none carrying a stored review_tier — the order is computed at read time, ` +
        `so there is no cache to go stale`,
    );
  }
  // A stored class the vocabulary does not know is a finding of its own. Until
  // 2026-09-07 it was CAST to TieClass and fell through reviewTier's last branch
  // (steward), so a tier of 2 stamped on garbage passed as "matches".
  const unknownClass = stamped.filter((t) => t.tieClass !== null && !isTieClass(t.tieClass));
  if (unknownClass.length > 0) {
    return violation(
      id,
      label,
      `${unknownClass.length}/${stamped.length} stamped tie(s) carry a tie_class outside the TIE_CLASSES vocabulary ` +
        `(${[...new Set(unknownClass.map((t) => t.tieClass))].join(", ")}), e.g. ${unknownClass
          .slice(0, 3)
          .map((t) => t.key)
          .join(", ")} — reviewTier() cannot order what it cannot classify`,
    );
  }
  const wrong = stamped.filter(
    (t) =>
      isTieClass(t.tieClass) &&
      t.storedTier !==
        reviewTier({
          tieClass: t.tieClass,
          corroboration: t.corroboration as Parameters<typeof reviewTier>[0]["corroboration"],
        }),
  );
  if (wrong.length > 0) {
    return violation(
      id,
      label,
      `${wrong.length}/${stamped.length} stored review_tier value(s) no longer match their tie — the queue a ` +
        `reviewer clears is ordered by two incomparable vintages, e.g. ${wrong.slice(0, 3).map((t) => t.key).join(", ")}. ` +
        `Recompute from reviewTier(); never sort a queue that mixes stored and recomputed keys`,
    );
  }
  return ok(id, label, `all ${stamped.length}/${ties.length} stored tiers match reviewTier() over the current tie`);
}

/** The bucket key `facts.ts` produces for a row carrying no stamp at all. */
const UNSTAMPED_BUCKET = "pass — / ref — / writer —";

/** Render a layer's buckets: uniform, or a NAMED split with counts. */
function describeBuckets(layer: { buckets: Array<{ key: string; count: number }>; rows: number }): string {
  return layer.buckets.map((b) => `${b.key} ×${b.count}`).join(" · ");
}

/**
 * (f) The law layer agrees on one stamp.
 *
 * The contribution layer has had this check since 2026-08-04 and it is the one
 * that would have caught the six-day stale ranking. The law layer runs the same
 * risk through a different script: a forensic pass that lands on half the bills
 * publishes one register built from two vintages.
 */
function checkLawProvenanceUniformity(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "law-provenance-uniformity";
  const label = SENTINEL_CHECK_LABELS[id];
  const layer = facts.lawProvenance;
  if (layer.rows === 0) {
    return unevaluable(id, label, "no bill carries a forensic verdict — nothing to compare");
  }
  if (layer.buckets.length > 1) {
    return violation(
      id,
      label,
      `${layer.buckets.length} distinct provenances across ${layer.rows} bill verdict(s) — a partially applied ` +
        `forensic pass publishes one register built from two vintages: ${describeBuckets(layer)}`,
    );
  }
  return ok(id, label, `${layer.rows} bill verdicts, all on ${layer.buckets[0]!.key}`);
}

/**
 * (g) Each RELATION of the graph is internally uniform.
 *
 * The unit is the relation, not the store. Different relations legitimately come
 * from different passes and writers — `supplies` from the money feed, `amends`
 * from the legislation ingest — so comparing them to each other would make this
 * check fire permanently and mean nothing. MIXED WITHIN ONE RELATION is the
 * alarm: that is the shape a half-applied pass has.
 *
 * A relation whose rows are all unstamped is `unevaluable` for that relation and
 * SAID so, never quietly counted as agreement.
 */
function checkGraphProvenanceUniformity(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "graph-provenance-uniformity";
  const label = SENTINEL_CHECK_LABELS[id];
  const layers = facts.graphProvenance;
  if (layers.length === 0) return unevaluable(id, label, "no kg_edge rows — nothing to compare");

  // An UNSTAMPED row is not a second vintage — it is a row the provenance
  // migration has not reached, and /atlas already counts it as exactly that.
  // Folding it in here would report a permanent violation that means "the
  // backfill has not finished" while saying "a pass was half applied", and the
  // two are different findings. So the comparison is over the rows that DO
  // carry a stamp; the unstamped ones are counted and named beside the verdict.
  const stamped = layers.map((l) => ({
    layer: l.layer,
    rows: l.rows,
    buckets: l.buckets.filter((b) => b.key !== UNSTAMPED_BUCKET),
    unstampedRows: l.buckets.find((b) => b.key === UNSTAMPED_BUCKET)?.count ?? 0,
  }));
  const mixed = stamped.filter((l) => l.buckets.length > 1);
  if (mixed.length > 0) {
    return violation(
      id,
      label,
      mixed
        .map((l) => `${l.layer}: ${l.buckets.length} provenances over ${l.rows} rows (${describeBuckets(l)})`)
        .join(" · ") +
        ` — mixed WITHIN one relation is a half-applied pass, not two legitimate sources`,
    );
  }
  const judged = stamped.filter((l) => l.buckets.length === 1);
  const unstampedRows = stamped.reduce((n, l) => n + l.unstampedRows, 0);
  if (judged.length === 0) {
    return unevaluable(
      id,
      label,
      `all ${layers.length} relation(s) are unstamped (${unstampedRows} rows) — run ` +
        `scripts/data-analysis/kg-provenance-backfill.ts; an unstamped layer agrees on nothing, it says nothing`,
    );
  }
  const detail = judged.map((l) => `${l.layer} ${l.buckets[0]!.count}×${l.buckets[0]!.key}`).join(" · ");
  return unstampedRows > 0
    ? ok(
        id,
        label,
        `${judged.length}/${layers.length} relation(s) uniform on their stamps; ${unstampedRows} row(s) carry no ` +
          `stamp at all — counted, never called agreement. ${detail}`,
      )
    : ok(id, label, `all ${layers.length} relations uniform — ${detail}`);
}

/**
 * (h) `amends` closes: both ends resolve, and a verdict implies an edge.
 *
 * `/zakony` cites "this bill amends that law" as a fact about the record. A
 * dangling end is a citation to a node that is not there; a bill carrying a
 * forensic verdict and NO amends edge means the verdict was written over a bill
 * whose amendment graph was never regenerated — the reader sees a finding about
 * a change nothing in the graph connects to a law.
 */
function checkAmendsClosure(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "amends-closure";
  const label = SENTINEL_CHECK_LABELS[id];
  const a = facts.amends;
  if (a.edges === 0 && a.billsWithVerdict === 0) {
    return unevaluable(id, label, "no amends edges and no bill verdicts — nothing to close");
  }
  const problems: string[] = [];
  if (a.danglingEnds > 0) {
    problems.push(`${a.danglingEnds}/${a.edges} amends edge(s) have an endpoint no kg_node resolves`);
  }
  if (a.billsWithVerdictAndNoAmends.length > 0) {
    problems.push(
      `${a.billsWithVerdictAndNoAmends.length}/${a.billsWithVerdict} bill(s) carry a forensic verdict but no ` +
        `amends edge, e.g. ${a.billsWithVerdictAndNoAmends.slice(0, 3).join(", ")} — the verdict names a change ` +
        `the graph connects to no law`,
    );
  }
  if (problems.length > 0) return violation(id, label, problems.join("; "));
  return ok(
    id,
    label,
    `${a.edges} amends edges, both ends resolving; all ${a.billsWithVerdict} bill verdict(s) carry one`,
  );
}

/**
 * (i) Somebody was watching the loader boundary.
 *
 * ABSENT FILE IS NEVER `ok`. `reportLoaderFailure` has 121 call sites and its
 * other two sinks answer nothing after the fact (a scrolled console, a Sentry
 * no-op with no DSN). A missing log means nobody was watching; a present, empty
 * one means somebody was and nothing happened. Those are opposite findings and
 * this check refuses to give them the same verdict.
 *
 * Degradations themselves are NOT a violation of an invariant about the DATA —
 * they are an operational fact, reported with its population so an operator can
 * act. The sentinel's red is reserved for the record being wrong.
 */
function checkLoaderDegradations(facts: SentinelFacts): SentinelCheck {
  const id: SentinelCheckId = "loader-degradations";
  const label = SENTINEL_CHECK_LABELS[id];
  const d = facts.loaderDegradations;
  if (d === null) {
    return unevaluable(
      id,
      label,
      `no degradation log at ${loaderFailureDisplayPath()} — nobody was watching the loader boundary. ` +
        `"No file" is not "no degradations": those are opposite findings`,
    );
  }
  if (d.total === 0) {
    return ok(id, label, `0 degradations in the last ${d.windowHours} h (log present at ${d.path})`);
  }
  return ok(
    id,
    label,
    `${d.total} degradation(s) in the last ${d.windowHours} h across ${d.byLoader.length} loader(s), ` +
      `last ${d.lastAt}: ${d.byLoader.slice(0, 3).map((l) => `${l.loader} ×${l.count}`).join(", ")} ` +
      `(${d.path}) — a fallback that rendered is a surface a reader saw degraded`,
  );
}

/**
 * The report of a run that never reached the data.
 *
 * WHY IT EXISTS (2026-08-13): until now the store-unreadable path
 * (scripts/sentinel/run.ts) printed a line to stderr, exited 2 and wrote NO
 * machine report — so nothing anywhere distinguished "ran and passed" from
 * "never ran". A workflow that skipped the run step and a workflow whose run
 * step passed left the same artifact: none. That is the same confusion the
 * `unevaluable` check status abolishes, at the level of the whole run.
 *
 * It emits the SAME rows in the SAME order as a real audit, each `unevaluable`
 * with the reason attached, so a diff against yesterday's real report shows
 * exactly which invariants stopped being evaluated. `sentinelVerdict` then
 * yields `unevaluable` by construction (no ok, no violation), which
 * `renderSentinelSummary` prints as "0 of N invariants could be evaluated" and
 * the runner maps to exit code 2.
 *
 * Manifest fields are null on purpose: no store was read, so there is no
 * release to name — a version copied from anywhere else would be a claim about
 * data this run never saw.
 */
export function unevaluableSentinelReport(
  opts: EvaluateOptions & { reason: string },
): SentinelReport {
  const checks = SENTINEL_CHECK_ORDER.map((id) =>
    unevaluable(
      id,
      SENTINEL_CHECK_LABELS[id],
      `not evaluated — the store could not be read: ${opts.reason}`,
    ),
  );
  return {
    schema: SENTINEL_SCHEMA,
    ranAt: opts.now,
    storePath: opts.storePath,
    copiedFrom: opts.copiedFrom,
    manifestVersion: null,
    manifestHash: null,
    verdict: sentinelVerdict(checks),
    checks,
  };
}
