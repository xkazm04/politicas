// PGlite plumbing shared by every repository: the connection interface + memoised
// open(), the row coercion helpers, the chunked upsert, and the limit clamp. Kept
// out of the repository files so each of those reads as pure query logic.

import { pglitePath } from "../config";
import type { ListOptions } from "../store";
import { CORE_DDL } from "./ddl";
import { assertDurabilityContract } from "./durability";
import { instrumentPglite } from "./instrument";
import { withQuietWindowMaintenance } from "./maintenance";
import { drainSentinelQueue } from "./sentinelQueue";

export interface PgResult<T> {
  rows: T[];
}
/** A transaction handle: same query shape as `Pglite`, scoped to one begin/commit. */
export interface PgTransaction {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PgResult<T>>;
}
export interface Pglite {
  waitReady: Promise<void>;
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PgResult<T>>;
  /** Runs `callback` inside a single transaction; PGlite serializes this against every
   * other query/transaction on the one shared connection, so two concurrent callers
   * can never interleave their reads/writes within the callback's read-modify-write. */
  transaction<T>(callback: (tx: PgTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const PGLITE_KEY = "__politicas_pglite__" as const;
export type GlobalWithPglite = typeof globalThis & { [PGLITE_KEY]?: Promise<Pglite> };

/**
 * SINGLE CONNECTION per data dir — the instance is memoised on globalThis and the
 * promise is assigned before any await, so two concurrent openers cannot race.
 * Analysis scripts read a COPY of the directory.
 *
 * A REJECTED promise must not stay memoised: getStore() clears its own cache on
 * failure and retries, but that retry re-enters open() — without the reset below
 * it would receive the same cached rejection forever, degrading the whole
 * process to the mock fallback until restart on one transient cold-start
 * failure (locked data dir, WASM load error).
 *
 * THE ONE CHOKEPOINT: every repository reaches the engine through the instance
 * returned here, so this is where `instrumentPglite` (./instrument.ts) wraps
 * `query`/`exec`/`transaction` — the only place a per-table timing ring can see
 * every operation without a single call site changing. The wrap happens BEFORE
 * `exec(CORE_DDL)` so cold-start schema application is measured too, and it is
 * identity (the same object, no wrapper at all) when metrics are switched off.
 *
 * The same chokepoint carries the maintenance scheduler (./maintenance.ts),
 * wrapped INSIDE the instrument: the activity gauge then counts exactly the
 * operations the instrument measures, while the CHECKPOINT the scheduler issues
 * goes to the raw connection and never appears in the query rings as a phantom
 * key. Both wrappers are identity when switched off.
 *
 * BOOT APPLIES SCHEMA WORK WITHOUT A SNAPSHOT, AND SAYS SO. `disclosePendingDdl`
 * below runs three catalog reads before the DDL, so the one boot that changes
 * the schema is never indistinguishable from the thousand that re-assert it.
 */
export async function open(): Promise<Pglite> {
  const g = globalThis as GlobalWithPglite;
  if (!g[PGLITE_KEY]) {
    const opening = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const raw = new PGlite(pglitePath()) as unknown as Pglite;
      const pg = instrumentPglite(withQuietWindowMaintenance(raw));
      await pg.waitReady;
      await disclosePendingDdl(pg);
      await pg.exec(CORE_DDL);
      // [G5] The sentinel audits a COPY and never opens this handle, so its
      // verdict arrives through a file. Draining it here is the one moment a
      // live connection exists; it is idempotent by content hash and never
      // fatal — the store has a hundred readers and the queue has one writer.
      await drainSentinelQueue(pg).catch((err: unknown) => {
        console.warn(`[db] sentinel queue not drained this boot: ${String(err)}`);
      });
      await assertDurabilityContract(pg).catch((err: unknown) => {
        // The contract could not be READ. That is worth a line (it is already
        // one, inside), and it is not a reason to withhold a working store.
        console.warn(`[db] durability contract unverified this boot: ${String(err)}`);
      });
      return pg;
    })();
    g[PGLITE_KEY] = opening;
    opening.catch(() => {
      if (g[PGLITE_KEY] === opening) delete g[PGLITE_KEY];
    });
  }
  return g[PGLITE_KEY]!;
}

/**
 * What the last boot of this process did to the schema, and whether anything
 * protected it. Null until a boot has looked.
 *
 * It is exported because "the migration failed AND there was no snapshot" must
 * never be discovered as a surprise: a later failure report can read this and
 * say so. It is the carried half of the loud-proceed policy.
 */
export interface UnsnapshottedApply {
  at: string;
  dataDir: string;
  pending: string;
}
let unsnapshottedApply: UnsnapshottedApply | null = null;
export const lastUnsnapshottedApply = (): UnsnapshottedApply | null => unsnapshottedApply;

/**
 * Say what this boot is about to change, before it changes it.
 *
 * THE POLICY, from the technique, keyed on what is known about the pending work:
 *   • nothing pending, or a fresh store ⇒ silent. A boot that re-asserts the
 *     schema is not an event, and a store being created has nothing to lose.
 *   • additive work pending ⇒ PROCEED, LOUDLY. Blocking every boot on the
 *     absence of a backup would convert a hypothetical risk into a certain
 *     outage; the skipped snapshot is named here and carried in
 *     `lastUnsnapshottedApply()` for any later failure report.
 *   • DESTRUCTIVE work pending ⇒ REFUSE. Running a one-way door with the safety
 *     net cut is the one case where the outage is the cheaper outcome.
 *
 * Failing to answer the question is not a reason to skip the DDL: an unreadable
 * catalog is reported and the boot continues, because `open()`'s contract is to
 * either produce a working store or reject, and "I could not check" is neither.
 */
export async function disclosePendingDdl(pg: Pglite, ddl: string = CORE_DDL): Promise<void> {
  const { describePending, destructiveStatements, pendingSchemaObjects } = await import("./pending");
  let pending;
  try {
    pending = await pendingSchemaObjects(pg, ddl);
  } catch (err) {
    console.warn(`[db] could not determine whether schema work is pending before applying CORE_DDL: ${String(err)}`);
    return;
  }
  if (pending.count === 0 || pending.storeState === "fresh") return;

  const destructive = destructiveStatements(ddl);
  if (destructive.length > 0) {
    throw new Error(
      `[db] REFUSING to apply CORE_DDL: ${describePending(pending)}, and the DDL contains ${destructive.length} ` +
        `destructive statement(s) — ${destructive[0]}. A destructive migration must not run without a snapshot. ` +
        `Run \`npm run db:migrate\`, which snapshots and verifies first.`,
    );
  }

  unsnapshottedApply = { at: new Date().toISOString(), dataDir: pglitePath(), pending: describePending(pending) };
  console.warn(
    `[db] applying schema work at boot WITHOUT a pre-migration snapshot: ${describePending(pending)}. ` +
      `Every step is additive (create/add column, guarded by if-not-exists), which is why this proceeds instead ` +
      `of refusing — but the copy that would let you go back was not taken. \`npm run db:migrate\` takes a ` +
      `verified snapshot first and applies the same DDL.`,
  );
}

/* ── row coercion helpers ────────────────────────────────────────────────── */

export const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
export const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === "string" ? v : String(v);
export const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
export const num = (v: unknown): number => numOrNull(v) ?? 0;
export const bool = (v: unknown): boolean => v === true || v === "t" || v === "true" || v === 1;
/**
 * Dates come back as JS Date (or string) — normalize to a bare ISO date/instant.
 *
 * A Date whose time is not finite must NOT reach `toISOString()`: that throws
 * `RangeError: Invalid time value`, and because every feature loader converts a
 * throw into `null`, ONE such value takes down a whole surface. Postgres accepts
 * `'infinity'`/`'-infinity'` for `timestamptz`, so this is reachable from real
 * data, not a hypothetical — a single `membership.to_at = 'infinity'` blanked the
 * entire MP dossier to `DataUnavailable` (found 2026-07-28). The honest result is
 * the unrepresentable value handed on as a string the caller can detect and
 * label, never an exception that erases 40 other real facts.
 */
const invalidDate = (d: Date) => !Number.isFinite(d.getTime());
export const isoDate = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return invalidDate(v) ? String(v) : v.toISOString().slice(0, 10);
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};
export const isoTs = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return invalidDate(v) ? String(v) : v.toISOString();
  return String(v);
};
export const json = (v: unknown): Record<string, unknown> => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
};

