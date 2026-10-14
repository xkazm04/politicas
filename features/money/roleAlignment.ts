/**
 * Role-window alignment: which contract money was signed INSIDE the period a tie was
 * registered for. One pure function so the window rule lives in exactly one place
 * (registry technique civic-intelligence/conflict-of-interest-detection/
 * temporal-alignment-of-money-and-role).
 *
 * Rules, each pinned in roleAlignment.test.ts:
 *  - a tie with NO registered start cannot be aligned: no window, no aligned money, and the
 *    tie is reported as `windowed: false` rather than as "everything before the end date";
 *  - boundaries are inclusive on both ends, compared at DAY precision (a timestamp on the
 *    last day of the role is still inside);
 *  - an open end ("ongoing") is bounded by the snapshot day, not by infinity;
 *  - a signature date that is not a plausible date (0002, 1970, 3062) is not evidence of
 *    simultaneity: it is counted as undated, never as aligned, never repaired.
 */

import { plausibleIsoDateOrNull } from "@/lib/analysis/plausible-date";

export interface RoleAlignment {
  /** False when the tie has no registered start: alignment could not be tested. */
  windowed: boolean;
  alignedCzk: number;
  alignedCount: number;
  /** Contracts whose signature date is missing or implausible; in the raw total, never the aligned one. */
  undatedCount: number;
}

export function alignContractsToRole(
  signed: readonly { signedOn: string | null; amount: number }[],
  from: string | null,
  to: string | null,
  todayIso: string,
): RoleAlignment {
  const out: RoleAlignment = { windowed: false, alignedCzk: 0, alignedCount: 0, undatedCount: 0 };
  if (!from) return out;
  out.windowed = true;
  const end = to ?? todayIso;
  for (const s of signed) {
    const day = plausibleIsoDateOrNull(s.signedOn, todayIso);
    if (!day) {
      out.undatedCount += 1;
      continue;
    }
    if (day >= from && day <= end) {
      out.alignedCzk += s.amount;
      out.alignedCount += 1;
    }
  }
  return out;
}
