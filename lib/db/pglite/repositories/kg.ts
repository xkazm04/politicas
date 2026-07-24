// KnowledgeGraphRepository — the derived knowledge graph (tier 2 of the
// self-expanding KG loop). Typed nodes + typed, weighted, provenanced edges;
// DERIVED, recomputable metadata (kg-compute + gated verdicts are the only writers).

import type { KnowledgeGraphRepository } from "../../store";
import type { KgEdgeRow, KgNodeRow } from "../../types";
import { num, str, upsertMany, type Pglite } from "../internals";
import { KG_EDGE_COLS, KG_NODE_COLS, mapKgEdge, mapKgNode } from "../mappers";

export function makeKgRepo(pg: Pglite): KnowledgeGraphRepository {
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
        await pg.query(
          `insert into kg_edge (${KG_EDGE_COLS.join(",")}) values ${tuples.join(",")}
           on conflict (src, rel, dst) do update set ${updates}`,
          params,
        );
        written += chunk.length;
      }
      return written;
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
    async clearKg() {
      await pg.query(`delete from kg_edge`);
      await pg.query(`delete from kg_node`);
    },
  };
}
