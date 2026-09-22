/**
 * Which club was an MP in ON THE DAY OF THE VOTE.
 *
 * Every club line, rebellion rate and cohesion index in the repo was computed
 * against ONE club per mandate for the whole term, chosen by row order from an
 * undated join (`clubByMandate`, `lib/db/pglite/repositories/graph.ts`). An MP who
 * changed club had every historical ballot repainted with whichever club the dump
 * happened to return last — the same „current-party column" failure `/zakony` fixed
 * for committee dates on 2026-08-13, when „the committee date stopped being decided
 * by dump ROW ORDER".
 *
 * This module is the dated replacement, and it is deliberately pure: it decides
 * nothing about scoring, only about which club a day belongs to.
 *
 * FOUR CASES, AND WHY NONE OF THEM IS „PICK SOMETHING":
 *   in a window        → that club.
 *   open `toAt`        → current; the repo already trusts the open-ended membership
 *                        as the „currently sits" signal (memory/current-mandate-holder-signal).
 *   no window covers   → `outside_window`. NOT „unaffiliated" — an MP between clubs
 *                        and an MP who never joined one are different facts, and
 *                        folding the first into the second scores a ballot against a
 *                        club line that did not apply to its caster.
 *   two windows cover  → `ambiguous`. REFUSED, never broken by order. Overlapping
 *                        club windows mean the source disagrees with itself; picking
 *                        the first is how the undated join failed in the first place.
 * A caller must be able to tell the last three apart, so the result is a tagged
 * verdict rather than `string | null`.
 */

import type { ClubWindow } from "@/lib/db/store";

export type ClubAtVote =
  | { kind: "in_club"; club: string }
  /** The mandate has club windows, but none contains this day. */
  | { kind: "outside_window" }
  /** The mandate has no club window at all — a genuinely unaffiliated MP. */
  | { kind: "no_window" }
  /** Two or more windows contain this day. The source contradicts itself. */
  | { kind: "ambiguous"; clubs: string[] };

/** Inclusive on both ends: a membership that starts on the day of a vote covers it,
 *  and so does one that ends on it — the register dates a membership by its last
 *  day, not by the day after. `null` fromAt = open at the start of the term. */
function covers(w: ClubWindow, isoDay: string): boolean {
  if (w.fromAt != null && isoDay < w.fromAt.slice(0, 10)) return false;
  if (w.toAt != null && isoDay > w.toAt.slice(0, 10)) return false;
  return true;
}

/**
 * The club a mandate belonged to on `isoDay` (a `YYYY-MM-DD` date).
 *
 * `windows` is one mandate's windows, as `store.clubWindowsByMandate()` returns
 * them. A day that is not a well-formed ISO date is treated as unknowable rather
 * than matched against string comparisons that would silently misorder.
 */
export function clubAt(windows: readonly ClubWindow[] | undefined, isoDay: string | null | undefined): ClubAtVote {
  if (!windows || windows.length === 0) return { kind: "no_window" };
  if (!isoDay || !/^\d{4}-\d{2}-\d{2}/.test(isoDay)) return { kind: "outside_window" };
  const day = isoDay.slice(0, 10);
  const hits = windows.filter((w) => covers(w, day));
  if (hits.length === 0) return { kind: "outside_window" };
  const clubs = [...new Set(hits.map((h) => h.club))];
  // Two windows for the SAME club (the register splits a membership across rows)
  // is not a contradiction — it is one continuous affiliation.
  if (clubs.length > 1) return { kind: "ambiguous", clubs: clubs.sort() };
  return { kind: "in_club", club: clubs[0] };
}

/** The club name when there is exactly one, else null. For call sites that only
 *  need the name — the coverage bucket they owe is decided from `clubAt` itself. */
export function clubNameAt(windows: readonly ClubWindow[] | undefined, isoDay: string | null | undefined): string | null {
  const at = clubAt(windows, isoDay);
  return at.kind === "in_club" ? at.club : null;
}

/** How many mandates have more than one DISTINCT club across the term — the
 *  population for which a dated read differs from the undated one at all. */
export function mandatesWithMultipleClubs(byMandate: ReadonlyMap<number, ClubWindow[]>): number {
  let n = 0;
  for (const windows of byMandate.values()) {
    if (new Set(windows.map((w) => w.club)).size > 1) n++;
  }
  return n;
}
