// Contested-vote RECORD — deliberately NOT a finding. A vote's direction has no
// derivable valence, so the list page shows WHERE a list stood on the chamber's most
// contested votes and stops there (wave-2 Director decision). Pure arithmetic.

import type { RecordRow } from "./types";

/**
 * 1 − |yes − no| / (yes + no): 1 = a dead heat, 0 = unanimous. A vote with no
 * yes/no ballots at all is 0, not NaN — it was not contested, it was empty.
 */
export function contestedness(yes: number, no: number): number {
  const total = yes + no;
  if (total <= 0) return 0;
  return 1 - Math.abs(yes - no) / total;
}

export interface ListBallot {
  choice: "yes" | "no" | string;
}

/**
 * The list's line on a vote = the side holding a strict majority of its yes/no
 * ballots. Abstentions/absences are not a side; "split" when neither side passes
 * 50 % (a tie, or no yes/no ballots at all).
 */
export function listLine(ballots: readonly ListBallot[]): RecordRow["line"] {
  let yes = 0;
  let no = 0;
  for (const b of ballots) {
    if (b.choice === "yes") yes++;
    else if (b.choice === "no") no++;
  }
  const total = yes + no;
  if (total === 0) return "split";
  if (yes * 2 > total) return "yes";
  if (no * 2 > total) return "no";
  return "split";
}

export interface ContestableEvent {
  votePspId: number;
  title: string;
  votedOn: string;
  yes: number;
  no: number;
  voided: boolean;
}

/**
 * The `n` most contested non-voided events, contestedness desc; ties broken by
 * `votedOn` desc then `votePspId` asc so the record is stable across reads.
 */
/**
 * Positional ballots (yes + no) a roll call needs before it can rank as contested. A
 * 1:1 procedural vote is a dead heat by arithmetic and nothing by substance — measured
 * 2026-08-27, one such vote (2026-07-02) topped the term without this floor.
 */
export const MIN_POSITIONAL_BALLOTS = 100;

export function topContested(events: readonly ContestableEvent[], n: number): Omit<RecordRow, "line">[] {
  return events
    .filter((e) => !e.voided && e.yes + e.no >= MIN_POSITIONAL_BALLOTS)
    .map((e) => ({
      votePspId: e.votePspId,
      title: e.title,
      votedOn: e.votedOn,
      contestedness: contestedness(e.yes, e.no),
      yes: e.yes,
      no: e.no,
    }))
    .sort(
      (a, b) =>
        b.contestedness - a.contestedness || b.votedOn.localeCompare(a.votedOn) || a.votePspId - b.votePspId,
    )
    .slice(0, Math.max(0, n));
}
