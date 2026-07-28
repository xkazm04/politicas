---
name: infinity-timestamp-collapses-a-whole-surface
description: 'membership.to_at = infinity is a legal timestamptz; isoTs threw RangeError, every loader turns a throw into null, and one cell blanked the entire MP dossier'
metadata:
  type: project
---

Postgres accepts `'infinity'` / `'-infinity'` for `timestamptz`, and the corpus
contains them. `isoTs`/`isoDate` in `lib/db/pglite/internals.ts` called
`toISOString()` on the resulting Date, which throws `RangeError: Invalid time
value` — and because **every feature loader converts a throw into `null`**, one
`membership.to_at` cell took the whole `/poslanec/[id]` dossier down to
`DataUnavailable`. No error surfaced to the reader; the page simply claimed it
had no data.

Fixed at the mapper: a non-finite Date is handed on as a detectable string
rather than an exception, so the caller can label the value unreadable instead
of losing 40 other real facts. The seat then stays **current** — an unreadable
end date proves nothing about a seat having ended. `lib/format.ts`'s
`parseIsoDateParts` already rejects anything that is not `YYYY-MM-DD`, so the
sentinel can never render as a date.

**The general lesson, which outlives this one cell:** the loader convention
(`catch → null → labelled fallback`) makes a single bad value indistinguishable
from a dead store. Any per-row parse that can throw should fail *that row*, not
the request. Worth checking wherever raw open-data values reach a mapper —
the same corpus carries **19 contract `signedOn` values in years 0002, 2027 and
3062** (handled by `lib/analysis/plausible-date.ts`: suppress the date, keep the
row and amount, disclose the count, never repair it).
