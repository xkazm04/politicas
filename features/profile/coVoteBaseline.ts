// The reference an agreement rate is read against.
//
// A co-voting rate is ballot coincidence, and „high" only means something next to
// what is normal for this chamber. Replayed over the public PSP10 dumps
// (2026-10-10, intake apply co-voting-agreement-matrix): the median agreement
// between two members of ONE club is 99.6 %, between members of different clubs
// 43.1 %, and 87 % of the top-8 rows on the profile were the MP's own club. A
// „99.7 %" printed alone reads as a remarkable bond; beside „own club: median
// 99.6 %" it reads as what it is, a club member voting with the club.
//
// Pure: computed from the MP's own `co_votes_with` edges the loader already holds,
// over the WHOLE edge set (before `PROFILE_ALLY_ROWS`), so the top rows are never
// compared against themselves.

import type { CoVoter } from "./profileTypes";

export interface CoVoteBaselineSide {
  median: number; // 0–1
  pairs: number; // pairings the median is taken over
}

export interface CoVoteBaseline {
  /** Pairings with members of the MP's own club; null when there are none
   *  (unaffiliated, a one-member club, or an unknown club on either side). */
  ownClub: CoVoteBaselineSide | null;
  /** Pairings with members of every other club. */
  otherClubs: CoVoteBaselineSide | null;
}

const UNKNOWN_CLUB = "—";

function side(rates: number[]): CoVoteBaselineSide | null {
  if (rates.length === 0) return null;
  const s = [...rates].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return { median, pairs: s.length };
}

export function coVoteBaseline(all: readonly CoVoter[], ownClub: string | null): CoVoteBaseline {
  // An MP whose own club is unknown has no "own club" to compare with; every
  // pairing still counts toward nothing rather than being guessed into a side.
  if (!ownClub || ownClub === UNKNOWN_CLUB) return { ownClub: null, otherClubs: null };
  const own: number[] = [];
  const other: number[] = [];
  for (const cv of all) {
    if (!Number.isFinite(cv.agreement) || cv.clubAbbrev === UNKNOWN_CLUB) continue;
    (cv.clubAbbrev === ownClub ? own : other).push(cv.agreement);
  }
  return { ownClub: side(own), otherClubs: side(other) };
}
