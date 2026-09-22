/**
 * THE SENTINEL'S OUTBOX — how a verdict reaches the store the run may not open.
 *
 * WHY THE INDIRECTION. `scripts/sentinel/run.ts` opens a COPY of the data
 * directory, never the live handle: PGlite is single-connection, so a second
 * handle on a live dir blocks or corrupts, and even a healthy handle could
 * write. That guarantee is the reason the sentinel can be run against
 * production data at all, and card #26 does not get to spend it. So the run
 * appends its canonical report to a JSONL queue file beside the store, and the
 * next LIVE `open()` drains it into `sentinel_run`.
 *
 * WRITE FAILS LOUD (same contract as features/admin/loops/driveLog.ts). A lost
 * verdict must not look like a clean run: if the append throws, the sentinel
 * says so and exits non-zero rather than printing a summary that implies the
 * verdict was kept.
 *
 * DRAINING IS IDEMPOTENT AND NEVER FATAL. Each entry's `id` is the content hash
 * of the canonical report, so replaying a queue file inserts nothing new; and a
 * drain that fails is logged, never allowed to take the store down — the store
 * has a hundred readers and the queue has one writer.
 *
 * The queue is a FILE, not a table, because the sentinel's whole point is that
 * it can audit a store it cannot write to — including one it copied from a CI
 * artifact of a machine it has never seen.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { canonicalJson, sha256Hex } from "./ledger";
import type { Pglite } from "./internals";

/** Runtime data file (never a build asset); env-overridable for tests. */
export function sentinelQueuePath(): string {
  return process.env.SENTINEL_QUEUE_PATH || "./.data/sentinel-queue.jsonl";
}

/** The path as it is admitted in UI / JSON — no leading "./", "/" even on Windows. */
export const sentinelQueueDisplayPath = (): string =>
  sentinelQueuePath().replaceAll("\\", "/").replace(/^\.\//, "");

export interface SentinelQueueEntry {
  /** sha256 of the canonical report — the idempotency key. */
  id: string;
  manifestHash: string | null;
  ranAt: string;
  verdict: "ok" | "violation" | "unevaluable";
  /** The canonical report, verbatim. Parsed by the reader, never by the queue. */
  report: unknown;
}

/** Build the entry for a report. PURE — the id is a function of the bytes. */
export function sentinelQueueEntry(report: {
  manifestHash: string | null;
  ranAt: string;
  verdict: "ok" | "violation" | "unevaluable";
}): SentinelQueueEntry {
  const canonical = canonicalJson(report);
  return {
    id: sha256Hex(canonical),
    manifestHash: report.manifestHash,
    ranAt: report.ranAt,
    verdict: report.verdict,
    report,
  };
}

/**
 * Append one verdict to the outbox. THROWS on failure — see the header: a
 * verdict that quietly failed to be kept is indistinguishable from one that was
 * never produced, which is the exact confusion this lane exists to abolish.
 */
export function enqueueSentinelRun(report: {
  manifestHash: string | null;
  ranAt: string;
  verdict: "ok" | "violation" | "unevaluable";
}): SentinelQueueEntry {
  const entry = sentinelQueueEntry(report);
  const path = sentinelQueuePath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

/** Read the outbox. A malformed line is SKIPPED and counted, never guessed at. */
export function readSentinelQueue(path = sentinelQueuePath()): {
  entries: SentinelQueueEntry[];
  malformed: number;
} {
  if (!existsSync(path)) return { entries: [], malformed: 0 };
  const entries: SentinelQueueEntry[] = [];
  let malformed = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try {
      const raw = JSON.parse(line) as Partial<SentinelQueueEntry>;
      if (
        typeof raw.id === "string" &&
        typeof raw.ranAt === "string" &&
        (raw.verdict === "ok" || raw.verdict === "violation" || raw.verdict === "unevaluable") &&
        (raw.manifestHash === null || typeof raw.manifestHash === "string")
      ) {
        entries.push(raw as SentinelQueueEntry);
      } else {
        malformed += 1;
      }
    } catch {
      // A half-written line (the process died mid-append) is not a verdict and
      // must not become one. Counted, reported by the drain, never repaired.
      malformed += 1;
    }
  }
  return { entries, malformed };
}

export interface DrainResult {
  applied: number;
  alreadyPresent: number;
  malformed: number;
}

/**
 * Drain the outbox into `sentinel_run` and truncate it.
 *
 * Called once per live `open()`. Idempotent by the entry id, so a queue file
 * that survives a crash mid-drain replays to the same rows. The file is emptied
 * only after every entry landed — a failed insert leaves the queue intact so
 * the next boot tries again rather than losing the verdict.
 */
export async function drainSentinelQueue(pg: Pglite, path = sentinelQueuePath()): Promise<DrainResult> {
  const { entries, malformed } = readSentinelQueue(path);
  if (entries.length === 0) {
    if (malformed > 0 && existsSync(path)) writeFileSync(path, "", "utf8");
    return { applied: 0, alreadyPresent: 0, malformed };
  }

  let applied = 0;
  for (const e of entries) {
    const { rows } = await pg.query<{ inserted: unknown }>(
      `insert into sentinel_run (id, manifest_hash, ran_at, verdict, report)
       values ($1, $2, $3::timestamptz, $4, $5::jsonb)
       on conflict (id) do nothing
       returning id as inserted`,
      [e.id, e.manifestHash, e.ranAt, e.verdict, JSON.stringify(e.report ?? {})],
    );
    if (rows.length > 0) applied += 1;
  }
  writeFileSync(path, "", "utf8");
  return { applied, alreadyPresent: entries.length - applied, malformed };
}

/** The newest verdict over THIS manifest hash. Exact match — see the header. */
export interface CertificationRow {
  ranAt: string;
  verdict: "ok" | "violation" | "unevaluable";
  /** How many checks held / how many the report carried; null when unreadable. */
  checksHeld: number | null;
  checksTotal: number | null;
}

export async function readNewestCertification(
  pg: Pglite,
  manifestHash: string,
): Promise<CertificationRow | null> {
  // EXACT match, never a prefix or a "nearest run". A fuzzy join would certify a
  // release the sentinel never saw, which is precisely the "never ran rendered
  // as passed" failure the third verdict state exists to make impossible.
  const { rows } = await pg.query<Record<string, unknown>>(
    `select ran_at, verdict, report from sentinel_run
      where manifest_hash = $1 order by ran_at desc, id desc limit 1`,
    [manifestHash],
  );
  const row = rows[0];
  if (!row) return null;
  const checks = (row.report as { checks?: Array<{ status?: string }> } | null)?.checks;
  return {
    ranAt: row.ran_at instanceof Date ? row.ran_at.toISOString() : String(row.ran_at),
    verdict: String(row.verdict) as CertificationRow["verdict"],
    checksHeld: Array.isArray(checks) ? checks.filter((c) => c.status === "ok").length : null,
    checksTotal: Array.isArray(checks) ? checks.length : null,
  };
}
