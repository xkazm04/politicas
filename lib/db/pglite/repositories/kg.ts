// KnowledgeGraphRepository — the derived knowledge graph (tier 2 of the
// self-expanding KG loop). Typed nodes + typed, weighted, provenanced edges;
// DERIVED, recomputable metadata (kg-compute + gated verdicts are the only writers).

import type { KnowledgeGraphRepository } from "../../store";
import type { KgEdgeRow, KgNodeRow } from "../../types";
import { num, str, type Pglite, type PgTransaction } from "../internals";
import { KG_EDGE_COLS, KG_NODE_COLS, mapKgEdge, mapKgNode } from "../mappers";

/* ── bitemporal write discipline (SUPERSEDE, never overwrite) ────────────────
 *
 * kg claims are bitemporal (see the "bitemporal claims" section of ddl.ts):
 * the serving tables (kg_node / kg_edge) hold ONLY the current version of each
 * claim; every replaced or removed version is appended to kg_node_history /
 * kg_edge_history with its record-time span closed ([recorded_at,
 * superseded_at), half-open). The rules every write path in this file (and the
 * review edge-flip in review.ts) follows:
 *
 *   1. Before an UPDATE changes a claim's content, the pre-update version is
 *      copied to history with superseded_at = now(). The content-changed guard
 *      is load-bearing (data-layer.md M2): re-ingesting identical content must
 *      NOT churn history or recorded_at — a no-op upsert leaves both timelines
 *      untouched, so `recorded_at` honestly means "when this content appeared".
 *   2. Before a DELETE, the deleted version is copied to history the same way.
 *      A claim that later reappears gets a fresh recorded_at — asOf() inside
 *      the gap correctly shows it absent.
 *   3. History is append-only. Nothing updates or deletes history rows.
 *   4. All archive+write pairs run in ONE statement (data-modifying CTEs share
 *      a snapshot) or one transaction, so `superseded_at` of the old version
 *      and `recorded_at` of the new are the SAME instant (transaction now()) —
 *      spans per key stay contiguous and never overlap.
 *
 * Current-time reads are untouched: they still read the serving tables only,
 * and the mappers ignore the temporal columns, so existing callers see
 * byte-identical rows. Time-travel goes through `asOf()` below.
 *
 * NOTE on clearKg + full recompute pipelines: clearKg archives everything it
 * wipes (the record honestly says "at this instant the graph was empty"). A
 * clear-then-rebuild pass therefore closes and reopens every claim's span even
 * when content is identical. Pipelines that care about history hygiene should
 * upsert in place (rule 1 makes that free) rather than clear + rebuild. */

/** Reads of the graph as it was KNOWN at one instant (record time). */
export interface KgAsOfReads {
  listKgNodes(opts?: { kind?: string; limit?: number }): Promise<KgNodeRow[]>;
  listKgEdges(opts?: { rel?: string; limit?: number }): Promise<KgEdgeRow[]>;
  getKgNodes(ids: string[]): Promise<KgNodeRow[]>;
  kgNeighbours(opts: { id: string; rels?: string[]; limit?: number }): Promise<{ edges: KgEdgeRow[]; nodes: KgNodeRow[] }>;
  countKgNodes(): Promise<number>;
  countKgEdges(): Promise<number>;
}

/**
 * The kg repository plus the bitemporal read API. Deliberately declared HERE,
 * not in lib/db/store.ts (that file is another item's surface this batch):
 * `makeKgRepo` returns the wider type, so the store object carries `asOf` at
 * runtime; later batches can lift it into the Store interface.
 */
export interface BitemporalKnowledgeGraphRepository extends KnowledgeGraphRepository {
  /**
   * The graph as it was known at `at` (record time, [recorded_at,
   * superseded_at) half-open — at the exact supersede instant the newer
   * version is visible). `asOf(now)` is row-identical to the current reads.
   * Runs over an un-indexed union of serving + history tables — a history
   * instrument, not a hot serving path.
   */
  asOf(at: Date | string): KgAsOfReads;
}

/**
 * The distinct ids at the far end of `edges` relative to `id`, excluding `id`
 * itself. Pure and exported for a colocated test — the one bit of `kgNeighbours`
 * that's logic rather than a query: a self-loop (src = dst = id) resolves to
 * `id` on the "other end" no matter which side you read, so it must be dropped
 * rather than returned as a neighbour of itself.
 */
