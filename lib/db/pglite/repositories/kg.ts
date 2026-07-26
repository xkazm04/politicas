// KnowledgeGraphRepository — the derived knowledge graph (tier 2 of the
// self-expanding KG loop). Typed nodes + typed, weighted, provenanced edges;
// DERIVED, recomputable metadata (kg-compute + gated verdicts are the only writers).

import type { KnowledgeGraphRepository } from "../../store";
import type { KgEdgeRow, KgNodeRow } from "../../types";
import { num, str, upsertMany, type Pglite } from "../internals";
import { KG_EDGE_COLS, KG_NODE_COLS, mapKgEdge, mapKgNode } from "../mappers";

/**
 * The distinct ids at the far end of `edges` relative to `id`, excluding `id`
 * itself. Pure and exported for a colocated test — the one bit of `kgNeighbours`
 * that's logic rather than a query: a self-loop (src = dst = id) resolves to
 * `id` on the "other end" no matter which side you read, so it must be dropped
 * rather than returned as a neighbour of itself.
 */
export function neighbourIds(edges: KgEdgeRow[], id: string): string[] {
  const out = new Set<string>();
  for (const e of edges) {
    const other = e.src === id ? e.dst : e.src;
    if (other !== id) out.add(other);
  }
  return [...out];
}

export function makeKgRepo(pg: Pglite): KnowledgeGraphRepository {
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

  return {
    upsertKgNodes: (rows) =>
      upsertMany(pg, "kg_node", KG_NODE_COLS, rows, (r: KgNodeRow) => [
        r.id, r.kind, r.label, JSON.stringify(r.props), r.firstSeenPass, JSON.stringify(r.provenance),
      ]),

    // kg_edge has a COMPOSITE primary key (src, rel, dst), so it can't use the
    // id-keyed upsertMany. Same chunk-width + dedupe discipline, keyed on the triple.
    async upsertKgEdges(rows) {
      if (rows.length === 0) return 0;
      const byKey = new Map<string, KgEdgeRow>();
      for (const r of rows) byKey.set(`${r.src} ${r.rel} ${r.dst}`, r);
      const deduped = [...byKey.values()];
      const chunkSize = Math.max(1, Math.min(500, Math.floor(30000 / KG_EDGE_COLS.length)));
      const updates = ["weight", "props", "provenance"].map((c) => `${c} = excluded.${c}`).join(", ");
      // Same fix as upsertMany in internals.ts: run the whole chunk loop as one
      // transaction so a mid-loop failure can't leave earlier chunks committed
      // and later ones missing with no rollback.
      return pg.transaction(async (tx) => {
        let written = 0;
        for (let i = 0; i < deduped.length; i += chunkSize) {
          const chunk = deduped.slice(i, i + chunkSize);
          const params: unknown[] = [];
          const tuples = chunk.map((r) => {
            const vals = [r.src, r.rel, r.dst, r.weight, JSON.stringify(r.props), JSON.stringify(r.provenance)];
            const placeholders = vals.map((v) => {
              params.push(v);
              return `$${params.length}`;
            });
            return `(${placeholders.join(",")})`;
          });
          await tx.query(
            `insert into kg_edge (${KG_EDGE_COLS.join(",")}) values ${tuples.join(",")}
             on conflict (src, rel, dst) do update set ${updates}`,
            params,
          );
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
      return rows.map(mapKgNode);
    },
    async listKgEdges(opts) {
      const lim = Math.max(1, Math.min(2_000_000, opts?.limit ?? 1_000_000));
      const where = opts?.rel ? `where rel = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from kg_edge ${where} order by src, rel, dst limit ${lim}`,
        opts?.rel ? [opts.rel] : [],
      );
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
    async clearKg() {
      await pg.query(`delete from kg_edge`);
      await pg.query(`delete from kg_node`);
    },

    async deleteKgEdges(keys) {
      let deleted = 0;
      for (const k of keys) {
        const { rows } = await pg.query<{ n: string | number }>(
          `with d as (delete from kg_edge where src = $1 and rel = $2 and dst = $3 returning 1) select count(*)::int as n from d`,
          [k.src, k.rel, k.dst],
        );
        deleted += num(rows[0]?.n);
      }
      return deleted;
    },

    async deleteKgNodes(ids) {
      if (ids.length === 0) return 0;
      const { rows } = await pg.query<{ n: string | number }>(
        `with d as (delete from kg_node where id = any($1::text[]) returning 1) select count(*)::int as n from d`,
        [ids],
      );
      return num(rows[0]?.n);
    },
  };
}
