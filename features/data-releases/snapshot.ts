/*
 * SNAPSHOT (batch-3 item 3D) — čistá stavba stahovatelného JSON výřezu
 * veřejného grafu. Žádný server, žádné DB volání: dostane už načtené kg řádky
 * a manifest, vrátí deterministický objekt + přesnou velikost v bajtech
 * (velikost se PŘIZNÁVÁ na stránce i v Content-Length routy).
 *
 * Výřez je záměrně ohraničený: kg_node/kg_edge jsou odvozená, rekomputovatelná
 * metadata bez `raw` payloadů — přesně vrstva, kterou dává smysl vydávat jako
 * artefakt. Stropy (`SNAPSHOT_NODE_CAP` / `SNAPSHOT_EDGE_CAP`) chrání routu
 * před mnohasetmegabajtovou odpovědí a jsou součástí payloadu (`limits`),
 * takže ořez nikdy není zamlčený.
 */

import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import type { ReleaseManifest } from "./manifest";

export const SNAPSHOT_SCHEMA = "politicas.civic-graph-snapshot/1";

/** Stropy výřezu — přiznané v `limits` a v metodice na /data. */
export const SNAPSHOT_NODE_CAP = 20_000;
export const SNAPSHOT_EDGE_CAP = 20_000;

export interface SnapshotInput {
  manifest: Pick<ReleaseManifest, "version" | "cutAt" | "degraded" | "manifestHash" | "hashAlgorithm">;
  nodes: ReadonlyArray<KgNodeRow>;
  edges: ReadonlyArray<KgEdgeRow>;
  /** Plné počty ve store — aby `limits` uměly říct, kolik se NEvešlo. */
  totalNodes: number;
  totalEdges: number;
}

export interface Snapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  release: {
    version: string | null;
    cutAt: string | null;
    degraded: boolean;
    manifestHash: string;
    hashAlgorithm: string;
  };
  limits: {
    nodeCap: number;
    edgeCap: number;
    nodesIncluded: number;
    edgesIncluded: number;
    nodesTotal: number;
    edgesTotal: number;
    /** true, když se do výřezu nevešly všechny řádky store. */
    truncated: boolean;
  };
  nodes: KgNodeRow[];
  edges: KgEdgeRow[];
}

/** Postaví výřez; stropy vynucuje sám (loader je jen první obrana). */
export function buildSnapshot(input: SnapshotInput): Snapshot {
  const nodes = input.nodes.slice(0, SNAPSHOT_NODE_CAP);
  const edges = input.edges.slice(0, SNAPSHOT_EDGE_CAP);
  return {
    schema: SNAPSHOT_SCHEMA,
    release: {
      version: input.manifest.version,
      cutAt: input.manifest.cutAt,
      degraded: input.manifest.degraded,
      manifestHash: input.manifest.manifestHash,
      hashAlgorithm: input.manifest.hashAlgorithm,
    },
    limits: {
      nodeCap: SNAPSHOT_NODE_CAP,
      edgeCap: SNAPSHOT_EDGE_CAP,
      nodesIncluded: nodes.length,
      edgesIncluded: edges.length,
      nodesTotal: input.totalNodes,
      edgesTotal: input.totalEdges,
      truncated: nodes.length < input.totalNodes || edges.length < input.totalEdges,
    },
    nodes,
    edges,
  };
}

export interface SnapshotPayload {
  json: string;
  /** Přesná velikost UTF-8 payloadu v bajtech — tohle číslo se přiznává. */
  bytes: number;
}

/** Serializace + přesná velikost (TextEncoder — týž kód na serveru i ve vitestu). */
export function snapshotPayload(snapshot: Snapshot): SnapshotPayload {
  const json = JSON.stringify(snapshot);
  return { json, bytes: new TextEncoder().encode(json).byteLength };
}

/** Název souboru ke stažení: `politicas-civic-graph-2026.07.30.json`. */
export function snapshotFilename(version: string | null): string {
  return `politicas-civic-graph-${version ?? "nevydano"}.json`;
}

/** „2,4 MB" nepatří sem — formátování drží lib/format; tohle jen převod. */
export const bytesToMegabytes = (bytes: number): number => bytes / (1024 * 1024);
