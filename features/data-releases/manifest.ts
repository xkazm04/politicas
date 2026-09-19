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
  /**
   * Nejnovější verdikt sentinela NAD TÍMTO OTISKEM manifestu, nebo null.
   *
   * Loader ho posílá jako FUNKCI otisku: manifest se derivuje nejdřív, jeho
   * otisk se použije jako klíč a teprve pak se doplní certifikace — proto je
   * to vstup, a ne něco, co by si tenhle čistý modul někde přečetl.
   */
  certification?: SentinelCertification | null;
}

/**
 * Co o vydání říká sentinel — a čtvrtý stav je celý smysl.
 *
 * Do 2026-09-04 tiskl `/data` „latest" z kardinalitních prahů, a nic na světě
 * neříkalo, jestli nad tím vydáním kdy nějaká invarianta proběhla. Prahy jednou
 * certifikovaly 0,98 % korpusu smluv jako „latest" na celé týdny.
 *
 *  · `ok` / `violation` / `unevaluable` — sentinel nad TÍMHLE otiskem běžel a
 *    tohle vrátil (`unevaluable` = nedosáhl na data; není to průchod).
 *  · `none` — sentinel nad tímhle otiskem NEBĚŽEL. Není to chyba vydání a
 *    nesmí se číst jako průchod; je to nepřítomnost auditu, vytištěná.
 */
export type ReleaseCertification = "ok" | "violation" | "unevaluable" | "none";

export interface SentinelCertification {
  /** ISO okamžik běhu. */
  ranAt: string;
  verdict: Exclude<ReleaseCertification, "none">;
  /** Kolik invariant PLATILO / kolik jich report nesl; null, když se nedaly přečíst. */
  checksHeld: number | null;
  checksTotal: number | null;
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
  /**
   * Verdikt sentinela nad TÍMTO otiskem — `none`, když nad ním neběžel.
   *
   * MIMO OTISK, ZÁMĚRNĚ: otisk je funkce OBSAHU vydání, ne toho, co o něm kdo
   * později zjistil. Kdyby certifikace do otisku vstupovala, sentinelův zápis
   * by otisk změnil a verdikt by se okamžitě přestal vztahovat k vydání, které
   * hodnotil — spojení je vždycky na PŘESNOU shodu, nikdy na nejbližší běh.
   */
  certification: ReleaseCertification;
  /** Detail verdiktu (datum, kolik invariant platilo); null u `none`. */
  certifiedBy: SentinelCertification | null;
}

/** Okamžik, který běh reprezentuje: dokončení, jinak start (běžící běh). */
const runAt = (r: IngestRunRow): string => r.finishedAt ?? r.startedAt;

/** Nejnovější běh: nejpozdější okamžik, při shodě vyšší id; prázdný vstup → null.
 *  JEDNO pravidlo pro řez verze i pro řádek lineage — do 2026-09-08 tu stály
 *  dvě totožné redukce a jedna by se změnila bez druhé. */
export function newestRun(runs: ReadonlyArray<IngestRunRow>): IngestRunRow | null {
  return runs.reduce<IngestRunRow | null>(
    (best, r) => (best === null || runAt(r) > runAt(best) || (runAt(r) === runAt(best) && r.id > best.id) ? r : best),
    null,
  );
}

/** `2026-07-30T…` → `2026.07.30`; null pro neparsovatelný vstup. */
export function versionFromIso(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

export function deriveReleaseManifest(stats: ReleaseStats): ReleaseManifest {
  // Verzi řeže nejnovější DOKONČENÝ úspěšný běh — selhané a běžící běhy verzi
  // nevydávají (vydání je tvrzení o úspěchu, ne o pokusu).
  const okRuns = stats.ingestRuns.filter((r) => r.status === "ok" && r.finishedAt !== null);
  const newestOk = newestRun(okRuns);

  const verdicts = floorVerdicts(Object.fromEntries(stats.kindCounts.map((k) => [k.kind, k.count])));
  const newest = newestRun(stats.ingestRuns);

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
      newestRun: newest
        ? { id: newest.id, source: newest.source, status: newest.status, at: runAt(newest) }
        : null,
    },
    hashAlgorithm: HASH_ALGORITHM,
    // `certification`/`certifiedBy` jsou VĚDOMĚ mimo tělo, ze kterého se počítá
    // otisk — jsou to fakta o vydání zvenčí, ne jeho obsah.
  } satisfies Omit<ReleaseManifest, "manifestHash" | "certification" | "certifiedBy">;

  const manifestHash = contentHash(canonicalJson(body));
  // Certifikace se dopočítá AŽ TEĎ, nad hotovým otiskem, a do otisku nevstupuje
  // (viz komentář u pole). Ověřuje se, že verdikt patří TOMUHLE vydání: loader
  // čte řádek `sentinel_run` na PŘESNOU shodu otisku, takže „žádný takový běh"
  // se vrátí jako `none` a ne jako nejbližší cizí verdikt.
  const cert = stats.certification ?? null;
  return {
    ...body,
    manifestHash,
    certification: cert?.verdict ?? "none",
    certifiedBy: cert,
  };
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
