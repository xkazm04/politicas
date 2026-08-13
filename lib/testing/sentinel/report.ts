/*
 * LIVE-GRAPH SENTINEL — report codec + human rendering (batch-7 item 7E).
 * PURE: serialization is canonical JSON (lib/db/pglite/ledger.ts rules), so
 * the same report always produces the same bytes; parsing validates shape and
 * schema so a machine consumer (nightly workflow, admin surface) can trust
 * what it reads or fail loudly — never render a half-parsed verdict.
 */

import { canonicalJson } from "@/lib/db/pglite/ledger";

/**
 * SCHEMA VERSION — deliberately NOT moved to /2 by the 2026-08-13 third-state
 * work. The change is ADDITIVE at the wire: `unevaluable` is a new value of an
 * existing enum, no field was renamed or removed, and a /1 report written by
 * the previous build still parses byte-for-byte here. The only consumers are
 * `parseSentinelReport` (this file), `scripts/sentinel/run.ts` and the workflow
 * artifact — all in-repo, all upgraded in the same commit; nothing outside the
 * tree pins the string. Bumping it would have invalidated stored artifacts to
 * announce a widened enum. A field removal or a semantic change to `verdict`'s
 * existing values WOULD earn /2.
 */
export const SENTINEL_SCHEMA = "politicas.sentinel/1";

/**
 * Three states, and the third is the whole point.
 *
 * The sentinel exists because a wrong ranking shipped for six days while every
 * check was green — so the one thing it may never do is report "checked and
 * clean" for something it never looked at. `unevaluable` is NEITHER ok NOR
 * violation: the store carries nothing to judge (an empty ledger), or the run
 * never reached the data at all. It does not fail the audit, and it does not
 * count towards "all N invariants hold" either.
 *
 * The discipline was already here in two checks (components-sum and
 * recompute-sample treat "cannot evaluate" as a finding); this makes it a
 * vocabulary instead of a per-check convention.
 */
export type SentinelCheckStatus = "ok" | "violation" | "unevaluable";

export const SENTINEL_CHECK_STATUSES: readonly SentinelCheckStatus[] = [
  "ok",
  "violation",
  "unevaluable",
];

export interface SentinelCheck {
  id: string;
  label: string;
  status: SentinelCheckStatus;
  detail: string;
}

/**
 * Report verdicts, derived from the checks and nothing else (see
 * `sentinelVerdict`):
 *   violation   — at least one invariant is violated;
 *   unevaluable — NOTHING was evaluated (no violation, no pass). This is the
 *                 "the run never reached the data" verdict, and it must never
 *                 render as a green audit;
 *   ok          — at least one invariant was evaluated and none is violated.
 *                 The summary still names how many were NOT evaluated.
 */
export type SentinelVerdict = "ok" | "violation" | "unevaluable";

export interface SentinelReport {
  schema: typeof SENTINEL_SCHEMA;
  /** Evaluation instant (ISO) — injected by the runner. */
  ranAt: string;
  /** The store directory actually opened (always a copy, never the live dir). */
  storePath: string;
  copiedFrom: string | null;
  manifestVersion: string | null;
  manifestHash: string | null;
  verdict: SentinelVerdict;
  checks: SentinelCheck[];
}

/**
 * The ONE derivation of a report's verdict from its checks — used by the
 * evaluator, by the store-unreadable path, and by the parser's consistency
 * gate, so a report can never carry a headline its own rows contradict.
 */
export function sentinelVerdict(checks: readonly SentinelCheck[]): SentinelVerdict {
  if (checks.some((c) => c.status === "violation")) return "violation";
  if (checks.some((c) => c.status === "ok")) return "ok";
  return "unevaluable";
}

/** Canonical-JSON serialization — stable bytes for the same report. */
export function serializeSentinelReport(report: SentinelReport): string {
  return canonicalJson(report);
}

/**
 * Parse + validate a serialized report. Throws with a precise reason on any
 * shape violation — a sentinel report that cannot be trusted must not be read.
 */
