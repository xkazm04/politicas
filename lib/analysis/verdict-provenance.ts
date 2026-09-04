/*
 * THE RUNG A VERDICT STANDS ON — pure, no I/O, no store, no React.
 *
 * The effort loop writes claims about NAMED PEOPLE onto person nodes:
 * „this MP is a workhorse", „this MP's low score has a structural reason",
 * „this MP carried N rapporteur assignments". Until 2026-09-04 those rendered on
 * /zebricek rows and /poslanec with a DATE and nothing else — a reader could not
 * tell a model's inference from a checked fact, and the ladder of assertion was
 * flattened at exactly the point where it costs a person something.
 *
 * This module is the single place that answers „which rung?" for one verdict, so
 * the two loaders, the three badges and the sentinel cannot drift apart.
 *
 * ── The four rungs, and why `machine` is not `pending` ────────────────────────
 *   machine   the pipeline said it; nobody has looked. THE DEFAULT.
 *   pending   a human looked and sent it BACK (`needs-more`) — a different fact
 *             from „nobody looked", and the reader is owed the difference.
 *   verified  a human confirmed it, and we know who and when.
 *   rejected  a human refused it. The claim is WITHHELD — see below.
 *
 * ── Rejected withholds; it never blanks ──────────────────────────────────────
 * A rejected workhorse badge must not vanish, because a vanished badge reads as
 * „this MP is not a workhorse" — a second claim, made silently, that nobody
 * decided. `withholds` says: do not render the claim, DO render that a verdict
 * was refused. The honest empty state is disclosed, never empty.
 *
 * ── What this module refuses to do ───────────────────────────────────────────
 * It never invents a rung. A prop the loop wrote before the rung existed carries
 * no entry, and `readVerdictRung` returns `null` for it: „nothing recorded here",
 * which the surface states as such. Defaulting that to `machine` would be a
 * guess about provenance, printed as provenance.
 */

/**
 * The effort verdict props that take the door. CLOSED: a new one has to be
 * added here, which is also where the reviewer queue and the sentinel find it.
 * Prose fields (`effort_notes`, `effort_bill_focus`, `effort_public_role`) are
 * NOT here — they ride the public-copy guard and are carried over.
 */
export const EFFORT_VERDICT_FIELDS = [
  "effort_low_score_reason",
  "effort_rapporteur_load",
  "effort_workhorse",
] as const;

export type EffortVerdictField = (typeof EFFORT_VERDICT_FIELDS)[number];

export function isEffortVerdictField(v: unknown): v is EffortVerdictField {
  return typeof v === "string" && (EFFORT_VERDICT_FIELDS as readonly string[]).includes(v);
}

export type VerdictRung = "machine" | "pending" | "verified" | "rejected";

/** What a surface needs to render one verdict's rung. Never partially filled. */
export interface VerdictProvenanceValue {
  rung: VerdictRung;
  /** Who decided — null on `machine` by construction (no human was involved). */
  decidedBy: string | null;
  /** ISO instant of the decision, null when undated or machine. */
  decidedAt: string | null;
  /** True only for `rejected`: render the refusal, not the claim. */
  withholds: boolean;
}

/**
 * The store's `review_state` vocabulary → the rung vocabulary. The writer
 * (`ReviewRepository.setReviewState`) speaks `verified | rejected |
 * pending_review`; the enrichment loop speaks `machine`. Anything else stored is
 * NOT coerced into a rung — it returns null and the surface says nothing was
 * recorded, because a value this module does not recognise is not a value it
 * gets to interpret.
 */
function rungFromState(state: string): VerdictRung | null {
  switch (state) {
    case "machine":
      return "machine";
    case "pending_review":
    case "pending":
      return "pending";
    case "verified":
      return "verified";
    case "rejected":
      return "rejected";
    default:
      return null;
  }
}

/** The one path into the stored shape: `effort_provenance.verdicts[field]`. */
function verdictEntry(props: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const prov = props.effort_provenance;
  if (!prov || typeof prov !== "object" || Array.isArray(prov)) return null;
  const verdicts = (prov as { verdicts?: unknown }).verdicts;
  if (!verdicts || typeof verdicts !== "object" || Array.isArray(verdicts)) return null;
  const entry = (verdicts as Record<string, unknown>)[field];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  return entry as Record<string, unknown>;
}

/** The raw stored state string, or null. Used by the writer and the sentinel. */
export function effortVerdictState(props: Record<string, unknown>, field: string): string | null {
  const entry = verdictEntry(props, field);
  const state = entry?.review_state;
  return typeof state === "string" ? state : null;
}

/** Who decided and when — null unless a human went through the door. */
export function effortVerdictDecider(
  props: Record<string, unknown>,
  field: string,
): { by: string; at: string | null } | null {
  const entry = verdictEntry(props, field);
  const by = entry?.decided_by;
  if (typeof by !== "string" || by.length === 0) return null;
  const at = entry?.decided_at;
  return { by, at: typeof at === "string" && at.length > 0 ? at : null };
}

/**
 * The rung one verdict stands on, or `null` when nothing was recorded for it.
 *
 * `null` is a real answer, not a failure: it means this prop predates the rung
 * or the loop did not stamp it, and the surface must say so rather than assume
 * the most flattering (or the most damning) reading.
 */
export function readVerdictRung(
  props: Record<string, unknown>,
  field: string,
): VerdictProvenanceValue | null {
  const state = effortVerdictState(props, field);
  if (state === null) return null;
  const rung = rungFromState(state);
  if (rung === null) return null;
  const decider = effortVerdictDecider(props, field);
  return {
    rung,
    // A `machine` rung can never name a decider: no human was involved, and a
    // stale `decided_by` left behind by an earlier decision must not be shown
    // beside „strojově odvozeno". The writer cannot produce that combination —
    // this is the reader refusing to render it if the data ever does.
    decidedBy: rung === "machine" ? null : (decider?.by ?? null),
    decidedAt: rung === "machine" ? null : (decider?.at ?? null),
    withholds: rung === "rejected",
  };
}

/**
 * The message key for a rung, under `shared.verdict.*`. A function rather than a
 * map literal so the compiler proves every rung has copy — adding a rung without
 * copy stops being a runtime blank.
 */
export function rungKey(rung: VerdictRung): string {
  switch (rung) {
    case "machine":
      return "shared.verdict.machine";
    case "pending":
      return "shared.verdict.pending";
    case "verified":
      return "shared.verdict.verified";
    case "rejected":
      return "shared.verdict.rejected";
  }
}

/**
 * How many of a population carry a rung at all — the denominator behind
 * „N of 207 verdicts are gated". Returned as counts, never as a rate: a rate
 * without its denominator is the exact shape this project refuses to print.
 */
export interface VerdictRungTally {
  total: number;
  unrecorded: number;
  machine: number;
  pending: number;
  verified: number;
  rejected: number;
}

export function tallyVerdictRungs(
  nodes: readonly Record<string, unknown>[],
  field: string,
): VerdictRungTally {
  const tally: VerdictRungTally = {
    total: 0,
    unrecorded: 0,
    machine: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
  };
  for (const props of nodes) {
    // Only nodes that actually CARRY the claim are in the denominator. An MP with
    // no workhorse verdict is not an ungated workhorse verdict.
    if (props[field] === undefined || props[field] === null) continue;
    tally.total++;
    const v = readVerdictRung(props, field);
    if (v === null) tally.unrecorded++;
    else tally[v.rung]++;
  }
  return tally;
}
