/**
 * Per-table storage accounting for the ONE PGlite store, and the declared
 * retention policy of every table in `CORE_DDL`.
 *
 * WHY THIS FILE EXISTS
 * The store on this box is 2 030 MB and nothing in the repo could say which
 * table that is. "The database is 2 GB" is a fact nobody can act on; "one table
 * is 1,4 GB of it" is a fix. The unit of actionability is the table, so this is
 * a per-table report — and it is the join partner of `instrument.ts`: the timing
 * rings say which table is SLOW, this says which table is BIG. A slow read over
 * a big table is a pruning finding; a slow read over a small one is a plan
 * regression. Neither half answers that alone.
 *
 * EVERY NUMBER CARRIES HOW IT WAS MEASURED, because two byte figures that both
 * look like "the size of this table" are different claims:
 *   • `totalBytes` = `pg_total_relation_size` — PAGES ALLOCATED to the heap, its
 *     indexes and its TOAST. This is what the file on disk is carrying.
 *   • `rows` = an exact `count(*)` taken at report time, NOT an estimate.
 *     `pg_stat_user_tables` reads all-zero on this substrate (measured
 *     2026-08-24: 2 000 inserts then 1 111 deletes still reported
 *     n_live_tup 0 / n_dead_tup 0 — PGlite ships no running stats collector),
 *     and `pg_class.reltuples` is −1 until someone runs ANALYZE. So the cheap
 *     estimates are not merely imprecise here, they are absent; the report pays
 *     for a real scan rather than printing a zero that looks like a measurement.
 *
 * WHAT IS DELIBERATELY NOT REPORTED
 * Reclaimable space (dead tuples, bloat) is UNOBSERVABLE on this substrate for
 * the same reason: no stats collector. A "0 B reclaimable" column would read as
 * evidence that there is nothing to reclaim, which is the failure mode
 * `instrument.ts` refuses for lock waits. It is named in `unobservable` instead,
 * so the report's own follow-up question ("would pruning shrink the file?") gets
 * an honest "not measurable here", never a fabricated number.
 *
 * RETENTION IS DECLARED HERE, ONE ENTRY PER TABLE
 * The registry technique's law is creation-names-reaper at table granularity:
 * every table whose rows accumulate names its policy at design time. `RETENTION`
 * below is that declaration, and `unpolicedTables()` makes it enforceable — a
 * new table in `CORE_DDL` with no entry is reported by the test AND printed in
 * the report's own footer, so the omission cannot hide.
 *
 * The policy for the accumulating tables is `unbounded`, and that is a DECISION
 * with a date on it, not an oversight: keeping expired data is the pattern until
 * the production dynamic resolves (operator, 2026-08-24). This module therefore
 * ships the measuring half of the technique and no pruner at all. When retention
 * is revisited, the pruner belongs behind this report's evidence — dry-run by
 * default, age floors, terminal-state allowlists — and this file's declarations
 * are where its per-table policy should be read from.
 */

import { KNOWN_TABLES } from "./instrument";
import { num, type Pglite } from "./internals";

/* ── declared retention, one entry per CORE_DDL table ──────────────────────── */

export type RetentionClass = "source-mirror" | "derived-recomputable" | "accumulating";

export interface RetentionPolicy {
  /** What bounds this table's size — the question a reader actually has. */
  class: RetentionClass;
  /** The policy in one line, in the terms a human would weigh it in. */
  policy: string;
  /** Set only where the policy is a dated decision rather than a structural fact. */
  decidedAt?: string;
}

const SOURCE_MIRROR: RetentionPolicy = {
  class: "source-mirror",
  policy:
    "no pruning: rows are upserted on a natural key from the published dump, so the table's size is the SOURCE's size, not a function of elapsed time",
};
const DERIVED: RetentionPolicy = {
  class: "derived-recomputable",
  policy:
    "no pruning: every id is deterministic, so re-derivation upserts in place; size follows the derivation's own cardinality, not elapsed time",
};
const KEPT: RetentionPolicy = {
  class: "accumulating",
  policy:
    "UNBOUNDED BY DECISION — grows with use and is never pruned; keeping expired data is the pattern until the production dynamic resolves, revisit at productionization",
  decidedAt: "2026-08-24",
};

