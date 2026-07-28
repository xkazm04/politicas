---
name: kgneighbours-weight-order-is-not-total
description: kgNeighbours orders by weight desc, which ties densely — any top-N cut must re-sort with byListOrder or the page shuffles between builds
metadata:
  type: project
---

`store.kgNeighbours()` is the indexed per-node edge read (`kg_edge_src_idx` /
`kg_edge_dst_idx`) and the right primitive for a per-entity loader — but it
orders by `weight desc nulls last`, which is **not a total order**. Co-voting
agreement is stored rounded to 3 dp, so ties are dense and Postgres may return
tied rows in any order, differing between runs of the same build.

Migrating `getProfileData` from `listKgEdges` (whole-relation scan, ordered
`src, rel, dst`) to `kgNeighbours` therefore silently reordered the top-8 ally
list of **202 of 207 MPs** on the first attempt — no error, no test failure,
just a page that renders differently every build. `lib/db/kgOrder.ts`
(`byListOrder`) reproduces the listers' order in JS; apply it after any
`kgNeighbours` read whose result is ranked and cut.

**Why it matters:** every remaining loader that still scans a relation is a
candidate for this same migration (it took `/poslanec` from 16 store calls per
MP to 8, 62,4 s → 30,6 s over 20 MPs). Each one will hit this trap, and the
symptom is invisible unless you diff rendered output across builds — which is
how it was caught (207/207 byte-identity check). See
[[profile-loader-single-pass]] in the Perfect vault for the measurement.
