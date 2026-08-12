---
name: kgneighbours-default-limit-is-500
description: kgNeighbours defaults to limit 500 — below the ~784 supplies-edge mean per company — and until 2026-08-12 was the one kg read with no truncation guard; always pass an explicit limit
metadata:
  type: project
---

`store.kgNeighbours()` is the primitive the read doctrine steers every
per-entity loader toward (indexed `kg_edge_src_idx` / `kg_edge_dst_idx`, no
relation scan). Two things about it are easy to miss and expensive to learn:

1. **Its default limit is 500** — the smallest default in the store, and it sits
   BELOW the mean number of `supplies` edges per company (~153 700 edges over
   ~196 companies ≈ 784). Every other lister defaults to 1 000 000.
2. **Until 2026-08-12 it was the only kg read with no `warnIfTruncated` call**,
   while its siblings (`listKgNodes`, `listKgEdges`, and both `asOf` twins) all
   had one.

The bill came in twice. `/denik` lost **4 872 contracts** — more than the whole
ledger then carried — because 5 of 35 read companies returned exactly 500 edges;
it only found out by hand-rolling its own detector (`edges.length >= cap`), and
raised its cap to `MAX_CONTRACT_EDGES = 5 000` (live max measured at 2 387 edges
per company, 0 companies truncated). `/dashboard`'s dated-facts feed then ran the
identical unguarded `limit: 500` read per company for another week.

Truncation here is **systematic, not random**: the query is `order by weight desc
nulls last`, so what disappears is always the cheapest edges of the busiest
entity — the read looks plausible and under-reports exactly where the money is.

Rules that follow: never take the default limit on `kgNeighbours`; pass one and
say why. A limit is not a counter — a result whose length equals the limit is
indistinguishable from a truncated one, which is why the guard warns on both.
And a per-entity cap needs a reader-facing disclosure, not just a log line, when
its result is published as a count (the `droppedImplausible` precedent).