/**
 * [G5] One row per sentinel run, keyed by the manifest hash it judged.
 *
 * Accumulating, and its OWN dated decision rather than a share of the
 * 2026-08-24 one — a policy inherits a date only from the day somebody actually
 * weighed it. What was weighed: the report is a HISTORICAL claim ("on this date
 * these invariants held over this exact release"), and re-running the sentinel
 * today cannot reproduce yesterday's verdict over yesterday's store. Pruning
 * would delete the only record that a past release was ever audited — the state
 * this table exists to abolish. It is also tiny: one row per nightly run.
 */
const SENTINEL_RUNS_KEPT: RetentionPolicy = {
  class: "accumulating",
  policy:
    "UNBOUNDED BY DECISION — one row per sentinel run; a verdict is a dated claim about a release that no later run can reproduce, so pruning it erases the audit history itself. ~1 row/night.",
  decidedAt: "2026-09-04",
};

/**
 * Every table `CORE_DDL` creates, and what bounds it.
 *
 * The audit named five accumulating tables. There are SIX: `ingest_run` writes
 * one row per ingest run and nothing ever removes them, which makes it as
 * unbounded as the history tables — it was missed because it is small, and
 * "small today" is not a retention policy.
 */
export const RETENTION: Readonly<Record<string, RetentionPolicy>> = {
  // mirrors of psp.cz / Pumper dumps
  person: SOURCE_MIRROR,
  organ: SOURCE_MIRROR,
  mandate: SOURCE_MIRROR,
  membership: SOURCE_MIRROR,
  vote_event: SOURCE_MIRROR,
  vote_ballot: SOURCE_MIRROR,
  absence: SOURCE_MIRROR,
  source_release: SOURCE_MIRROR,
  // recomputable derivations
  slice_quality: DERIVED,
  kg_node: DERIVED,
  kg_edge: DERIVED,
  vote_tag: DERIVED,
  // append-only, grows with use
  ingest_run: KEPT,
  review_audit: KEPT,
  kg_node_history: KEPT,
  kg_edge_history: KEPT,
  change_event: KEPT,
  lens_submission: KEPT,
  sentinel_run: SENTINEL_RUNS_KEPT,
};

/** Tables `CORE_DDL` creates that no policy above covers. Empty is the passing state.
 *  `tables` is injectable so the guard's own red state is provable in a test
 *  without editing `CORE_DDL` — a gate nobody has watched fail is not a gate. */
export function unpolicedTables(tables: Iterable<string> = KNOWN_TABLES): string[] {
  return [...tables].filter((t) => !(t in RETENTION)).sort();
}

/** Policies naming a table `CORE_DDL` does not create — a stale declaration. */
export function orphanPolicies(): string[] {
  return Object.keys(RETENTION)
    .filter((t) => !KNOWN_TABLES.has(t))
    .sort();
}

export const retentionFor = (table: string): RetentionPolicy | null => RETENTION[table] ?? null;

/* ── the measurement ───────────────────────────────────────────────────────── */

export interface TableAccounting {
  table: string;
  /** Exact `count(*)` at report time. Never an estimate — see the file header. */
  rows: number;
  /** `pg_total_relation_size`: pages allocated to heap + indexes + TOAST. */
  totalBytes: number;
  /** `pg_relation_size`: the heap's own pages. */
  heapBytes: number;
  /** `pg_indexes_size`: pages allocated to this table's indexes. */
  indexBytes: number;
  /** Pages allocated to the TOAST relation, 0 when the table has none. */
  toastBytes: number;
  /** Share of the summed `totalBytes` over every public table, in percent. */
  sharePct: number;
  retention: RetentionPolicy | null;
}

export interface DirAccounting {
  path: string;
  totalBytes: number;
  /** Top-level entries of the data directory, largest first. */
  entries: { name: string; bytes: number }[];
}