/**
 * Chunked multi-row upsert.
 *
 * CHUNK SIZE IS DELIBERATELY SMALL (≤500 rows / ≤30k bind params per statement).
 * Postgres' hard limit is 65535 params, but PGlite (the WASM build) does NOT
 * safely handle statements near that ceiling once the process has already written
 * a lot: feeding the 406k-ballot table in ~6600-row INSERTs left the engine
 * returning INCONSISTENT results afterwards. Reproduced deterministically
 * (2026-07-23) and fixed by capping statement width. See docs/data-analysis/onboarding.md.
 *
 * Rows are de-duplicated on `id` first (last occurrence wins): Postgres rejects an
 * `ON CONFLICT DO UPDATE` that would touch the same row twice, and psp.cz snapshots
 * contain exact duplicate rows.
 */
export async function upsertMany<T extends { id: string }>(
  pg: Pglite,
  table: string,
  columns: string[],
  rows: T[],
  toValues: (row: T) => unknown[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const byId = new Map<string, T>();
  for (const r of rows) byId.set(r.id, r);
  const deduped = [...byId.values()];
  const perRow = columns.length;
  const chunkSize = Math.max(1, Math.min(500, Math.floor(30000 / perRow)));
  const updates = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  // The whole multi-chunk upsert runs as ONE transaction. PGlite auto-commits
  // each statement outside an explicit transaction, so "one upsertMany call"
  // was actually N independent auto-committed statements — a mid-loop failure
  // (a transient WASM error, a malformed row hitting a constraint) left earlier
  // chunks committed and later ones missing, with no rollback and no way for
  // the caller to know which rows actually landed.
  return pg.transaction(async (tx) => {
    let written = 0;
    for (let i = 0; i < deduped.length; i += chunkSize) {
      const chunk = deduped.slice(i, i + chunkSize);
      const params: unknown[] = [];
      const tuples = chunk.map((row) => {
        const vals = toValues(row);
        const placeholders = vals.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        return `(${placeholders.join(",")})`;
      });
      await tx.query(
        `insert into ${table} (${columns.join(",")}) values ${tuples.join(",")}
         on conflict (id) do update set ${updates}`,
        params,
      );
      written += chunk.length;
    }
    return written;
  });
}

export const limitOf = (opts?: ListOptions) => Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));