/**
 * A `limit` that exactly equals the row count is indistinguishable from a full read, and
 * the truncation is SYSTEMATIC, not random: both listers order by id / (src,rel,dst), so
 * whatever sorts last is simply absent. Money batch 012 grew `supplies` from 2 290 to
 * 153 731 rows against callers that passed `limit: 100_000` — every company whose id
 * sorted late silently lost all of its contracts, and nothing anywhere said so.
 *
 * The kernel's rule is that a dropped row is logged, never silent. This is that rule in
 * the one place every caller passes through. It cannot distinguish "exactly at the limit"
 * from "truncated", so it warns on both — the false positive is cheap, the miss is not.
 */
function warnIfTruncated(fn: string, got: number, limit: number, filter?: string): void {
  if (got < limit) return;
  console.warn(
    `[kg] ${fn} returned exactly its limit (${limit}${filter ? `, filter=${filter}` : ""}) — ` +
      `the result is probably TRUNCATED and, because the query is ordered, systematically so. ` +
      `Raise the limit or page the read; do not trust aggregates computed from this.`,
  );
}

export function neighbourIds(edges: KgEdgeRow[], id: string): string[] {
  const out = new Set<string>();
  for (const e of edges) {
    const other = e.src === id ? e.dst : e.src;
    if (other !== id) out.add(other);
  }
  return [...out];
}

/* Content tuples for the changed-content guard (rule 1 above). jsonb equality
 * is SEMANTIC in Postgres (key order does not matter), so a re-serialization
 * of identical props never counts as a change. */
const NODE_CONTENT = ["kind", "label", "props", "first_seen_pass", "provenance"] as const;
const EDGE_CONTENT = ["weight", "props", "provenance"] as const;
const rowOf = (alias: string, cols: readonly string[]) => `row(${cols.map((c) => `${alias}.${c}`).join(", ")})`;

// VALUES tuples need explicit casts — bind params are otherwise untyped there.
const NODE_CASTS = ["text", "text", "text", "jsonb", "integer", "jsonb"];
const EDGE_CASTS = ["text", "text", "text", "real", "jsonb", "jsonb"];

/**
 * One chunk of a supersede-aware upsert, as ONE statement: the `archived` CTE
 * copies every existing row whose content differs from its incoming twin into
 * history (superseded_at = now()), then the upsert applies the incoming rows —
 * bumping recorded_at ONLY when content changed. Both CTE and upsert read the
 * same pre-statement snapshot and share one now(), so the closed history span
 * and the new serving span meet at exactly the same instant.
 */
async function supersedeUpsertChunk(
  tx: PgTransaction,
  opts: {
    table: "kg_node" | "kg_edge";
    cols: readonly string[];
    casts: readonly string[];
    keyCols: readonly string[];
    contentCols: readonly string[];
    chunk: readonly unknown[][];
  },
): Promise<void> {
  const { table, cols, casts, keyCols, contentCols, chunk } = opts;
  const params: unknown[] = [];
  const tuples = chunk.map(
    (vals) =>
      `(${vals
        .map((v, j) => {
          params.push(v);
          return `$${params.length}::${casts[j]}`;
        })
        .join(",")})`,
  );
  const keyJoin = keyCols.map((c) => `i.${c} = t.${c}`).join(" and ");
  const changed = (a: string, b: string) => `${rowOf(a, contentCols)} is distinct from ${rowOf(b, contentCols)}`;
  const updates = contentCols.map((c) => `${c} = excluded.${c}`).join(", ");
  await tx.query(
    `with incoming(${cols.join(",")}) as (values ${tuples.join(",")}),
     archived as (
       insert into ${table}_history (${cols.join(",")}, valid_from, valid_to, recorded_at, superseded_at)
       select ${cols.map((c) => `t.${c}`).join(", ")}, t.valid_from, t.valid_to, t.recorded_at, now()
       from ${table} t join incoming i on ${keyJoin}
       where ${changed("t", "i")}
     )
     insert into ${table} (${cols.join(",")})
     select ${cols.join(",")} from incoming
     on conflict (${keyCols.join(", ")}) do update set ${updates},
       recorded_at = case when ${changed(table, "excluded")} then now() else ${table}.recorded_at end`,
    params,
  );
}

