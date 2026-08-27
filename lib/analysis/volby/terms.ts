// Term registry — the second factor of the finding doctrine (a choice is attributed
// to the body that could still be voted out for it). Nothing in the graph carried
// these dates: PSP terms are `term_code` strings without dates, and komunální /
// krajské terms existed only as prose in batch-012. This constant is the registry.
//
// Every window is OPEN (`to: null`): the bodies elected on these dates sit today.
// The next election closes a window by setting `to` and appending a new row.

import type { Ballot, TermWindow } from "./types";

export const TERM_WINDOWS: readonly TermWindow[] = [
  {
    ballot: "komunalni",
    from: "2022-10-01",
    to: null,
    label: "Komunální volby 23.–24. 9. 2022",
    source: "volby.cz — volby do zastupitelstev obcí 2022 (ustavující zasedání od 1. 10. 2022)",
  },
  {
    ballot: "krajske",
    from: "2024-10-12",
    to: null,
    label: "Krajské volby 20.–21. 9. 2024",
    source: "volby.cz — volby do zastupitelstev krajů 2024 (ustavující zasedání od 12. 10. 2024)",
  },
  {
    ballot: "snemovni",
    from: "2025-10-04",
    to: null,
    label: "Volby do Poslanecké sněmovny 3.–4. 10. 2025 (PSP10)",
    source: "volby.cz — volby do Poslanecké sněmovny 2025 (PS2025)",
  },
];

/** The window of one ballot; the registry is total over `Ballot`, so never undefined. */
export function termWindow(ballot: Ballot): TermWindow {
  const w = TERM_WINDOWS.find((t) => t.ballot === ballot);
  if (!w) throw new Error(`TERM_WINDOWS has no row for ballot "${ballot}"`);
  return w;
}

/**
 * Is an ISO date (YYYY-MM-DD, or a longer ISO stamp whose date prefix is compared)
 * inside the ballot's term window? `from` inclusive, `to` exclusive. A null/empty/
 * malformed date is NOT in the window — the caller counts it as undated, never
 * guesses.
 */
export function inTermWindow(ballot: Ballot, isoDate: string | null | undefined): boolean {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return false;
  const day = isoDate.slice(0, 10);
  const w = termWindow(ballot);
  if (day < w.from) return false;
  return w.to === null || day < w.to;
}
