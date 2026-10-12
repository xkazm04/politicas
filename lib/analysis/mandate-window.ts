// Per-mandate rate denominators — Q-effort-5 (P38), first step.
//
// The contribution writers divide every MP's present ballots by ALL roll calls of
// the term, and every MP's excused days by ALL sitting days of the term
// (`kg-contribution-ingest.ts`, "Participation + attendance denominators
// (term-level)"). For the 193 MPs seated from election day to now those are the
// right numbers. For a mandate that opened late or closed early they are not, and
// the error runs in OPPOSITE directions in the two rates: participation is
// depressed (ballots from a short window over a full-term count), attendance is
// inflated (excuses from a short window over a full-term count of days).
// Replayed on the public PSP10 dumps of 2026-10-10: 0 of 193 full-term mandates
// move under the per-mandate denominators below; 10 short mandates do — one
// replacement casting a position at 97,4 % of the roll calls he could attend was
// ranked 6th lowest of 207 on participation.
//
// The opportunity set is the PUBLISHER's, not a date window. psp.cz writes one
// hl_poslanec row per (mandate, roll call) the mandate could attend — '@' (not
// logged in) included — so the count of a mandate's rows over the active roll
// calls IS its eligible roll calls. A date window from `membership.fromAt` would
// be wrong exactly where tenure.ts warns: fromAt is the day the mandate AROSE,
// not the oath, and the March 2026 replacement's rows start 143 roll calls later.
//
// A mandate with no ballot rows gets NO entry — "no opportunity" is not a zero
// (missing-is-not-zero); the caller decides what an absent denominator means.
//
// Pure + defensive, no store access. Not yet wired into the writers: doing that
// changes the formula, so it lands with a CONTRIBUTION_FORMULA_REF bump and a
// writer run (plan: .ai/tasks/2026-10-10-mandate-window-denominators.md).

export interface MandateWindow {
  /** ISO day the chamber membership opened, or null when unknown. */
  from: string | null;
  /** ISO day it closed; null = still open. */
  to: string | null;
}

export interface MandateWindowInputs {
  /** Active roll calls of the term (not voided, not manual): roll-call id -> ISO day. */
  rollCalls: ReadonlyMap<number, string>;
  /** Publisher ballot rows, one per (mandate, roll call) the mandate could attend. */
  ballots: Iterable<{ mandatePspId: number; votePspId: number }>;
  /** Chamber-membership window per mandate, used to bound its excused days. */
  windows: ReadonlyMap<number, MandateWindow>;
  /** Excused days per mandate (ISO days), as the excuse table filed them. */
  excusedDays: ReadonlyMap<number, ReadonlySet<string>>;
}

export interface MandateDenominators {
  /** Active roll calls the mandate had a ballot row for — its eligible roll calls. */
  rollCalls: number;
  /** Distinct sitting days among those roll calls. */
  sessionDays: number;
  /** Excused days inside the mandate's window (an excuse dated outside it is not this mandate's). */
  excusedDays: number;
}

export function mandateDenominators(input: MandateWindowInputs): Map<number, MandateDenominators> {
  const rollCallsByMandate = new Map<number, number>();
  const daysByMandate = new Map<number, Set<string>>();
  for (const b of input.ballots) {
    const day = input.rollCalls.get(b.votePspId);
    if (day === undefined) continue; // voided, manual, or another term's roll call
    rollCallsByMandate.set(b.mandatePspId, (rollCallsByMandate.get(b.mandatePspId) ?? 0) + 1);
    let days = daysByMandate.get(b.mandatePspId);
    if (!days) daysByMandate.set(b.mandatePspId, (days = new Set()));
    days.add(day);
  }

  const out = new Map<number, MandateDenominators>();
  for (const [mandate, rollCalls] of rollCallsByMandate) {
    const window = input.windows.get(mandate);
    let excused = 0;
    for (const day of input.excusedDays.get(mandate) ?? []) {
      if (window?.from && day < window.from) continue;
      if (window?.to && day > window.to) continue;
      excused++;
    }
    out.set(mandate, { rollCalls, sessionDays: daysByMandate.get(mandate)!.size, excusedDays: excused });
  }
  return out;
}
