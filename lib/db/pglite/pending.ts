/**
 * "Is schema work pending?" — the signal a ledger-less replay design does not
 * have, derived from the store itself.
 *
 * WHY THIS EXISTS. `open()` applies the whole `CORE_DDL` at every boot behind
 * `if not exists` guards. That is a REPLAY design: it has no run-once ledger, so
 * nothing anywhere could say whether a boot was about to change the schema or
 * merely re-assert it. Everything the pre-migration-snapshot technique asks for
 * hangs off that one question — snapshot when work is pending, take zero
 * snapshots when it is not, and never discover afterwards that a migration ran
 * unprotected.
 *
 * A LEDGER IS NOT THE ONLY WAY TO ANSWER IT. The technique's own framing is that
 * a ledger-less design "has no is-work-pending signal at all" and is forced to
 * snapshot on every boot. That is true of a design whose steps are opaque
 * scripts. It is not true here: every step `CORE_DDL` performs is a guarded
 * CREATE or ADD COLUMN, so the work it would do is exactly the difference
 * between what it DECLARES and what the catalog already CARRIES. This module
 * computes that difference — three catalog reads, no writes — and gets the
 * refinement the technique wanted without adding a ledger table to a 2 GB store.
 *
 * WHAT IT DOES NOT COVER, stated so nobody reads more into it than is there:
 *   • a column that exists with the WRONG TYPE is not pending here (nothing in
 *     `CORE_DDL` alters a type, and `add column if not exists` would not fix it
 *     either — such a change would be a real migration and would need a real
 *     step);
 *   • constraints, defaults and check-clauses are not compared, only presence;
 *   • a table present with an extra column nothing declares is not a finding —
 *     this is a one-way comparison, declared→present, by design.
 * Drift in the other direction is `npm run db:snapshot -- --check`'s job.
 */

import { CORE_DDL } from "./ddl";
import type { Pglite } from "./internals";

export interface DeclaredColumn {
  table: string;
  column: string;
}

export interface DeclaredSchema {
  tables: string[];
  indexes: string[];
  /** Only columns added by a standalone `alter table … add column if not exists`;
   *  columns inside a `create table` arrive with the table. */
  columns: DeclaredColumn[];
}

/** `--` comments are stripped first: the DDL discusses its own statements in
 *  prose ("`create table if not exists` alone would leave them without…"), and a
 *  parser that reads comments invents objects nobody declared. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

export function declaredObjects(ddl: string = CORE_DDL): DeclaredSchema {
  const sql = stripSqlComments(ddl);
  const tables = [...sql.matchAll(/create\s+table\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)/gi)].map((m) =>
    m[1]!.toLowerCase(),
  );
  const indexes = [...sql.matchAll(/create\s+(?:unique\s+)?index\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)/gi)].map(
    (m) => m[1]!.toLowerCase(),
  );
  const columns = [
    ...sql.matchAll(/alter\s+table\s+([a-z_][a-z0-9_]*)\s+add\s+column\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)/gi),
  ].map((m) => ({ table: m[1]!.toLowerCase(), column: m[2]!.toLowerCase() }));
  return { tables, indexes, columns };
}

export interface PendingSchema {
  /**
   * `fresh` = the store carries NONE of the declared tables, so applying the DDL
   * is a creation and there is nothing to preserve. `existing` = at least one
   * declared table is already there, and any pending work is a migration over
   * data somebody owns.
   */
  storeState: "fresh" | "existing";
  tables: string[];
  indexes: string[];
  columns: DeclaredColumn[];
  /** Total pending objects. 0 means the next `exec(CORE_DDL)` is a no-op replay. */
  count: number;
}

/**
 * Compare `CORE_DDL`'s declarations against the live catalog. Read-only.
 *
 * A pending COLUMN is reported only for a table that already exists: a missing
 * table brings its columns with it, and listing both would double-count the same
 * step (and read as if the migration were larger than it is).
 */
export async function pendingSchemaObjects(pg: Pglite, ddl: string = CORE_DDL): Promise<PendingSchema> {
  const declared = declaredObjects(ddl);

  const tableRows = await pg.query<{ tablename: unknown }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  const present = new Set(tableRows.rows.map((r) => String(r.tablename).toLowerCase()));

  const indexRows = await pg.query<{ indexname: unknown }>(
    "select indexname from pg_indexes where schemaname = 'public'",
  );
  const presentIndexes = new Set(indexRows.rows.map((r) => String(r.indexname).toLowerCase()));

  const columnRows = await pg.query<{ table_name: unknown; column_name: unknown }>(
    "select table_name, column_name from information_schema.columns where table_schema = 'public'",
  );
  const presentColumns = new Set(
    columnRows.rows.map((r) => `${String(r.table_name).toLowerCase()}.${String(r.column_name).toLowerCase()}`),
  );

  const tables = declared.tables.filter((t) => !present.has(t));
  const indexes = declared.indexes.filter((i) => !presentIndexes.has(i));
  const columns = declared.columns.filter((c) => present.has(c.table) && !presentColumns.has(`${c.table}.${c.column}`));

  return {
    storeState: declared.tables.some((t) => present.has(t)) ? "existing" : "fresh",
    tables,
    indexes,
    columns,
    count: tables.length + indexes.length + columns.length,
  };
}

/**
 * Statements in a DDL string that destroy or rewrite existing data. Today this
 * returns [] for `CORE_DDL` — every step is `create … if not exists` or
 * `alter … add column if not exists` — and that is exactly the point: the moment
 * it stops being true, the snapshot policy flips from "proceed loudly" to
 * "refuse", without anyone having to remember to change it.
 *
 * It is a text scan, so it is a floor, not a proof: a destructive step hidden
 * behind a `do $$ … $$` block or a function call would pass. Nothing in this
 * repo's DDL has that shape, and the scan is the cheap half of a guard whose
 * expensive half is a human reading the diff.
 */
export function destructiveStatements(ddl: string = CORE_DDL): string[] {
  const sql = stripSqlComments(ddl);
  const found: string[] = [];
  const patterns: RegExp[] = [
    /\bdrop\s+table\b[^;]*/gi,
    /\bdrop\s+index\b[^;]*/gi,
    /\btruncate\b[^;]*/gi,
    /\balter\s+table\s+[a-z_][a-z0-9_]*\s+drop\b[^;]*/gi,
    /\balter\s+table\s+[a-z_][a-z0-9_]*\s+alter\s+column\s+[a-z_][a-z0-9_]*\s+type\b[^;]*/gi,
    /\bdelete\s+from\b[^;]*/gi,
    /\bupdate\s+[a-z_][a-z0-9_]*\s+set\b[^;]*/gi,
  ];
  for (const re of patterns) {
    for (const m of sql.matchAll(re)) found.push(m[0]!.replace(/\s+/g, " ").trim());
  }
  return found;
}

/** One line a human can weigh, with the objects named rather than counted. */
export function describePending(p: PendingSchema): string {
  if (p.count === 0) return `0 steps pending — CORE_DDL would only re-assert what the store already carries`;
  const parts: string[] = [];
  if (p.tables.length > 0) parts.push(`${p.tables.length} table(s): ${p.tables.join(", ")}`);
  if (p.indexes.length > 0) parts.push(`${p.indexes.length} index(es): ${p.indexes.join(", ")}`);
  if (p.columns.length > 0) {
    parts.push(`${p.columns.length} column(s): ${p.columns.map((c) => `${c.table}.${c.column}`).join(", ")}`);
  }
  return `${p.count} pending object(s) on an ${p.storeState} store — ${parts.join("; ")}`;
}
