---
status: first-step-landed
landed_on: master (step 1 only; steps 2-5 open)
registry_technique: civic-intelligence/parliamentary-data-modeling/mandate-vs-person-identity
closes: Q-effort-5 (docs/data-analysis/frontier.md), P38 (docs/data-analysis/patterns.md)
size: ~6 files, ~90 lines, plus one writer run against the store
---

# Per-mandate denominators for participation and attendance

## The defect

`scripts/data-analysis/kg-contribution-ingest.ts` divides each MP's present
ballots by every active roll call of the term, and each MP's excused days by
every sitting day of the term. For a mandate that opened late or closed early
both rates are wrong, and they are wrong in opposite directions: participation
is depressed and attendance is flattered. P38 named the first half in batch 002
("score low purely on shorter tenure - contribution.ts has no tenure
normalization"); Q-effort-5 has been open since.

## Measured (replay on the public PSP10 dumps, 2026-10-10)

poslanci.zip + hl-2025ps.zip as published on 2026-10-10: 207 mandates, 2,230
active roll calls (voided and manual excluded, as the writer does), 74 sitting
days.

- **Floor held:** 0 of 193 full-term mandates change participation or
  attendance (the publisher writes a row for every roll call for each of them,
  so their own count equals the term's). Max change in points: 0.000.
- **Target moved:** 10 short mandates change. Participation, term arm -> own arm:
  0.321 -> 0.974 (seated June 2026), 0.403 -> 0.910 (May 2026), 0.577 -> 0.807
  (March 2026), 0.606 -> 0.904 / 0.389 -> 0.699 / 0.165 -> 0.581 (departed).
  Attendance moves the other way for the departed (e.g. 0.743 -> 0.208).
- **Ranking:** 8 of the 15 lowest participation rates under the term arm are
  short mandates; under the own arm only the 4 never-seated mandates remain there
  (they are flagged `never_seated` and carry no roll call they could attend). The
  June replacement moves from 6th lowest of 207 to 189th.
- **Why the publisher's rows and not a date window:** the March 2026 replacement's
  mandate arose 2026-03-11 and the oath came later; a window from `fromAt` counts
  1,738 roll calls, the publisher's rows 1,595. Q-effort-5's own framing
  ("mandate_start_date-aware") would still score that MP at 0.741 instead of 0.807.

The `never_seated` classifier in `scripts/case-loops/effort/tenure.ts` was the
other seam tested and it held: the activity signature agreed 4 of 4 with the
batch-001 enrichment, which researched each case by hand. The bulk tables carry no
oath evidence to replace it with: code `W` (pre-oath) occurs on 0 of 451,600
ballot rows this term, and one of the four has excuse rows dated a month after
she relinquished the seat. Leave it as it is.

## Steps

1. **Done (step 1, on master):** `lib/analysis/mandate-window.ts` +
   `mandate-window.test.ts` - a pure `mandateDenominators()` over active roll
   calls, ballot rows, membership windows and excused days. A mandate with no rows
   gets no entry.
2. Wire it into the three writers that build the denominators today:
   `kg-contribution-ingest.ts` (line ~82), `kg-contribution-recompute.ts`
   (line ~98) and `scripts/case-loops/effort/psp9-contribution.ts` (line ~82).
   The window is the chamber membership row (organ of the term, `kind=member`) that
   tenure.ts already reads. A mandate with no entry keeps today's 0 participation
   and is already `never_seated`. State that, don't hide it.
3. Bump `CONTRIBUTION_FORMULA_REF` in `lib/analysis/contribution.ts` and let the
   writer's lineage stamp carry it. The sentinel invariants pin the old inputs and
   need fixtures that state which arm they are.
4. Copy: `messages/{cs,en}.json` `ratesLead` - "the share of roll calls at which
   the MP took a position" becomes "... of the roll calls held while the MP held
   the seat"; attendance likewise over the MP's own sitting days.
5. Run the writer against the store (`--commit`), then the sentinel, then close
   Q-effort-5 in `frontier.md` and append a resolution line to P38. The
   `replacement` low-score badge stays: the volume components (bills, speeches)
   are still raw counts over a shorter window, which is the technique's other
   allowed option (raw counts published with the tenure stated).

## Gate

`npm run test:unit` (the new file plus `contribution.test.ts`, the sentinel
tests), `npm run typecheck`, and the writer's own dry-run output: the
`denominators:` line becomes per-mandate and the 193 full-term rows must not move.
The measurable is the replay above; re-run it on the store and compare.
