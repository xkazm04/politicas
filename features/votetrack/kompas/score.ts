// Deterministic alignment scoring for the Volební kompas naruby — the
// DISCLOSED rule, rendered verbatim in the UI (copy.ts scoringRule).
//
// The rule (per MP, over the questions the reader answered):
//   • SROVNATELNÉ hlasování = the MP cast a positional ballot (pro/proti) on
//     that vote. Shoda = the MP's position equals the reader's.
//   • Alignment = shody / srovnatelná, 3dp. The K bucket (zdržel se /
//     nehlasoval — merged by the Chamber since 90/1995 Sb.) is
//     NON-POSITIONAL: it never counts as agreement NOR disagreement, and it
//     never enters the denominator. Absence (nepřihlášen/omluven) likewise.
//     Both are shown as counts so nothing hides.
//   • An MP RANKS only with positional ballots on at least half of the
//     answered questions (ceil(answered / 2)) — below that the sample is too
//     thin to order and the MP moves to the "nesrovnatelné" tail, alignment
//     still shown where computable.
//   • Order: rankable first; alignment desc; more comparable votes first;
//     Czech collation of the name (meaningless tiebreak, the UI says so).
//
// Clubs score the same way against the club LINE (strict majority of the
// club's positional ballots — record/derive.ts lineOf; a tied club has no
// line on that vote and the vote is not comparable for it).
//
// Pure + fixture-tested in score.test.ts.

import type { KompasBallots, KompasClubLines, KompasMp, KompasQuestion } from "./types";

/** The reader's stance on one question. Skipped questions are simply absent. */
export type Answer = "pro" | "proti";

/** Below this many answers no result renders at all (the UI asks for more). */
export const MIN_ANSWERS = 3;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

const stanceBucket = (a: Answer): "yes" | "no" => (a === "pro" ? "yes" : "no");

export interface MpAlignment {
  personPspId: number;
  name: string;
  club: string | null;
  /** Answered questions where the MP voted pro/proti. */
  comparable: number;
  /** Of those, votes matching the reader's stance. */
  matches: number;
  /** Answered questions where the MP was in the K bucket. */
  kCount: number;
  /** Answered questions where the MP was absent. */
  awayCount: number;
  /** matches / comparable, 3dp; null when comparable = 0. */
  rate: number | null;
  /** comparable ≥ ceil(answered / 2) — eligible for the ranked board. */
  rankable: boolean;
}

export interface ClubAlignment {
  club: string;
  /** Answered questions where the club had a line. */
  comparable: number;
  matches: number;
  rate: number | null;
  rankable: boolean;
}

export interface AlignmentResult {
  /** Answers that reference a question in the current set (foreign ids ignored). */
  answered: number;
  mps: MpAlignment[];
  clubs: ClubAlignment[];
}

export function scoreAlignment(
  questions: readonly KompasQuestion[],
  mps: readonly KompasMp[],
  ballots: KompasBallots,
  clubLines: KompasClubLines,
  answers: ReadonlyMap<number, Answer>,
): AlignmentResult {
  const inSet = new Map<number, Answer>();
  const questionIds = new Set(questions.map((q) => q.votePspId));
  for (const [voteId, answer] of answers) {
    if (questionIds.has(voteId)) inSet.set(voteId, answer);
  }
  const answered = inSet.size;
  const minComparable = Math.ceil(answered / 2);

  /* MPs */
  const mpRows: MpAlignment[] = mps.map((mp) => {
    let comparable = 0;
    let matches = 0;
    let kCount = 0;
    let awayCount = 0;
    for (const [voteId, answer] of inSet) {
      const bucket = ballots[voteId]?.[mp.personPspId] ?? "away";
      if (bucket === "yes" || bucket === "no") {
        comparable++;
        if (bucket === stanceBucket(answer)) matches++;
      } else if (bucket === "k") kCount++;
      else awayCount++;
    }
    return {
      personPspId: mp.personPspId,
      name: mp.name,
      club: mp.club,
      comparable,
      matches,
      kCount,
      awayCount,
      rate: comparable > 0 ? round3(matches / comparable) : null,
      rankable: answered > 0 && comparable >= minComparable,
    };
  });
  mpRows.sort(
    (a, b) =>
      Number(b.rankable) - Number(a.rankable) ||
      (b.rate ?? -1) - (a.rate ?? -1) ||
      b.comparable - a.comparable ||
      a.name.localeCompare(b.name, "cs") ||
      a.personPspId - b.personPspId,
  );

  /* Clubs */
  const clubNames = new Set<string>();
  for (const mp of mps) if (mp.club !== null) clubNames.add(mp.club);
  const clubRows: ClubAlignment[] = [...clubNames].map((club) => {
    let comparable = 0;
    let matches = 0;
    for (const [voteId, answer] of inSet) {
      const line = clubLines[voteId]?.[club];
      if (line === undefined) continue;
      comparable++;
      if (line === stanceBucket(answer)) matches++;
    }
    return {
      club,
      comparable,
      matches,
      rate: comparable > 0 ? round3(matches / comparable) : null,
      rankable: answered > 0 && comparable >= minComparable,
    };
  });
  clubRows.sort(
    (a, b) =>
      Number(b.rankable) - Number(a.rankable) ||
      (b.rate ?? -1) - (a.rate ?? -1) ||
      b.comparable - a.comparable ||
      a.club.localeCompare(b.club, "cs"),
  );

  return { answered, mps: mpRows, clubs: clubRows };
}
