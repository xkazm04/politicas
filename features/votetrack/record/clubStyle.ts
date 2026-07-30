// Display metadata for the REAL PSP10 chamber clubs. Colors are DATA, not
// decoration (docs/DESIGN.md §1 exception 3) — reused from the sanctioned party
// palette in lib/civic/data.ts via the same abbrev mapping getLeaderboardData
// uses; Motoristé (MS, no mock entry) and unknown clubs fall back to palette
// tokens. Used only for small chips/dots, never competing with `signal`.

import { PARTIES } from "@/lib/civic/data";
import { OCHRE, STEEL } from "@/features/landing/palette";

const CLUB_TO_PARTY_CODE: Record<string, string> = {
  ANO2011: "ano",
  ODS: "ods",
  STAN: "stan",
  "KDU-ČSL": "kdu",
  SPD: "spd",
  TOP09: "top",
  Piráti: "pir",
};

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
  const code = CLUB_TO_PARTY_CODE[abbrev];
  const p = code ? PARTIES.find((x) => x.code === code) : undefined;
  if (p) return { short: p.name.split(" ")[0], color: p.color };
  if (abbrev === "MS") return { short: "Motoristé", color: OCHRE };
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
