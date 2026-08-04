/*
 * THE PRE-CORRECTION FORMULA, DELIBERATELY FROZEN.
 *
 * This is the contribution index EXACTLY as it stood before the 2026-07-29
 * committee-dedupe correction: committee breadth over psp.cz membership ROWS (a body an
 * MP leads files as two rows, so chairing one committee could outrank sitting on two),
 * and stored rates rounded to ONE decimal.
 *
 * It exists for one purpose: `scripts/data-analysis/kg-contribution-recompute.ts` replays
 * it over the store's own rows and REFUSES to write unless it reproduces every stored
 * value first. If the replay disagrees, the store is not the one pass 11 scored and a
 * "correction" would be an unattributable rewrite.
 *
 * ── WHY THE LITERALS ARE NOT CONSTANTS ──────────────────────────────────────────────
 * `/ 4` (legislative saturation) and `/ 40` (speech saturation) are written out rather
 * than imported from LEGISLATIVE_SATURATION / SPEECH_SATURATION, and that is the whole
 * point: this function must keep reproducing the numbers pass 11 actually wrote. If a
 * future edit changes a saturation cap in the live formula, this replay must NOT follow
 * it — a moving proof gate proves nothing. `COMMITTEE_SATURATION` and
 * `CONTRIBUTION_WEIGHTS` are still imported because pass 11 used those exact values and
 * changing either is a formula change that must change CONTRIBUTION_FORMULA_REF and be
 * paired with its own recompute; the frozen literals below are the two that pass 11 read
 * from nowhere at all.
 *
 * DO NOT "modernize" this file. Its correctness is defined by 2026-07-29, not by today.
 */

import {
  COMMITTEE_SATURATION,
  CONTRIBUTION_WEIGHTS,
  isCommitteeSeat,
  isLeadership,
  type CommitteeSeat,
} from "./contribution";

/** Legislative saturation AS PASS 11 HAD IT. Frozen — see the module header. */
const LEGACY_LEGISLATIVE_SATURATION = 4;
/** Speech saturation AS PASS 11 HAD IT. Frozen — see the module header. */
const LEGACY_SPEECH_SATURATION = 40;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

export interface LegacyScoreInput {
  seats: CommitteeSeat[];
  /** RAW ratio, not the stored rounded one — pass 11 scored from the raw ratio. */
  participationRate: number;
  absenceRate: number;
  bills: number;
  interpellations: number;
  speechTurns: number;
}

export interface LegacyScoreResult {
  score: number;
  /** Membership ROWS, the pre-correction basis (the current formula counts BODIES). */
  committeeRows: number;
  leadershipRows: number;
  /** The rates AS PASS 11 PUBLISHED THEM — one decimal, not three. */
  participationRate: number;
  absenceRate: number;
}

/** Replay of the pre-correction formula. Pure; see the module header before editing. */
export function legacyScore(i: LegacyScoreInput): LegacyScoreResult {
  const committeeSeats = i.seats.filter(isCommitteeSeat);
  const committeeRows = committeeSeats.length;
  const leadershipRows = committeeSeats.filter(isLeadership).length;
  const committee = clamp01(committeeRows / COMMITTEE_SATURATION) * CONTRIBUTION_WEIGHTS.committee;
  const leadership = leadershipRows > 0 ? CONTRIBUTION_WEIGHTS.leadership : 0;
  const participation = i.participationRate * CONTRIBUTION_WEIGHTS.participation;
  const attendance = (1 - i.absenceRate) * CONTRIBUTION_WEIGHTS.attendance;
  const legislative = clamp01((i.bills + i.interpellations) / LEGACY_LEGISLATIVE_SATURATION) * CONTRIBUTION_WEIGHTS.legislative;
  const speech = clamp01(i.speechTurns / LEGACY_SPEECH_SATURATION) * CONTRIBUTION_WEIGHTS.speech;
  return {
    score: round1(committee + leadership + participation + attendance + legislative + speech),
    committeeRows,
    leadershipRows,
    participationRate: round1(i.participationRate),
    absenceRate: round1(i.absenceRate),
  };
}