export function makeKgRepo(pg: Pglite): BitemporalKnowledgeGraphRepository {
  // Batch node fetch by id, ONE query via `= any($1)`. Shared by `getKgNodes`
  // and `kgNeighbours` (which resolves its far-end nodes in one extra
  // round-trip rather than per-edge).
  async function nodesByIds(ids: string[]): Promise<KgNodeRow[]> {
    if (ids.length === 0) return [];
    const { rows } = await pg.query<Record<string, unknown>>(
      `select * from kg_node where id = any($1::text[])`,
      [ids],
    );
    return rows.map(mapKgNode);
  }

  /**
   * The set of claim versions visible at $<atParam> (record time), one row per
   * key: serving rows union history rows, filtered to spans containing the
   * instant, newest recorded_at wins (`superseded_at desc nulls first` breaks
   * a same-instant tie in favour of the still-current version). Column list is
   * explicit so both legs align regardless of physical column order.
   */
  const visibleSql = (table: "kg_node" | "kg_edge", cols: readonly string[], atParam: number) => {
    const list = cols.join(", ");
    return `(
      select distinct on (${table === "kg_node" ? "id" : "src, rel, dst"}) ${list}
      from (
        select ${list}, recorded_at, superseded_at from ${table}
        union all
        select ${list}, recorded_at, superseded_at from ${table}_history
      ) v
      where recorded_at <= $${atParam}::timestamptz
        and (superseded_at is null or superseded_at > $${atParam}::timestamptz)
      order by ${table === "kg_node" ? "id" : "src, rel, dst"}, recorded_at desc, superseded_at desc nulls first
    )`;
  };

  return {
    // Supersede-aware (see the write-discipline block at the top of this file);
    // same dedupe-on-key + ≤500-row / ≤30k-param chunking + one-transaction
    // discipline as internals.upsertMany.
    async upsertKgNodes(rows) {
      if (rows.length === 0) return 0;
      const byId = new Map<string, KgNodeRow>();
      for (const r of rows) byId.set(r.id, r);
      const deduped = [...byId.values()];
      const chunkSize = Math.max(1, Math.min(500, Math.floor(30000 / KG_NODE_COLS.length)));
      return pg.transaction(async (tx) => {
        let written = 0;
        for (let i = 0; i < deduped.length; i += chunkSize) {
          const chunk = deduped
            .slice(i, i + chunkSize)
            .map((r) => [r.id, r.kind, r.label, JSON.stringify(r.props), r.firstSeenPass, JSON.stringify(r.provenance)]);
          await supersedeUpsertChunk(tx, {
            table: "kg_node",
            cols: KG_NODE_COLS,
            casts: NODE_CASTS,
            keyCols: ["id"],
            contentCols: NODE_CONTENT,
            chunk,
          });
          written += chunk.length;
        }
        return written;
      });
    },

    // kg_edge has a COMPOSITE primary key (src, rel, dst) — same discipline,
    // keyed on the triple.
    async upsertKgEdges(rows) {
      if (rows.length === 0) return 0;
      const byKey = new Map<string, KgEdgeRow>();
      for (const r of rows) byKey.set(`${r.src} ${r.rel} ${r.dst}`, r);
      const deduped = [...byKey.values()];
      const chunkSize = Math.max(1, Math.min(500, Math.floor(30000 / KG_EDGE_COLS.length)));
      return pg.transaction(async (tx) => {
        let written = 0;
        for (let i = 0; i < deduped.length; i += chunkSize) {
          const chunk = deduped
            .slice(i, i + chunkSize)
            .map((r) => [r.src, r.rel, r.dst, r.weight, JSON.stringify(r.props), JSON.stringify(r.provenance)]);
          await supersedeUpsertChunk(tx, {
            table: "kg_edge",
            cols: KG_EDGE_COLS,
            casts: EDGE_CASTS,
            keyCols: ["src", "rel", "dst"],
            contentCols: EDGE_CONTENT,
            chunk,
          });
          written += chunk.length;
        }
        return written;
      });
    },

    async listKgNodes(opts) {
      const lim = Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));
      const where = opts?.kind ? `where kind = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from kg_node ${where} order by id limit ${lim}`,
        opts?.kind ? [opts.kind] : [],
      );
      warnIfTruncated("listKgNodes", rows.length, lim, opts?.kind);
      return rows.map(mapKgNode);
    },
    async listKgEdges(opts) {
      const lim = Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));
      const where = opts?.rel ? `where rel = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from kg_edge ${where} order by src, rel, dst limit ${lim}`,
        opts?.rel ? [opts.rel] : [],
      );
      warnIfTruncated("listKgEdges", rows.length, lim, opts?.rel);
      return rows.map(mapKgEdge);
    },
    async getKgNodes(ids) {
      return nodesByIds(ids);
    },

    async kgNeighbours(opts) {
      const { id } = opts;
      const lim = Math.max(1, Math.min(2_000_000, opts.limit ?? 500));
      const hasRels = !!opts.rels && opts.rels.length > 0;
      const relFilter = hasRels ? `and rel = any($2::text[])` : "";
      const params: unknown[] = hasRels ? [id, opts.rels] : [id];
      // Two `union all` legs (src = id / dst = id) rather than a single
      // `where src = $1 or dst = $1`: kg_edge has separate btree indexes
      // kg_edge_src_idx and kg_edge_dst_idx, and an `or` across two columns
      // can force a sequential scan instead of two index scans. Do NOT
      // "simplify" this back to `or`.
      // The `src <> $1` guard on the dst leg stops a self-loop (src = dst =
      // id) — which satisfies both legs — from being returned twice.
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from kg_edge where src = $1 ${relFilter}
         union all
         select * from kg_edge where dst = $1 and src <> $1 ${relFilter}
         order by weight desc nulls last
         limit ${lim}`,
        params,
      );
      const edges = rows.map(mapKgEdge);
      const nodes = await nodesByIds(neighbourIds(edges, id));
      return { edges, nodes };
    },

    async countKgNodes() {
      const { rows } = await pg.query<{ n: string | number }>(`select count(*)::int as n from kg_node`);
      return num(rows[0]?.n);
    },
    async countKgEdges() {
      const { rows } = await pg.query<{ n: string | number }>(`select count(*)::int as n from kg_edge`);
      return num(rows[0]?.n);
    },
    async countKgEdgesByRel() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select rel, count(*)::int as n from kg_edge group by rel order by rel`,
      );
      const out: Record<string, number> = {};
      for (const r of rows) out[str(r.rel)] = num(r.n);
      return out;
    },
    async kgKindCounts() {
      // kg_node_kind_idx backs the group by.
      const { rows } = await pg.query<Record<string, unknown>>(
        `select kind, count(*)::int as count from kg_node group by kind order by count desc`,
      );
      return rows.map((r) => ({ kind: str(r.kind), count: num(r.count) }));
    },
    // Bulk wipe — but a SUPERSEDE, not an erasure: every wiped version is
    // archived first, so asOf() before this instant still replays the graph.
    // See the clearKg note in the write-discipline block: prefer upsert-in-
    // place over clear+rebuild if history hygiene matters to your pipeline.
    async clearKg() {
      await pg.transaction(async (tx) => {
        await tx.query(
          `with a as (
             insert into kg_edge_history (${KG_EDGE_COLS.join(",")}, valid_from, valid_to, recorded_at, superseded_at)
             select ${KG_EDGE_COLS.join(",")}, valid_from, valid_to, recorded_at, now() from kg_edge
           ) delete from kg_edge`,
        );
        await tx.query(
          `with a as (
             insert into kg_node_history (${KG_NODE_COLS.join(",")}, valid_from, valid_to, recorded_at, superseded_at)
             select ${KG_NODE_COLS.join(",")}, valid_from, valid_to, recorded_at, now() from kg_node
           ) delete from kg_node`,
        );
      });
    },

    async deleteKgEdges(keys) {
      let deleted = 0;
      for (const k of keys) {
        // Archive + delete in ONE statement: both CTEs read the same snapshot,
        // so the archived copy is exactly the row being deleted.
        const { rows } = await pg.query<{ n: string | number }>(
          `with a as (
             insert into kg_edge_history (${KG_EDGE_COLS.join(",")}, valid_from, valid_to, recorded_at, superseded_at)
             select ${KG_EDGE_COLS.join(",")}, valid_from, valid_to, recorded_at, now()
             from kg_edge where src = $1 and rel = $2 and dst = $3
           ),
           d as (delete from kg_edge where src = $1 and rel = $2 and dst = $3 returning 1)
           select count(*)::int as n from d`,
          [k.src, k.rel, k.dst],
        );
        deleted += num(rows[0]?.n);
      }
      return deleted;
    },

    async deleteKgNodes(ids) {
      if (ids.length === 0) return 0;
      const { rows } = await pg.query<{ n: string | number }>(
        `with a as (
           insert into kg_node_history (${KG_NODE_COLS.join(",")}, valid_from, valid_to, recorded_at, superseded_at)
           select ${KG_NODE_COLS.join(",")}, valid_from, valid_to, recorded_at, now()
           from kg_node where id = any($1::text[])
         ),
         d as (delete from kg_node where id = any($1::text[]) returning 1)
         select count(*)::int as n from d`,
        [ids],
      );
      return num(rows[0]?.n);
    },

    asOf(at) {
      const atIso = at instanceof Date ? at.toISOString() : at;
      return {
        async listKgNodes(opts) {
          const lim = Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));
          const params: unknown[] = opts?.kind ? [opts.kind, atIso] : [atIso];
          const { rows } = await pg.query<Record<string, unknown>>(
            `select * from ${visibleSql("kg_node", KG_NODE_COLS, params.length)} s
             ${opts?.kind ? "where kind = $1" : ""} order by id limit ${lim}`,
            params,
          );
          warnIfTruncated("asOf.listKgNodes", rows.length, lim, opts?.kind);
          return rows.map(mapKgNode);
        },
        async listKgEdges(opts) {
          const lim = Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));
          const params: unknown[] = opts?.rel ? [opts.rel, atIso] : [atIso];
          const { rows } = await pg.query<Record<string, unknown>>(
            `select * from ${visibleSql("kg_edge", KG_EDGE_COLS, params.length)} s
             ${opts?.rel ? "where rel = $1" : ""} order by src, rel, dst limit ${lim}`,
            params,
          );
          warnIfTruncated("asOf.listKgEdges", rows.length, lim, opts?.rel);
          return rows.map(mapKgEdge);
        },
        async getKgNodes(ids) {
          if (ids.length === 0) return [];
          const { rows } = await pg.query<Record<string, unknown>>(
            `select * from ${visibleSql("kg_node", KG_NODE_COLS, 1)} s where id = any($2::text[])`,
            [atIso, ids],
          );
          return rows.map(mapKgNode);
        },
        async kgNeighbours(opts) {
          const { id } = opts;
          const lim = Math.max(1, Math.min(2_000_000, opts.limit ?? 500));
          const hasRels = !!opts.rels && opts.rels.length > 0;
          // Params: $1 = at, $2 = id, $3 = rels (optional). Same self-loop
          // discipline as the current-time read (src <> id on the dst leg).
          const relFilter = hasRels ? `and rel = any($3::text[])` : "";
          const params: unknown[] = hasRels ? [atIso, id, opts.rels] : [atIso, id];
          const { rows } = await pg.query<Record<string, unknown>>(
            `with visible as (select * from ${visibleSql("kg_edge", KG_EDGE_COLS, 1)} v)
             select * from visible where src = $2 ${relFilter}
             union all
             select * from visible where dst = $2 and src <> $2 ${relFilter}
             order by weight desc nulls last
             limit ${lim}`,
            params,
          );
          const edges = rows.map(mapKgEdge);
          const ids = neighbourIds(edges, id);
          if (ids.length === 0) return { edges, nodes: [] };
          const { rows: nodeRows } = await pg.query<Record<string, unknown>>(
            `select * from ${visibleSql("kg_node", KG_NODE_COLS, 1)} s where id = any($2::text[])`,
            [atIso, ids],
          );
          return { edges, nodes: nodeRows.map(mapKgNode) };
        },
        async countKgNodes() {
          const { rows } = await pg.query<{ n: string | number }>(
            `select count(*)::int as n from ${visibleSql("kg_node", KG_NODE_COLS, 1)} s`,
            [atIso],
          );
          return num(rows[0]?.n);
        },
        async countKgEdges() {
          const { rows } = await pg.query<{ n: string | number }>(
            `select count(*)::int as n from ${visibleSql("kg_edge", KG_EDGE_COLS, 1)} s`,
            [atIso],
          );
          return num(rows[0]?.n);
        },
      };
    },
  };
}
