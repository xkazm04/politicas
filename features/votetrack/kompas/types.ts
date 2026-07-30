// Serializable shapes of the Volební kompas naruby (moonshot 5B) — what
// getKompas() hands the /kompas client tree. Everything here is derived
// deterministically from the REAL PSP10 ledger (vote_event + vote_ballot +
// vote_tag): the question set by the disclosed selection rule (select.ts), the
// alignment numbers by the disclosed scoring rule (score.ts). No question text
// is authored: cards carry the roll call's own title and its real chamber
// tallies, nothing else.

import type { ClubTally } from "../record/types";

/** One curated question — a REAL roll call, described only by its own metadata. */
export interface KompasQuestion {
  votePspId: number;
  /** The roll call's own title (titleLong ?? titleShort ?? titleNorm). */
  title: string;
  /** Theme slug from the Silver vote_tag layer (themeLabels.ts renders it). */
  theme: string;
  votedOn: string | null;
  sessionNo: number | null;
  voteNo: number | null;
  outcome: string; // "accepted" | "rejected" | …
  /** Real chamber tallies of the vote (all 200 ballots, bucketed). */
  total: ClubTally;
  /** |yes − no| / (yes + no), 3dp — the closeness that selected the vote. */
  margin: number;
  /** Provenance URL of the ingested bytes (opendata archive). */
  sourceUrl: string;
}

export interface KompasMp {
  personPspId: number;
  name: string;
  /** Club abbrev; null = nezařazení (rendered, never club-scored). */
  club: string | null;
}

/** Compact positional record: ballots[votePspId][personPspId] = bucket.
 * "away" (nepřihlášen/omluven) is OMITTED — absence is the default. */
export type KompasBallots = Record<number, Record<number, "yes" | "no" | "k">>;

/** Club line per question (strict-majority rule from record/derive.ts);
 * only clubs with a line appear. */
export type KompasClubLines = Record<number, Record<string, "yes" | "no">>;

export interface KompasData {
  /** Selection-rule order (see select.ts) — the render order of the cards. */
  questions: KompasQuestion[];
  /** All MPs with at least one ballot on a selected vote, sorted by Czech name. */
  mps: KompasMp[];
  ballots: KompasBallots;
  clubLines: KompasClubLines;
  coverage: {
    /** Valid (non-voided) roll calls in the ledger. */
    valid: number;
    /** Of those, carrying a Silver-layer theme tag. */
    tagged: number;
    /** Candidates that passed the selection-rule floors. */
    candidates: number;
    from: string | null;
    to: string | null;
  };
}
