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
import { floorVerdicts } from "@/lib/db/readiness";
import { deriveReleaseManifest, type ReleaseManifest } from "@/features/data-releases/manifest";
import type { PersonScoreFact, SentinelFacts } from "./facts";
import type { SentinelCheck, SentinelReport } from "./report";
import { SENTINEL_SCHEMA } from "./report";

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

/* ── individual invariants ─────────────────────────────────────────────────── */

function checkManifestBounds(manifest: ReleaseManifest, facts: SentinelFacts): SentinelCheck {
  const id = "manifest-bounds";
  const label = "counts within released-manifest bounds";
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
  const id = "readiness-floors";
  const label = "readiness floors hold (lib/db/readiness.ts)";
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

function checkAuditChain(facts: SentinelFacts): SentinelCheck {
  const id = "audit-chain";
  const label = "review audit chain verifies (lib/db/pglite/ledger.ts)";
  const chain = facts.chain;
  if (!chain.ok) {
    const d = chain.firstDivergence;
    return violation(
      id,
      label,
      `chain of ${chain.length} diverges at pos ${d.chainPos} (row ${d.id}): ${d.reason} — expected ${d.expected}, actual ${d.actual}`,
    );
  }
  if (chain.length === 0) {
    return ok(id, label, "chain is empty — trivially valid (no chained review decisions yet)");
  }
  return ok(id, label, `${chain.length} chained rows verify; head ${chain.headHash}`);
}

function checkOrphanEdges(facts: SentinelFacts): SentinelCheck {
  const id = "orphan-edges";
  const label = "no orphan edges (every kg_edge endpoint resolves to a kg_node)";
  if (facts.orphanEdges.count > 0) {
    return violation(
      id,
      label,
      `${facts.orphanEdges.count} edge(s) with a dangling endpoint, e.g. ${facts.orphanEdges.sample.join("; ")}`,
    );
  }
  return ok(id, label, `all ${facts.releaseStats.kgEdgeTotal} edges resolve both endpoints`);
}

function checkFreshness(facts: SentinelFacts, now: string): SentinelCheck {
  const id = "freshness";
  const label = "freshness within atlas cadences (lib/analysis/atlas.ts)";
  const lines: string[] = [];
  const stale: string[] = [];
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
  if (stale.length > 0) return violation(id, label, stale.concat(lines).join(" · "));
  return ok(id, label, lines.join(" · "));
}

function checkScoreSample(facts: SentinelFacts): SentinelCheck {
  const id = "score-sample";
  const label = "every person resolves to a finite published score";
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
  const id = "formula-ref";
  const label = `stored formula ref === CONTRIBUTION_FORMULA_REF ("${CONTRIBUTION_FORMULA_REF}")`;
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
  const id = "provenance-uniformity";
  const label = "every person agrees on one {pass, ref}";
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
  const id = "components-sum";
  const label = `six components sum to the stored composite (±${SCORE_TOLERANCE})`;
  if (facts.persons.length === 0) return violation(id, label, "no person nodes — nothing to reconcile");
  const unevaluable: string[] = [];
  const off: string[] = [];
  let worst = 0;
  for (const p of facts.persons) {
    const inputs = inputsFromStored(p);
    if (inputs === null || p.score === null) {
      unevaluable.push(p.id);
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
  if (unevaluable.length > 0) {
    problems.push(
      `${unevaluable.length}/${facts.persons.length} person(s) lack the stored inputs the components are made of, ` +
        `e.g. ${unevaluable.slice(0, 3).join(", ")}`,
    );
  }
  if (off.length > 0) problems.push(`worst |Δ| ${round1(worst)} > ${SCORE_TOLERANCE}: ${off.join("; ")}`);
  if (problems.length > 0) return violation(id, label, problems.join(" · "));
  return ok(id, label, `${facts.persons.length} persons reconcile within ±${SCORE_TOLERANCE}`);
}

/** (d) Re-run the REAL formula on a deterministic sample of MPs' stored inputs. */
function checkRecomputeSample(facts: SentinelFacts): SentinelCheck {
  const id = "recompute-sample";
  const label = `computeContribution() over stored inputs reproduces the stored score (±${SCORE_TOLERANCE})`;
  const sample = sampleForRecompute(facts.persons);
  if (sample.length === 0) return violation(id, label, "no person nodes to re-score");
  const failures: string[] = [];
  const unevaluable: string[] = [];
  for (const p of sample) {
    const inputs = inputsFromStored(p);
    if (inputs === null || p.score === null) {
      unevaluable.push(p.id);
      continue;
    }
    const recomputed = computeContribution(inputs).contributionScore;
    const delta = round1(recomputed - p.score);
    if (Math.abs(delta) > SCORE_TOLERANCE) {
      failures.push(`${p.id}: formula says ${recomputed}, store says ${p.score} (Δ ${delta})`);
    }
  }
  const problems: string[] = [];
  if (unevaluable.length > 0) {
    problems.push(`${unevaluable.length}/${sample.length} sampled person(s) have no usable stored inputs: ${unevaluable.slice(0, 3).join(", ")}`);
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
  const id = "determinism";
  const label = "sampled derivations deterministic across two collection passes";
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
 * store. Pure; ordering of checks is pinned so reports diff cleanly.
 */
export function evaluateSentinel(a: SentinelFacts, b: SentinelFacts, opts: EvaluateOptions): SentinelReport {
  const manifest = deriveReleaseManifest(a.releaseStats);
  const checks: SentinelCheck[] = [
    checkManifestBounds(manifest, a),
    checkReadinessFloors(a),
    checkAuditChain(a),
    checkOrphanEdges(a),
    checkFreshness(a, opts.now),
    checkScoreSample(a),
    // The scoring edge between the formula and the data (see the block comment above
    // checkFormulaRef). Ordered ref → uniformity → parts → recompute: the ref names the
    // formula, uniformity says the whole chamber used ONE, and the last two actually
    // execute it. Pinned order — reports diff cleanly.
    checkFormulaRef(a),
    checkProvenanceUniformity(a),
    checkComponentsSum(a),
    checkRecomputeSample(a),
    checkDeterminism(a, b, opts.now),
  ];
  return {
    schema: SENTINEL_SCHEMA,
    ranAt: opts.now,
    storePath: opts.storePath,
    copiedFrom: opts.copiedFrom,
    manifestVersion: manifest.version,
    manifestHash: manifest.manifestHash,
    verdict: checks.some((c) => c.status === "violation") ? "violation" : "ok",
    checks,
  };
}