export function parseSentinelReport(text: string): SentinelReport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`sentinel report is not JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("sentinel report must be a JSON object");
  }
  const o = raw as Record<string, unknown>;
  if (o.schema !== SENTINEL_SCHEMA) {
    throw new Error(`unknown sentinel schema: ${String(o.schema)} (expected ${SENTINEL_SCHEMA})`);
  }
  if (typeof o.ranAt !== "string" || typeof o.storePath !== "string") {
    throw new Error("sentinel report missing ranAt/storePath");
  }
  if (o.copiedFrom !== null && typeof o.copiedFrom !== "string") {
    throw new Error("sentinel report copiedFrom must be string or null");
  }
  if (o.manifestVersion !== null && typeof o.manifestVersion !== "string") {
    throw new Error("sentinel report manifestVersion must be string or null");
  }
  if (o.manifestHash !== null && typeof o.manifestHash !== "string") {
    throw new Error("sentinel report manifestHash must be string or null");
  }
  if (o.verdict !== "ok" && o.verdict !== "violation" && o.verdict !== "unevaluable") {
    throw new Error(
      `sentinel report verdict must be ok|violation|unevaluable, got ${String(o.verdict)}`,
    );
  }
  if (!Array.isArray(o.checks) || o.checks.length === 0) {
    throw new Error("sentinel report must carry at least one check");
  }
  const checks = o.checks.map((c, i): SentinelCheck => {
    if (c === null || typeof c !== "object" || Array.isArray(c)) {
      throw new Error(`sentinel check #${i} must be an object`);
    }
    const cc = c as Record<string, unknown>;
    if (typeof cc.id !== "string" || typeof cc.label !== "string" || typeof cc.detail !== "string") {
      throw new Error(`sentinel check #${i} missing id/label/detail`);
    }
    if (!SENTINEL_CHECK_STATUSES.includes(cc.status as SentinelCheckStatus)) {
      throw new Error(
        `sentinel check #${i} status must be ok|violation|unevaluable, got ${String(cc.status)}`,
      );
    }
    return {
      id: cc.id,
      label: cc.label,
      status: cc.status as SentinelCheckStatus,
      detail: cc.detail,
    };
  });
  // The headline must be the one the rows produce — including the third state:
  // a report claiming "ok" over checks that were all unevaluable is exactly the
  // false green this vocabulary exists to make impossible.
  if (o.verdict !== sentinelVerdict(checks)) {
    throw new Error(
      `sentinel report verdict does not agree with its checks (says ${o.verdict}, rows say ${sentinelVerdict(checks)})`,
    );
  }
  return {
    schema: SENTINEL_SCHEMA,
    ranAt: o.ranAt,
    storePath: o.storePath,
    copiedFrom: o.copiedFrom,
    manifestVersion: o.manifestVersion,
    manifestHash: o.manifestHash,
    verdict: o.verdict,
    checks,
  };
}

/** Per-status marker, padded to one width so a log column stays readable. */
const MARK: Record<SentinelCheckStatus, string> = {
  ok: " PASS ",
  violation: " FAIL ",
  unevaluable: "UNEVAL",
};

/** Human summary — what the terminal (and a nightly log) shows. */
export function renderSentinelSummary(report: SentinelReport): string {
  const lines: string[] = [];
  lines.push(`LIVE-GRAPH SENTINEL — ${report.ranAt}`);
  lines.push(
    `store: ${report.storePath}${report.copiedFrom ? ` (read-only copy of ${report.copiedFrom})` : ""}`,
  );
  lines.push(
    `release: ${report.manifestVersion ?? "unreleased"}${report.manifestHash ? ` · manifest ${report.manifestHash}` : ""}`,
  );
  lines.push("");
  for (const c of report.checks) {
    lines.push(`  [${MARK[c.status]}] ${c.label}`);
    lines.push(`           ${c.detail}`);
  }
  lines.push("");
  const total = report.checks.length;
  const failed = report.checks.filter((c) => c.status === "violation").length;
  const held = report.checks.filter((c) => c.status === "ok").length;
  const skipped = total - failed - held;
  // "not evaluated" is never folded into a pass count: the headline says how
  // many invariants actually held and how many nobody could look at.
  const notEvaluated = skipped > 0 ? ` · ${skipped} NOT EVALUATED` : "";
  if (report.verdict === "unevaluable") {
    lines.push(
      `VERDICT: NOT EVALUATED — 0 of ${total} invariants could be evaluated; this run proves nothing ` +
        `about the data (it is not a pass)`,
    );
  } else if (report.verdict === "ok") {
    lines.push(
      skipped === 0
        ? `VERDICT: OK — all ${total} invariants hold`
        : `VERDICT: OK — ${held} of ${total} invariants hold${notEvaluated}`,
    );
  } else {
    lines.push(
      `VERDICT: VIOLATION — ${failed}/${total} invariant(s) violated${notEvaluated} ` +
        `(data problem: fix the data or the ingest, never the invariant)`,
    );
  }
  return lines.join("\n");
}
