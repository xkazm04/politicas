/*
 * DATOVÉ VERZE (batch-3 item 3D) — čistá derivace vydávacího manifestu.
 *
 * Datová vrstva se vydává jako software: každé úspěšné nasypání (ingest) je
 * kandidát na verzi `YYYY.MM.DD`, kardinalitní prahy (`CARDINALITY_FLOORS`)
 * jsou vydávací brána — verze pod prahem je DEGRADOVANÁ a nikdy se nestává
 * „latest". Tenhle modul je čistý (žádný server, žádné DB volání): dostane
 * posbírané statistiky a vrátí deterministický manifest + changelog.
 *
 * ── Pravidla (stejná disciplína jako features/dashboard/exhibit.ts) ────────
 * 1. DETERMINISMUS: tytéž statistiky ⇒ týž manifest ⇒ týž otisk. Vstupní pole
 *    se uvnitř normalizují (řazení podle klíče), takže otisk nezávisí na
 *    pořadí, v jakém loader řádky posbíral.
 * 2. OTISK JE PŘIZNANÝ: manifest nese algoritmus (FNV-1a/32, precedens
 *    Exponátu) i hodnotu; není to kryptografický podpis — kryptografii drží
 *    Merkle kořeny ingest běhů a hash-řetěz revizí (lib/db/pglite/ledger).
 * 3. VERZE JE TVRZENÍ: verze existuje jen tehdy, když existuje dokončený
 *    úspěšný ingest běh. Prázdný store nemá verzi — má čestné „nevydáno".
 */

import { canonicalJson, contentHash, HASH_ALGORITHM } from "@/features/dashboard/exhibit";
import { floorVerdicts, type FloorVerdict } from "@/lib/db/readiness";
import type { LedgerHeads } from "@/lib/db/pglite/repositories/ledger";
import type { IngestRunRow } from "@/lib/db/types";

export const MANIFEST_SCHEMA = "politicas.data-release/1";

// ── Vstup: statistiky posbírané loaderem (jen čtení, viz getDataReleasesData) ──

export interface ReleaseStats {
  /** kind → počet uzlů (plné počty, `Store.kgKindCounts()`). */
  kindCounts: ReadonlyArray<{ kind: string; count: number }>;
  /** rel → počet hran (`Store.countKgEdgesByRel()`). */
  edgeRelCounts: Readonly<Record<string, number>>;
  kgNodeTotal: number;
  kgEdgeTotal: number;
  voteBallotTotal: number;
  /** Ingest běhy (`Store.listIngestRuns`) — lineage + zdroj verze. */
  ingestRuns: ReadonlyArray<IngestRunRow>;
  /** Hlavy trezoru (`LedgerRepository.getLedgerHeads`), jen čtení. */
  ledgerHeads: LedgerHeads;
}

// ── Výstup: manifest ────────────────────────────────────────────────────────

export interface ReleaseManifest {
  schema: typeof MANIFEST_SCHEMA;
  /** `YYYY.MM.DD` dne posledního ÚSPĚŠNÉHO ingest běhu; null = nevydáno. */
  version: string | null;
  /** ISO okamžik dokončení běhu, který verzi řeže; null = nevydáno. */
  cutAt: string | null;
  /** true, když libovolný kardinalitní práh neprošel — verze není „latest". */
  degraded: boolean;
  verdicts: FloorVerdict[];
  counts: {
    kgNodes: number;
    kgEdges: number;
    voteBallots: number;
    /** Řazeno podle kind vzestupně (normalizace kvůli determinismu otisku). */
    kinds: Array<{ kind: string; count: number }>;
    /** Řazeno podle rel vzestupně. */
    edgeRels: Array<{ rel: string; count: number }>;
  };
  integrity: {
    reviewChain: LedgerHeads["reviewChain"];
    /** Zapečetěné běhy, řazeno runId sestupně (normalizace). */
    sealedRuns: LedgerHeads["sealedRuns"];
  };
  lineage: {
    runsTotal: number;
    okRuns: number;
    failedRuns: number;
    newestRun: { id: number; source: string; status: string; at: string } | null;
  };
  hashAlgorithm: typeof HASH_ALGORITHM;
  /** Otisk manifestu (FNV-1a/32 nad kanonickým JSON těla bez tohoto pole). */
  manifestHash: string;
}

/** Okamžik, který běh reprezentuje: dokončení, jinak start (běžící běh). */
const runAt = (r: IngestRunRow): string => r.finishedAt ?? r.startedAt;

