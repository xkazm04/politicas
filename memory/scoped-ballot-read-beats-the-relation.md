---
name: A roll-call-scoped vote_ballot read is ~250× cheaper than the term read, and the small-LIMIT hazard does not apply to it
description: `vote_ballot_vote_idx` has existed since the first DDL with no reader; `vote_psp_id = any(...)` gives a bitmap index scan (4 000 rows / 29 ms) against 406 000 rows / 7,3–7,7 s for the whole term. Measured 2026-08-11 for /kompas.
metadata:
  type: project
---

`listVoteBallots({ termCode })` reads the corpus hot table whole: **406 000 rows,
7 281 / 7 705 ms** on the live store (the 15 758 ms figure elsewhere in the repo is
the same read under load — it is seconds either way, never tens of ms). Two
surfaces paid it, and /kompas paid it for the named ballots of **twenty** roll
calls.

`vote_ballot_vote_idx on vote_ballot(vote_psp_id)` is in `lib/db/pglite/ddl.ts` and
has been since the first DDL — nothing exposed it. `BallotListOptions.voteIds`
does, and `explain analyze` at `KG_READ_CAP` gives:

```
Limit -> Sort -> Bitmap Heap Scan on vote_ballot (Heap Blocks: exact=77)
           -> Bitmap Index Scan on vote_ballot_vote_idx
20 roll calls -> 4 000 rows, Execution Time: 29,1 ms   (156/136/131 ms incl. row mapping)
```

**The nuance worth remembering:** [[small-limit-is-slower-than-the-cap]] says a small
`LIMIT` flips PGlite to a primary-key walk. That hazard is about a read whose only
filter is a low-selectivity column with no usable predicate — it does **not** apply
when the WHERE clause itself sits on an indexed column. The same query at
`limit 100` picks an *Index Scan* on the very same index (1,4 ms). Pass
`KG_READ_CAP` anyway (one cap for the app), but do not assume the cap is what
saves you: check which predicate the planner is actually riding.

**Corollary paid for on the same day:** an empty `vote_tag` layer made `getKompas()`
read the whole ledger and *then* discover it had no themes — ~15 s to answer
„data unavailable". A loader must evaluate its **cheapest disqualifying
precondition first**; `readVoteTags()` is 1 ms and decides the whole page.
