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
  /**
   * Leží tohle hlasování v okně deníku na /hlasovani (prvních `LEDGER_WINDOW`
   * platných hlasování od nejnovějšího)?
   *
   * Kompas vybírá otázky podle TĚSNOSTI přes celé období, deník vypisuje jen
   * nejnovější okno — takže většina otázek do okna nespadá a odkaz na kotvu
   * `#h-…` by u nich tiše nedělal nic (components/useVoteAnchor.ts se pro id
   * mimo okno prostě vrátí). Tenhle příznak je tentýž, kterým si spis poslance
   * (features/profile/rebellionRecord.ts) rozhoduje `appHref`.
   */
  inLedger: boolean;
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
    /** Tagged roll calls excluded because their theme is on `EXCLUDED_THEMES`
     *  (Procedura / Jiné) — a published rule whose casualties were, until
     *  2026-08-11, dropped without a number. */
    droppedByTheme: number;
    /** Tagged, non-excluded roll calls the record holds no ballot for: their
     *  participation could not be measured at all. Kept apart from
     *  `droppedByPositional` — the floor did not judge them. */
    withoutBallots: number;
    /** Would-be candidates below the participation floor (select.ts
     *  `MIN_POSITIONAL`) — the second floor that used to drop rows silently. */
    droppedByPositional: number;
    /** Would-be candidates dropped by the tag-confidence floor (select.ts
     *  `MIN_TAG_CONFIDENCE`) — a stated loss, never a silent one. */
    droppedByConfidence: number;
    /** Candidates whose tag carries no confidence at all: kept, and counted so the
     *  reader can see where the floor decided nothing. */
    withoutConfidence: number;
    /** How many newest roll calls the /hlasovani ledger lists (record/derive.ts
     *  `LEDGER_WINDOW`) — the window `KompasQuestion.inLedger` is measured against,
     *  named on the surface so the reader knows what „outside the ledger" means. */
    ledgerWindow: number;
    from: string | null;
    to: string | null;
  };
}
