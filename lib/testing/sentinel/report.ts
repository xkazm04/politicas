/*
 * LIVE-GRAPH SENTINEL — report codec + human rendering (batch-7 item 7E).
 * PURE: serialization is canonical JSON (lib/db/pglite/ledger.ts rules), so
 * the same report always produces the same bytes; parsing validates shape and
 * schema so a machine consumer (nightly workflow, admin surface) can trust
 * what it reads or fail loudly — never render a half-parsed verdict.
 */

import { canonicalJson } from "@/lib/db/pglite/ledger";

export const SENTINEL_SCHEMA = "politicas.sentinel/1";

export type SentinelCheckStatus = "ok" | "violation";

export interface SentinelCheck {
  id: string;
  label: string;
  status: SentinelCheckStatus;
  detail: string;
}

export interface SentinelReport {
  schema: typeof SENTINEL_SCHEMA;
  /** Evaluation instant (ISO) — injected by the runner. */
  ranAt: string;
  /** The store directory actually opened (always a copy, never the live dir). */
  storePath: string;
  copiedFrom: string | null;
  manifestVersion: string | null;
  manifestHash: string | null;
  verdict: "ok" | "violation";
  checks: SentinelCheck[];
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
  if (o.verdict !== "ok" && o.verdict !== "violation") {
    throw new Error(`sentinel report verdict must be ok|violation, got ${String(o.verdict)}`);
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
    if (cc.status !== "ok" && cc.status !== "violation") {
      throw new Error(`sentinel check #${i} status must be ok|violation, got ${String(cc.status)}`);
    }
    return { id: cc.id, label: cc.label, status: cc.status, detail: cc.detail };
  });
  const hasViolation = checks.some((c) => c.status === "violation");
  if ((o.verdict === "violation") !== hasViolation) {
    throw new Error("sentinel report verdict does not agree with its checks");
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
    const mark = c.status === "ok" ? "PASS" : "FAIL";
    lines.push(`  [${mark}] ${c.label}`);
    lines.push(`         ${c.detail}`);
  }
  lines.push("");
  const failed = report.checks.filter((c) => c.status === "violation").length;
  lines.push(
    report.verdict === "ok"
      ? `VERDICT: OK — all ${report.checks.length} invariants hold`
      : `VERDICT: VIOLATION — ${failed}/${report.checks.length} invariant(s) violated (data problem: fix the data or the ingest, never the invariant)`,
  );
  return lines.join("\n");
}
