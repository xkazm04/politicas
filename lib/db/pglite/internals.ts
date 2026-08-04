// PGlite plumbing shared by every repository: the connection interface + memoised
// open(), the row coercion helpers, the chunked upsert, and the limit clamp. Kept
// out of the repository files so each of those reads as pure query logic.

import { pglitePath } from "../config";
import type { ListOptions } from "../store";
import { CORE_DDL } from "./ddl";

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
 */
export async function open(): Promise<Pglite> {
  const g = globalThis as GlobalWithPglite;
  if (!g[PGLITE_KEY]) {
    const opening = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const pg = new PGlite(pglitePath()) as unknown as Pglite;
      await pg.waitReady;
      await pg.exec(CORE_DDL);
      return pg;
    })();
    g[PGLITE_KEY] = opening;
    opening.catch(() => {
      if (g[PGLITE_KEY] === opening) delete g[PGLITE_KEY];
    });
  }
  return g[PGLITE_KEY]!;
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