export interface StoreAccounting {
  measuredAt: string;
  tables: TableAccounting[];
  /** Sum of `totalBytes` over the reported tables. */
  totalTableBytes: number;
  /** `pg_database_size(current_database())` — relations + catalogs, NOT pg_wal. */
  databaseBytes: number;
  /** Filesystem view of the data directory; null when the caller passed no path. */
  dir: DirAccounting | null;
  /** Facts this substrate cannot produce, named rather than reported as zero. */
  unobservable: string[];
  /** Tables in CORE_DDL with no declared retention policy. Empty is passing. */
  unpoliced: string[];
}

/** Identifiers cannot be bound as parameters, so the only names that ever reach
 *  a statement are ones `CORE_DDL` itself declared (`KNOWN_TABLES`) that also
 *  came back from `pg_class`, re-checked against the identifier shape here. */
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;

interface SizeRow {
  table_name: unknown;
  total_bytes: unknown;
  heap_bytes: unknown;
  index_bytes: unknown;
  toast_bytes: unknown;
}

/**
 * Measure every public table in the store. `dirPath` is optional: pass it to add
 * the filesystem view (which is the only place `pg_wal` appears — see the report).
 */
export async function storeAccounting(pg: Pglite, dirPath?: string): Promise<StoreAccounting> {
  const sizes = await pg.query<SizeRow>(
    `select c.relname                                        as table_name,
            pg_total_relation_size(c.oid)                    as total_bytes,
            pg_relation_size(c.oid)                          as heap_bytes,
            pg_indexes_size(c.oid)                           as index_bytes,
            coalesce(pg_total_relation_size(c.reltoastrelid), 0) as toast_bytes
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`,
  );

  const present = sizes.rows
    .map((r) => String(r.table_name))
    .filter((t) => SAFE_IDENT.test(t) && KNOWN_TABLES.has(t))
    .sort();

  // One round trip for every count, rather than N. A table CORE_DDL declares but
  // pg_class does not carry is simply absent from `present` — a store mid-migration
  // reports what exists instead of failing the whole report.
  const counts = new Map<string, number>();
  if (present.length > 0) {
    const union = present.map((t) => `select '${t}' as t, count(*)::bigint as n from ${t}`).join(" union all ");
    const res = await pg.query<{ t: unknown; n: unknown }>(union);
    for (const row of res.rows) counts.set(String(row.t), num(row.n));
  }

  const dbSize = await pg.query<{ b: unknown }>("select pg_database_size(current_database()) as b");

  const measured = sizes.rows.filter((r) => present.includes(String(r.table_name)));
  const totalTableBytes = measured.reduce((s, r) => s + num(r.total_bytes), 0);
  const tables: TableAccounting[] = measured
    .map((r) => {
      const table = String(r.table_name);
      const totalBytes = num(r.total_bytes);
      return {
        table,
        rows: counts.get(table) ?? 0,
        totalBytes,
        heapBytes: num(r.heap_bytes),
        indexBytes: num(r.index_bytes),
        toastBytes: num(r.toast_bytes),
        sharePct: totalTableBytes === 0 ? 0 : (totalBytes / totalTableBytes) * 100,
        retention: retentionFor(table),
      };
    })
    .sort((a, b) => b.totalBytes - a.totalBytes || a.table.localeCompare(b.table));

  return {
    measuredAt: new Date().toISOString(),
    tables,
    totalTableBytes,
    databaseBytes: num(dbSize.rows[0]?.b),
    dir: dirPath ? await dirAccounting(dirPath) : null,
    unobservable: [
      "reclaimable space per table (dead tuples / bloat): PGlite runs no stats collector — pg_stat_user_tables reads all-zero even after a measured 1 111-row delete, so a reclaimable column here would be a fabricated zero",
      "row-count estimates (pg_class.reltuples): −1 until an explicit ANALYZE, which is why every count above is a real scan",
    ],
    unpoliced: unpolicedTables(),
  };
}

/* ── the filesystem half ───────────────────────────────────────────────────── */

