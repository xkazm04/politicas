// Server-only: loader /data — čte store i trezor STRIKTNĚ jen pro čtení
// (design doc batch-3 §3D) a předává čistým derivacím v manifest.ts /
// snapshot.ts. Všechna čtení jdou přes existující API:
//
//   1. Store.kgKindCounts / countKgNodes / countKgEdges / countKgEdgesByRel /
//      countVoteBallots — kardinality pro manifest a vydávací bránu.
//   2. Store.listIngestRuns — lineage + zdroj verze + changelog.
//   3. LedgerRepository.getLedgerHeads — hlavy trezoru (hash-řetěz revizí,
//      Merkle kořeny běhů); jen čtení, render je práce téhle stránky.
//   4. Store.listKgNodes / listKgEdges (se stropy) — obsah snapshotu; velikost
//      se počítá z TÉHOŽ payloadu, který routa vydává, žádný odhad.
//
// Degrade kontrakt zrcadlí getDukazyData: store nedostupný → null (stránka
// vykreslí čestné „nečitelné, ne prázdné"); prázdný, ale čitelný store je
// regulérní manifest s version: null.

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getLedgerRepo } from "@/lib/db/pglite/repositories/ledger";
import { getStore, type Store } from "@/lib/db/store";
import {
  deriveChangelog,
  deriveReleaseManifest,
  type ChangelogRelease,
  type ReleaseManifest,
} from "./manifest";
import {
  buildSnapshot,
  snapshotFilename,
  snapshotPayload,
  SNAPSHOT_EDGE_CAP,
  SNAPSHOT_NODE_CAP,
  type SnapshotPayload,
} from "./snapshot";

export interface DataReleasesData {
  manifest: ReleaseManifest;
  changelog: ChangelogRelease[];
  /** Přesná velikost snapshotu v bajtech — přiznaná u tlačítka stažení. */
  snapshotBytes: number;
  snapshotFilename: string;
}

/** Ingest běhů do manifestu/changelogu — víc než kdy reálně existuje. */
const INGEST_RUN_LIMIT = 500;

async function readManifest(
  store: Store,
): Promise<{ manifest: ReleaseManifest; ingestRuns: Awaited<ReturnType<Store["listIngestRuns"]>> }> {
  const [kindCounts, edgeRelCounts, kgNodeTotal, kgEdgeTotal, voteBallotTotal, ingestRuns, ledgerHeads] =
    await Promise.all([
      store.kgKindCounts(),
      store.countKgEdgesByRel(),
      store.countKgNodes(),
      store.countKgEdges(),
      store.countVoteBallots(),
      store.listIngestRuns(INGEST_RUN_LIMIT),
      getLedgerRepo().then((repo) => repo.getLedgerHeads()),
    ]);
  const manifest = deriveReleaseManifest({
    kindCounts,
    edgeRelCounts,
    kgNodeTotal,
    kgEdgeTotal,
    voteBallotTotal,
    ingestRuns,
    ledgerHeads,
  });
  return { manifest, ingestRuns };
}

async function readSnapshot(store: Store, manifest: ReleaseManifest): Promise<SnapshotPayload> {
  const [nodes, edges] = await Promise.all([
    store.listKgNodes({ limit: SNAPSHOT_NODE_CAP }),
    store.listKgEdges({ limit: SNAPSHOT_EDGE_CAP }),
  ]);
  return snapshotPayload(
    buildSnapshot({
      manifest,
      nodes,
      edges,
      totalNodes: manifest.counts.kgNodes,
      totalEdges: manifest.counts.kgEdges,
    }),
  );
}

export async function getDataReleasesData(): Promise<DataReleasesData | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const { manifest, ingestRuns } = await readManifest(store);
    const { bytes } = await readSnapshot(store, manifest);
    return {
      manifest,
      changelog: deriveChangelog(ingestRuns),
      snapshotBytes: bytes,
      snapshotFilename: snapshotFilename(manifest.version),
    };
  } catch (err) {
    reportLoaderFailure("getDataReleasesData", err);
    return null;
  }
}

/** Pro routu /data/manifest.json — týž manifest, strojově čitelný. */
export async function getReleaseManifest(): Promise<ReleaseManifest | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    return (await readManifest(store)).manifest;
  } catch (err) {
    reportLoaderFailure("getReleaseManifest", err);
    return null;
  }
}

/** Pro routu /data/snapshot.json — payload + přesná velikost + název souboru. */
export async function getSnapshotDownload(): Promise<(SnapshotPayload & { filename: string }) | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const { manifest } = await readManifest(store);
    const payload = await readSnapshot(store, manifest);
    return { ...payload, filename: snapshotFilename(manifest.version) };
  } catch (err) {
    reportLoaderFailure("getSnapshotDownload", err);
    return null;
  }
}
