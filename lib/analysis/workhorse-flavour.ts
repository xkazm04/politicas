// Quiet-workhorse FLAVOUR labels — Case ② build phase (batch 003, O-effort-3).
//
// The triage lens (scripts/case-loops/effort/triage.ts) has classified "quiet
// workhorse" MPs (high committee/legislative work, low floor-speech visibility —
// P31, the positive-symmetry finding: the platform must surface honest good news
// as readily as it surfaces conflicts) into two flavours since batch 002:
//   legislative-authorship  — the work shows up as bills co-/first-signed
//   oversight-institutional — the work shows up as committee/delegation seats
//                              without personal bill authorship (scrutiny, not drafting)
// Batch 001/002 persisted a bare `effort_workhorse: true` boolean with no flavour;
// batch 003 backfills `effort_workhorse_flavour` deterministically (no LLM — see
// scripts/case-loops/effort/workhorse-flavour.ts) for every currently-flagged MP.
// This module turns that closed-vocabulary prop into an honest Czech label, with
// SYMMETRIC treatment of both flavours (same badge weight, same tone) per the
// case-loop guardrail that positive/neutral findings get equal surface.
//
// Pure + defensive: an unknown or missing flavour renders nothing (graceful null).

export const WORKHORSE_FLAVOURS = ["legislative", "oversight"] as const;
export type WorkhorseFlavour = (typeof WORKHORSE_FLAVOURS)[number];

export function isWorkhorseFlavour(x: unknown): x is WorkhorseFlavour {
  return typeof x === "string" && (WORKHORSE_FLAVOURS as readonly string[]).includes(x);
}

export interface WorkhorseFlavourCopy {
  /** Short badge/filter label. */
  badge: string;
  /** One-sentence honest explanation. */
  detail: string;
}

const COPY: Record<WorkhorseFlavour, WorkhorseFlavourCopy> = {
  legislative: {
    badge: "Tichý tvůrce zákonů",
    detail: "Vysoký podíl vlastní nebo spolupodepsané legislativy a výborové práce, ale málo vystoupení v sále — práce vidět v tiscích, ne na řečništi.",
  },
  oversight: {
    badge: "Tichý kontrolor",
    detail: "Práce spočívá v dozoru a výborové agendě (vedení výborů, delegace, komise) bez vlastní legislativní iniciativy a bez vystoupení v sále.",
  },
};

/** Look up the badge copy for a stored `effort_workhorse_flavour` value; null when absent/unrecognized. */
export function workhorseFlavourCopy(flavour: unknown): WorkhorseFlavourCopy | null {
  return isWorkhorseFlavour(flavour) ? COPY[flavour] : null;
}
