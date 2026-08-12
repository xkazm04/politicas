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
// This module turns that closed-vocabulary prop into an honest badge, with
// SYMMETRIC treatment of both flavours (same badge weight, same tone) per the
// case-loop guardrail that positive/neutral findings get equal surface.
//
// MESSAGE KEYS, NOT SENTENCES (2026-08-12). The two sentences used to be Czech
// literals here, and `WorkhorseBadge` concatenated them with a TRANSLATED claim
// („Vysoký podíl vlastní … na řečništi. Floor speeches: 12.") — one sentence in
// two languages for every English reader. The module stays pure and returns the
// KEY; the consumer calls `t(key)` on the `verdicts` namespace. This module also
// had NO language-gate pin of any kind; the Czech now sits in messages/cs.json,
// where the messages test binds it.
//
// Pure + defensive: an unknown or missing flavour renders nothing (graceful null).

export const WORKHORSE_FLAVOURS = ["legislative", "oversight"] as const;
export type WorkhorseFlavour = (typeof WORKHORSE_FLAVOURS)[number];

export function isWorkhorseFlavour(x: unknown): x is WorkhorseFlavour {
  return typeof x === "string" && (WORKHORSE_FLAVOURS as readonly string[]).includes(x);
}

export interface WorkhorseFlavourCopy {
  /** Message key of the short badge/filter label. */
  badgeKey: string;
  /** Message key of the one-sentence honest explanation. */
  detailKey: string;
}

const stem = (flavour: WorkhorseFlavour): string => flavour.charAt(0).toUpperCase() + flavour.slice(1);

/** Message key of a flavour's badge label, inside the `verdicts` namespace. */
export function workhorseBadgeKey(flavour: WorkhorseFlavour): string {
  return `workhorse${stem(flavour)}Badge`;
}

/** Message key of a flavour's explanation, inside the `verdicts` namespace. */
export function workhorseDetailKey(flavour: WorkhorseFlavour): string {
  return `workhorse${stem(flavour)}Detail`;
}

/** Every key this module can emit (the /overeni `*_COPY_KEYS` contract). */
export const WORKHORSE_COPY_KEYS: readonly string[] = WORKHORSE_FLAVOURS.flatMap((f) => [
  workhorseBadgeKey(f),
  workhorseDetailKey(f),
]);

/** Look up the badge copy for a stored `effort_workhorse_flavour` value; null when absent/unrecognized. */
export function workhorseFlavourCopy(flavour: unknown): WorkhorseFlavourCopy | null {
  if (!isWorkhorseFlavour(flavour)) return null;
  return { badgeKey: workhorseBadgeKey(flavour), detailKey: workhorseDetailKey(flavour) };
}
