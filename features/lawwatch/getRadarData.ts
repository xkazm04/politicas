// Server-only: the Kolizní radar loader (moonshot 4B). Composes the two
// existing, already-cached loaders — getCollisionData (Case-③ close-read
// payloads, per-payload `generatedAt` = record-entry date) and getLawData
// (Case-① flagged_conflict bills, honestly undated) — into the pure
// deriveRadar ledger. Zero new store reads, zero new artifacts: the radar is
// a VIEW over what the record already holds.
//
// Degrades honestly: either loader may be null (no store / no payloads); the
// radar then derives from whatever half exists, and only when BOTH are absent
// does it return null so the page can render the explicit empty state.

import "server-only";
import { cache } from "react";

import { deriveRadar, groupRadarDays, type RadarCollisionInput, type RadarDay, type RadarEntry, type RadarFlagInput } from "./deriveRadar";
import { getCollisionData } from "./getCollisionData";
import { getLawData } from "./getLawData";

export interface RadarData {
  entries: RadarEntry[];
  days: RadarDay[];
  collisionCount: number;
  flagCount: number;
  /** Entries with no record-entry date (disclosed-ordering tier). */
  undatedCount: number;
  newestDetectedAt: string | null;
}

async function loadRadarData(): Promise<RadarData | null> {
  const [collisionData, lawData] = await Promise.all([getCollisionData(), getLawData()]);
  if (!collisionData && !lawData) return null;

  const collisions: RadarCollisionInput[] = (collisionData?.clusters ?? []).flatMap((c) =>
    c.pairs.map((p) => ({
      pairId: p.pairId,
      billA: p.billA,
      billB: p.billB,
      lawRef: c.lawRef,
      lawTitle: c.lawTitle,
      clusterKey: c.key,
      sharedParagraph: p.sharedParagraph,
      classification: p.classification,
      detectedAt: p.detectedAt,
      sourceBatch: p.sourceBatch,
    })),
  );

  const flags: RadarFlagInput[] = (lawData?.bills ?? [])
    .filter((b) => b.flaggedConflict && b.cislo !== null)
    .map((b) => ({
      cislo: b.cislo!,
      title: b.title,
      sponsorMoneyCompanies: b.sponsorMoneyCompanies,
      sponsorContractCzk: b.sponsorContractCzk,
    }));

  const entries = deriveRadar({ collisions, flags });
  const dated = entries.filter((e) => e.detectedAt !== null);
  return {
    entries,
    days: groupRadarDays(entries),
    collisionCount: entries.filter((e) => e.kind === "kolize").length,
    flagCount: entries.filter((e) => e.kind === "priznak").length,
    undatedCount: entries.length - dated.length,
    newestDetectedAt: dated[0]?.detectedAt ?? null,
  };
}

/** cache(): the page and both feed routes may run in one request tree; PGlite's
 * single-connection contention makes an un-deduped second call likelier to lose
 * the race (same rationale as getLawData). */
export const getRadarData = cache(loadRadarData);
