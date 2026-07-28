/**
 * `listKgEdges`' `order by src, rel, dst`, reproduced in JS.
 *
 * `kgNeighbours()` — the INDEXED per-node edge read (`kg_edge_src_idx` /
 * `kg_edge_dst_idx`), the primitive a per-entity loader should use instead of
 * scanning a whole relation — orders its result by `weight desc nulls last`.
 * That is not a total order: weights are stored rounded (co-voting agreement to
 * 3 dp), so ties are dense and Postgres is free to return them in any order,
 * differing between runs of the same build.
 *
 * A surface that ranks by weight and then cuts a top-N therefore has to impose a
 * total order itself, or the page shuffles between builds for no data reason.
 * This is that order, and it is deliberately the SAME one the whole-relation
 * listers use, so switching a loader from `listKgEdges` to `kgNeighbours` is a
 * pure-performance change with an identical rendered result.
 *
 * Plain codepoint compare is correct here: kg ids are ASCII by construction
 * (`psp:person:6751`, `bill:tisk:58`, `co:00000000`), so no collation applies.
 */
export function byListOrder(
  a: { src: string; rel: string; dst: string },
  b: { src: string; rel: string; dst: string },
): number {
  if (a.src !== b.src) return a.src < b.src ? -1 : 1;
  if (a.rel !== b.rel) return a.rel < b.rel ? -1 : 1;
  if (a.dst !== b.dst) return a.dst < b.dst ? -1 : 1;
  return 0;
}
