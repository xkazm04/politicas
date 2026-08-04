---
name: recompute-invalidates-prose
description: A metric recompute silently invalidates the analyst prose that QUOTED the old value — check it in the recompute, which holds both numbers, never in a downstream gate
metadata:
  type: project
---

Pass 42 (2026-07-29 formula, applied to the store 2026-08-04) corrected `committee_count`
from psp.cz membership ROWS to DISTINCT BODIES. It was a careful pass — it replayed the old
formula and refused to write unless it reproduced every stored value first. It still shipped
a public defect: the effort loop's dossier prose had QUOTED the old numbers, leaving **14
sentences naming the wrong committee count and 16 quoting a superseded score** on the profile
page. Two claims did not just go stale, they inverted („zůstává nad klubovým průměrem" when
the MP is now below it; „skóre vzrostlo" when it now fell).

**Why:** a number's own consistency check cannot see the sentences that cite it. Every
`effort_*` prose field was written against a score, so moving the score rewrites the meaning
of prose nobody touched.

**How to apply:** put the check in the thing that recomputes — it is the only place that holds
the before AND after value. `scripts/data-analysis/kg-contribution-recompute.ts` now reports
every dossier field quoting a score it supersedes. Do NOT put it in a gate: a gate sees only
the after-state, and the weak "is this score-shaped number one the graph still carries" variant
was measured at **66 fires across 765 prose fields with almost no real hits** and deliberately
not shipped.

Two reusable guards came out of it, both imported (never forked — see
[[kgneighbours-weight-order-is-not-total]] for the sibling fork lesson):
`lib/analysis/committee-claims.ts` and `lib/analysis/score-citations.ts`.

Corollary worth more than the fix: **a guard that fires zero times has proven nothing.** The
score lens was first written to match „N bodu", fired 6/6 false, and was retired as noise —
while 16 real stale citations sat in the corpus written as „skóre … (90,5)". It had been
validated against the shape the prose OUGHT to have, not against the corpus. Validate any
lens by hand-reading its hits on the real corpus (the committee scan went 59 → 15 that way,
14 real / 1 false).
