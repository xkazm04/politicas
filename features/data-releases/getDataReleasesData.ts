// Server-only: loader /data — čte store i trezor STRIKTNĚ jen pro čtení
// (design doc batch-3 §3D) a předává čistým derivacím v manifest.ts /
// snapshot.ts. Všechna čtení jdou přes existující API:
//
//   1. Store.kgKindCounts / countKgNodes / countKgEdges / countKgEdgesByRel /
//      countVoteBallots — kardinality pro manifest a vydávací bránu.
//   2. Store.listIngestRuns — lineage + zdroj verze + changelog.
//   3. LedgerRepository.getLedgerHeads — hlavy trezoru (hash-řetěz revizí,
//      Merkle kořeny běhů); jen čtení, render je práce téhle stránky.
//   4. Store.listKgNodes / listKgEdges (se stropy) — obsah snapshotu.
//
// Degrade kontrakt zrcadlí getDukazyData: store nedostupný → null (stránka
// vykreslí čestné „nečitelné, ne prázdné"); prázdný, ale čitelný store je
// regulérní manifest s version: null.
//
// ── STRÁNKA UŽ NESESTAVUJE SOUBOR, KTERÝ ZAHODÍ (2026-08-13) ────────────────
// `getDataReleasesData` volal `snapshotPayload()`, tedy `JSON.stringify` nad
// ~20–40 MB payloadem plus `TextEncoder` (druhý stejně velký buffer), a obojí
// zahodil, aby si nechal JEDNO číslo — na routě, která je `force-dynamic`, na
// každém zobrazení. Dnes se velikost MĚŘÍ po řádcích (`measureSnapshotBytes`,
// bajt po bajtu tatáž hodnota) a výsledek — čísla, ne řádky — se pamatuje
// napříč požadavky.
//
// MEMO JE KLÍČOVANÉ OTISKEM MANIFESTU, ne jen časem: manifest se čte čerstvý
// při každém požadavku, takže jakákoli změna počtů (= každý ingest) memo sama
// zneplatní. Pamatují se jen ČÍSLA (velikost + `limits`), nikdy řádky: držet
// 40 000 řádků 24 h v paměti procesu je cena, kterou tahle úspora nevykupuje
// (týž rozsudek jako features/votetrack/ledgerMemo.ts). Změna, která počty
// nehne (např. rozhodnutí lidské brány přepíše `props` hrany), se ve velikosti
// projeví až po vypršení okna — a přesně to říká `download.sizeNote`.
//
// Stažení (`getSnapshotDownload`) memo NEČTE ani neplní: soubor se vždy staví
// z aktuálního store, aby `Content-Length` seděl na bajt.

import "server-only";
import { cache } from "react";
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import { createLedgerMemo } from "@/features/votetrack/ledgerMemo";
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
  measureSnapshotBytes,
  snapshotFilename,
  snapshotPayload,
  SNAPSHOT_EDGE_CAP,
  SNAPSHOT_NODE_CAP,
  type Snapshot,
  type SnapshotLimits,
  type SnapshotPayload,
} from "./snapshot";

/**
 * Co /data o výřezu ke stažení tvrdí: přesná velikost a TYTÉŽ `limits`, jaké
 * nese sám soubor — jeden objekt z jedné stavby, takže se stránka a payload
 * nemají jak rozejít.
 */
export interface SnapshotFacts {
  bytes: number;
  limits: SnapshotLimits;
}

export interface DataReleasesData {
  manifest: ReleaseManifest;
  changelog: ChangelogRelease[];
  /** null = manifest se přečíst dal, ale výřez se změřit nepodařilo. */
  snapshot: SnapshotFacts | null;
  snapshotFilename: string;
}

/** Ingest běhů do manifestu/changelogu — víc než kdy reálně existuje. */
const INGEST_RUN_LIMIT = 500;

/**
 * Memo napříč požadavky nad ODVOZENÝMI čísly výřezu, klíčované otiskem
 * manifestu. Sdílená disciplína `createLedgerMemo`: `null` se nepamatuje a
 * PRÁZDNÝ výřez (nula uzlů i hran) taky ne — prázdno je k nerozeznání od
 * nenaingestovaného store a zmrazit ho znamená tvrdit 24 h, že graf je prázdný.
 */
const snapshotMemo = createLedgerMemo<{ hash: string; facts: SnapshotFacts }>({
  usable: ({ facts }) => facts.limits.nodesIncluded > 0 || facts.limits.edgesIncluded > 0,
  ttlMs: MONEY_MEMO_TTL_MS,
});

/** Testovací šev (vzor `resetSuppliesMemo`) — aplikace ho nikdy nevolá. */
export function resetSnapshotMemo(): void {
  snapshotMemo.reset();
}

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

/** Postaví výřez z aktuálního store. Census (totály i složení) jde z manifestu. */
async function readSnapshot(store: Store, manifest: ReleaseManifest): Promise<Snapshot> {
  const [nodes, edges] = await Promise.all([
    store.listKgNodes({ limit: SNAPSHOT_NODE_CAP }),
    store.listKgEdges({ limit: SNAPSHOT_EDGE_CAP }),
  ]);
  return buildSnapshot({ manifest, nodes, edges });
}

/** Čísla o výřezu pro stránku: z mema, jinak jedno sestavení bez serializace. */
async function snapshotFacts(store: Store, manifest: ReleaseManifest): Promise<SnapshotFacts> {
  const cached = snapshotMemo.read();
  if (cached !== null && cached.hash === manifest.manifestHash) return cached.facts;
  const snapshot = await readSnapshot(store, manifest);
  const facts: SnapshotFacts = { bytes: measureSnapshotBytes(snapshot), limits: snapshot.limits };
  snapshotMemo.write({ hash: manifest.manifestHash, facts });
  return facts;
}

export const getDataReleasesData = cache(async function getDataReleasesData(): Promise<DataReleasesData | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const { manifest, ingestRuns } = await readManifest(store);
    // Výřez degraduje SÁM: manifest je čitelný, tak ať ho výpadek jedné vrstvy
    // nesmete celý (vzor `darkLayers` na velíně). Stránka pak řekne, že soubor
    // popsat neumí — ne, že vydání neexistuje.
    let snapshot: SnapshotFacts | null = null;
    try {
      snapshot = await snapshotFacts(store, manifest);
    } catch (err) {
      reportLoaderFailure("getDataReleasesData:snapshot", err);
    }
    return {
      manifest,
      changelog: deriveChangelog(ingestRuns),
      snapshot,
      snapshotFilename: snapshotFilename(manifest.version),
    };
  } catch (err) {
    reportLoaderFailure("getDataReleasesData", err);
    return null;
  }
});

/** Pro routu /data/manifest.json — týž manifest, strojově čitelný. */
export const getReleaseManifest = cache(async function getReleaseManifest(): Promise<ReleaseManifest | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    return (await readManifest(store)).manifest;
  } catch (err) {
    reportLoaderFailure("getReleaseManifest", err);
    return null;
  }
});

/** Pro routu /data/snapshot.json — payload + přesná velikost + název souboru. */
export async function getSnapshotDownload(): Promise<(SnapshotPayload & { filename: string }) | null> {
  try {
    const store = await getStore();
    if (!store) return null;
    const { manifest } = await readManifest(store);
    const snapshot = await readSnapshot(store, manifest);
    return { ...snapshotPayload(snapshot), filename: snapshotFilename(manifest.version) };
  } catch (err) {
    reportLoaderFailure("getSnapshotDownload", err);
    return null;
  }
}