/**
 * A `limit` that exactly equals the row count is indistinguishable from a full read, and
 * the truncation is SYSTEMATIC, not random: every lister ORDERS its read, so whatever
 * sorts last is simply absent. Money batch 012 grew `supplies` from 2 290 to 153 731 rows
 * against callers that passed `limit: 100_000` — every company whose id sorted late
 * silently lost all of its contracts, and nothing anywhere said so.
 *
 * The kernel's rule is that a dropped row is logged, never silent. This lives in
 * `internals` (rather than in one repository file) because the hazard is not specific to
 * the knowledge-graph tables: `listOrgans({ limit: 2000 })` sat 210 rows from the same
 * silent cliff on the relational side with no guard behind it at all.
 *
 * It cannot distinguish "exactly at the limit" from "truncated", so it warns on both —
 * the false positive is cheap, the miss is not. A caller that legitimately reads exactly
 * its own floor (the readiness probe) must therefore not use a limit as a counter; ask
 * for a COUNT instead.
 */
export function warnIfTruncated(fn: string, got: number, limit: number, filter?: string): void {
  if (got < limit) return;
  console.warn(
    `[db] ${fn} returned exactly its limit (${limit}${filter ? `, filter=${filter}` : ""}) — ` +
      `the result is probably TRUNCATED and, because the query is ordered, systematically so. ` +
      `Raise the limit or page the read; do not trust aggregates computed from this.`,
  );
}
