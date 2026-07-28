---
name: recompute-replay-gate
description: a scorer correction must REPLAY the old formula and refuse to write unless it reproduces every stored value — otherwise "correction" silently becomes "rewrite"
metadata:
  type: project
---

When a deterministic scorer is corrected and the stored graph values have to
follow, do NOT re-run the original ingest. `scripts/data-analysis/kg-contribution-
ingest.ts` re-derives bills/interpellations/speeches from LIVE psp.cz dumps, so a
re-run folds however much the chamber has done since the original pass into a
commit whose stated subject is a formula fix — and there is then no way to say
which part of a rank change came from the correction.

The pattern that works (`kg-contribution-recompute.ts`, pass 42): take every input
the correction does not touch VERBATIM off the node, recompute the rest from the
same store rows the original pass read, then **replay the OLD formula over those
inputs and abort unless it reproduces every stored value for every subject**. It
reproduced 207/207, which is what licensed the write. A replay that disagrees
proves the store is not the one the stored numbers came from.

Two things this also buys: the diff you report is exactly the correction (33 MPs,
220,1 points, saturation 158 → 131 — nothing else moved), and derived baselines
written by the same formula (`contribution_psp9` on 109 nodes) get caught, because
their fields fail the same replay unless you correct them too.

Merge-preserving is still mandatory on top of this (see
`kg-upsert-replaces-props`): verify on a `.pglite` copy with a full before/after
props diff over ALL nodes, not just the ones you meant to touch — 153 646 nodes,
0 differences outside the eight declared props, before going near the live store.
