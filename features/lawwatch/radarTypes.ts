// Shared shape for the Kolizní radar (/zakony/kolize) — what getRadarData.ts
// composes over the collision and law loaders. Plain module (no server imports)
// so both the server loader and the "use client" ledger can import it; mirrors
// features/votetrack/themeTypes.ts.

import type { RadarDay, RadarEntry } from "./deriveRadar";

export interface RadarData {
  entries: RadarEntry[];
  days: RadarDay[];
  collisionCount: number;
  flagCount: number;
  /** Entries with no record-entry date (disclosed-ordering tier). */
  undatedCount: number;
  newestDetectedAt: string | null;
}
