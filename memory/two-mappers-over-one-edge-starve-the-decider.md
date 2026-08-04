---
name: two-mappers-over-one-edge-starve-the-decider
description: The console projected its own narrower copy of the same linked_to edge, so the human deciding saw less evidence than the public — extend the shared shape, never re-declare it
metadata:
  type: project
---

`features/money/getVerificationData.ts` and `moneyLoader.mapLinkedToTie` both turned the
SAME `linked_to` edge into a tie, from two hand-written projections. The public case file
used the full one; the review console used its own narrower one. Result, measured
2026-08-04 on the live graph: the person DECIDING a tie could not see

- `reviewer_note` — carried by **211 of 211** pending ties,
- `flags` (82 ties), `owner_stake_pct` (10), `prior_term` (1),
- `review_note` / `last_decision` / `last_reviewer` / `last_reviewed_at`,

all of which a member of the public could read on `/penize/[pspId]`. The drift is
invisible in review: both files compile, both render, neither test fails.

Second symptom of the same cause: the console's staleness prompt keyed off
`periodTo === null && !corroboration`, which matches **0 of 211** ties (all 211 carry a
corroboration verdict). It had been dead since the batch-002 reconciliation pass, while
the population it was written for — **42** ties flagged `stale-ongoing-in-graph` — got no
prompt at all. A condition written against a shape that later changed fails silently.

The fix that holds: `ReviewTie extends MoneyTie` and the console calls the shared mapper.
A prop the ledger's mapper learns to read now reaches the console in the same commit.
Rule: when a second surface needs "the same thing plus a bit", EXTEND the shape and reuse
the mapper — never re-declare a subset, however small the subset looks on day one.
