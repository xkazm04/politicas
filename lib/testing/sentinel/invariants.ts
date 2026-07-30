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
import { canonicalJson, sha256Hex } from "@/lib/db/pglite/ledger";
import { floorVerdicts } from "@/lib/db/readiness";
import { deriveReleaseManifest, type ReleaseManifest } from "@/features/data-releases/manifest";
import type { SentinelFacts } from "./facts";
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