/** `2026-07-30T…` → `2026.07.30`; null pro neparsovatelný vstup. */
export function versionFromIso(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

export function deriveReleaseManifest(stats: ReleaseStats): ReleaseManifest {
  // Verzi řeže nejnovější DOKONČENÝ úspěšný běh — selhané a běžící běhy verzi
  // nevydávají (vydání je tvrzení o úspěchu, ne o pokusu).
  const okRuns = stats.ingestRuns.filter((r) => r.status === "ok" && r.finishedAt !== null);
  const newestOk = okRuns.reduce<IngestRunRow | null>(
    (best, r) => (best === null || runAt(r) > runAt(best) || (runAt(r) === runAt(best) && r.id > best.id) ? r : best),
    null,
  );

  const verdicts = floorVerdicts(Object.fromEntries(stats.kindCounts.map((k) => [k.kind, k.count])));
  const newestRun = stats.ingestRuns.reduce<IngestRunRow | null>(
    (best, r) => (best === null || runAt(r) > runAt(best) || (runAt(r) === runAt(best) && r.id > best.id) ? r : best),
    null,
  );

  const body = {
    schema: MANIFEST_SCHEMA,
    version: newestOk?.finishedAt ? versionFromIso(newestOk.finishedAt) : null,
    cutAt: newestOk?.finishedAt ?? null,
    degraded: verdicts.some((v) => !v.ok),
    verdicts,
    counts: {
      kgNodes: stats.kgNodeTotal,
      kgEdges: stats.kgEdgeTotal,
      voteBallots: stats.voteBallotTotal,
      kinds: [...stats.kindCounts].sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0)),
      edgeRels: Object.entries(stats.edgeRelCounts)
        .map(([rel, count]) => ({ rel, count }))
        .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0)),
    },
    integrity: {
      reviewChain: stats.ledgerHeads.reviewChain,
      sealedRuns: [...stats.ledgerHeads.sealedRuns].sort((a, b) => b.runId - a.runId),
    },
    lineage: {
      runsTotal: stats.ingestRuns.length,
      okRuns: okRuns.length,
      failedRuns: stats.ingestRuns.filter((r) => r.status === "failed").length,
      newestRun: newestRun
        ? { id: newestRun.id, source: newestRun.source, status: newestRun.status, at: runAt(newestRun) }
        : null,
    },
    hashAlgorithm: HASH_ALGORITHM,
  } satisfies Omit<ReleaseManifest, "manifestHash">;

  return { ...body, manifestHash: contentHash(canonicalJson(body)) };
}

// ── Changelog: ingest běhy seskupené po dnech = řádky vydávacího vlaku ──────

export interface ChangelogRun {
  id: number;
  source: string;
  status: IngestRunRow["status"];
  rowsWritten: number;
  /** ISO okamžik běhu (dokončení, jinak start). */
  at: string;
  note: string | null;
}

export interface ChangelogRelease {
  /** `YYYY.MM.DD` dne. */
  version: string;
  /** `YYYY-MM-DD` (ISO den) — pro <time dateTime> a formátování. */
  date: string;
  runs: ChangelogRun[];
  rowsWritten: number;
  /** true, když každý běh dne skončil `ok` — jen takový den smí být „latest". */
  allOk: boolean;
}

/**
 * Seskupí ingest běhy po dnech (den = datum `finishedAt`, u nedokončených
 * `startedAt`) a seřadí: dny od nejnovějšího, uvnitř dne běhy od nejnovějšího
 * (shodný okamžik rozhoduje vyšší id). Deterministické pro týž vstup v
 * libovolném pořadí.
 */
export function deriveChangelog(runs: ReadonlyArray<IngestRunRow>): ChangelogRelease[] {
  const byDay = new Map<string, ChangelogRun[]>();
  for (const r of runs) {
    const at = runAt(r);
    const day = at.slice(0, 10);
    const entry: ChangelogRun = {
      id: r.id,
      source: r.source,
      status: r.status,
      rowsWritten: r.rowsWritten,
      at,
      note: r.note,
    };
    const bucket = byDay.get(day);
    if (bucket) bucket.push(entry);
    else byDay.set(day, [entry]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, dayRuns]) => {
      const ordered = [...dayRuns].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id));
      return {
        version: versionFromIso(date) ?? date,
        date,
        runs: ordered,
        rowsWritten: ordered.reduce((n, r) => n + r.rowsWritten, 0),
        allOk: ordered.every((r) => r.status === "ok"),
      };
    });
}