async function dirAccounting(path: string): Promise<DirAccounting | null> {
  const { readdir, stat } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const sizeOf = async (p: string): Promise<number> => {
    const st = await stat(p);
    if (!st.isDirectory()) return st.size;
    let total = 0;
    for (const e of await readdir(p, { withFileTypes: true })) total += await sizeOf(join(p, e.name));
    return total;
  };

  try {
    const entries: { name: string; bytes: number }[] = [];
    for (const e of await readdir(path, { withFileTypes: true })) {
      entries.push({ name: e.name + (e.isDirectory() ? "/" : ""), bytes: await sizeOf(join(path, e.name)) });
    }
    entries.sort((a, b) => b.bytes - a.bytes);
    return { path, totalBytes: entries.reduce((s, e) => s + e.bytes, 0), entries };
  } catch {
    // A store we cannot stat (held by another process is fine — reading is not) is
    // reported as "no filesystem view", never as zero bytes.
    return null;
  }
}

/* ── the rendering ─────────────────────────────────────────────────────────── */

const MB = 1_048_576;
export const mb = (b: number) => `${(b / MB).toFixed(1)}`;

/**
 * The on-demand report. Its two questions, in the technique's words: "why is my
 * disk full?" gets an answer that names a table, and "why is last March gone?"
 * gets an answer that names a policy — which here is the policy of keeping it.
 */
export function accountingReport(a: StoreAccounting): string {
  const lines: string[] = [];
  lines.push(
    `[db] storage accounting — ${a.tables.length} tables, ${mb(a.totalTableBytes)} MB of pages allocated to them, ` +
      `measured ${a.measuredAt}.`,
  );
  lines.push(
    `  table                  rows        total MB     heap MB    index MB    toast MB   share%  retention`,
  );
  for (const t of a.tables) {
    lines.push(
      `  ${t.table.padEnd(20)} ${String(t.rows).padStart(9)} ${mb(t.totalBytes).padStart(13)} ` +
        `${mb(t.heapBytes).padStart(11)} ${mb(t.indexBytes).padStart(11)} ${mb(t.toastBytes).padStart(11)} ` +
        `${t.sharePct.toFixed(1).padStart(7)}  ${t.retention ? t.retention.class : "NONE DECLARED"}`,
    );
  }
  lines.push(
    `  rows = an exact count(*) taken at report time. total/heap/index/toast MB = PAGES ALLOCATED ` +
      `(pg_total_relation_size / pg_relation_size / pg_indexes_size), which is what the file carries — ` +
      `not the bytes live rows occupy. share% is of the ${mb(a.totalTableBytes)} MB summed above.`,
  );
  lines.push(
    `  database (pg_database_size): ${mb(a.databaseBytes)} MB — relations plus the cluster catalogs. ` +
      `It does NOT include pg_wal, which is why it disagrees with the directory below.`,
  );
  if (a.dir) {
    const wal = a.dir.entries.find((e) => e.name === "pg_wal/");
    lines.push(
      `  data directory ${a.dir.path}: ${mb(a.dir.totalBytes)} MB on disk` +
        (wal
          ? `, of which pg_wal is ${mb(wal.bytes)} MB (${((wal.bytes / a.dir.totalBytes) * 100).toFixed(0)} %). ` +
            `A CHECKPOINT makes those segments recyclable but does NOT return them to the OS — see maintenance.ts.`
          : `.`),
    );
    for (const e of a.dir.entries.slice(0, 6)) {
      lines.push(`    ${e.name.padEnd(22)} ${mb(e.bytes).padStart(9)} MB`);
    }
  } else {
    lines.push(`  data directory: no filesystem view (no path passed, or the directory could not be read).`);
  }
  for (const u of a.unobservable) lines.push(`  NOT MEASURED — ${u}.`);
  const kept = a.tables.filter((t) => t.retention?.class === "accumulating");
  lines.push(
    `  retention: ${kept.length} of these tables accumulate and are kept FOREVER by decision ` +
      `(${kept.map((t) => t.table).join(", ") || "none"}) — dated 2026-08-24, revisit at productionization. ` +
      `The other tables are bounded by their source or by their derivation, not by a policy. ` +
      `There is no pruner in this repo, deliberately: nothing here deletes the user's history.`,
  );
  if (a.unpoliced.length > 0) {
    lines.push(
      `  ${a.unpoliced.length} table(s) in CORE_DDL declare NO retention policy: ${a.unpoliced.join(", ")}. ` +
        `Add an entry to RETENTION in lib/db/pglite/accounting.ts — a table with no named policy is an ` +
        `incident with a long fuse.`,
    );
  }
  return lines.join("\n");
}
