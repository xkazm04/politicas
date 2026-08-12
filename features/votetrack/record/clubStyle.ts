// Display metadata for the REAL PSP10 chamber clubs. Colors are DATA, not
// decoration (docs/DESIGN.md §1 exception 3) — read from `CLUB_DISPLAY` in
// lib/civic/data.ts, the declared non-mock table for real registry clubs
// (getLeaderboardData reads the same one). This file used to keep its own
// copy of the abbrev→mock-party mapping AND truncate the display name with
// `name.split(" ")[0]`, so the hemicycle wedges and the discipline board
// rendered „TOP" and „ANO" — the exact defect 83cb8a9 removed from /zebricek.
// Used only for small chips/dots, never competing with `signal`.

import { CLUB_DISPLAY } from "@/lib/civic/data";
import { STEEL } from "@/features/landing/palette";

/** Editorial left-to-right seating of the hemicycle wedges — a DISCLOSED display
 * constant (the UI says so), not data. Clubs missing from this list append after
 * it; the unaffiliated bucket always renders last. */
export const WEDGE_ORDER = ["Piráti", "STAN", "KDU-ČSL", "TOP09", "ODS", "ANO2011", "MS", "SPD"] as const;

export interface ClubStyle {
  /** Short display name (chips, matrix rows). */
  short: string;
  /** Data color for the small identity dot. */
  color: string;
}

export function clubStyle(abbrev: string): ClubStyle {
  // The display FORM („ANO 2011", „TOP 09") is editorial typography over the
  // registry abbrev — never truncated back to its first token, and an unknown
  // abbrev renders as it arrived from the registry, never invented.
  const d = CLUB_DISPLAY[abbrev];
  if (d) return { short: d.name, color: d.color };
  return { short: abbrev, color: STEEL };
}

/** Stable wedge order for a set of clubs: the editorial seating first, then any
 * unlisted club by Czech collation. */
export function wedgeSort(clubs: readonly string[]): string[] {
  const rank = new Map<string, number>(WEDGE_ORDER.map((c, i) => [c, i]));
  return [...clubs].sort((a, b) => {
    const ra = rank.get(a) ?? WEDGE_ORDER.length;
    const rb = rank.get(b) ?? WEDGE_ORDER.length;
    return ra - rb || a.localeCompare(b, "cs");
  });
}
