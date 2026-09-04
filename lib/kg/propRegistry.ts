/**
 * The jsonb prop-key registry — which keys the graph is allowed to carry, per node kind
 * and edge rel. Data lives in `prop-registry.json` (seeded 2026-08-22 from the live
 * store); this module is the typed reader + the one validation function every writer
 * calls.
 *
 * WHY. `kg_node.props` / `kg_edge.props` are schemaless jsonb, and the case loops have
 * used that freedom for 16+ batches: `direction_*`, `public_mandate_*`, `corroboration_*`,
 * `review_*`, `recipients_shared*` … Each batch invents keys, nothing records them, and
 * the readers pay an `asUnion()` / `str()` tax per key while a typo in a writer is
 * invisible until a surface renders nothing. CI snapshots the SQL schema but not the
 * jsonb one. This is the jsonb schema.
 *
 * Plain module — no server imports — so scripts, loaders and tests share it.
 */
import registry from "./prop-registry.json";

export interface PropRegistry {
  seededAt: string;
  /**
   * The keys of the `provenance` COLUMN (not `props`) — the contract declared by
   * ./provenance.ts, mirrored here so one file describes the whole jsonb schema
   * of a graph row: what it may claim (nodes/edges) and where it came from.
   * Validation of a stamp lives in provenance.ts; this is the declaration.
   */
  provenance: string[];
  nodes: Record<string, string[]>;
  edges: Record<string, string[]>;
}

const REG = registry as unknown as PropRegistry;

export function knownNodeKeys(kind: string): ReadonlySet<string> {
  return new Set(REG.nodes[kind] ?? []);
}
export function knownEdgeKeys(rel: string): ReadonlySet<string> {
  return new Set(REG.edges[rel] ?? []);
}

/** Keys in `props` that the registry does not list for this kind/rel. Empty = clean. */
export function unregisteredKeys(
  scope: { kind: string } | { rel: string },
  props: Record<string, unknown> | null | undefined,
): string[] {
  const known = "kind" in scope ? knownNodeKeys(scope.kind) : knownEdgeKeys(scope.rel);
  return Object.keys(props ?? {}).filter((k) => !known.has(k));
}

export const PROP_REGISTRY: PropRegistry = REG;
