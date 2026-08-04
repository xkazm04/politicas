---
name: A small LIMIT on a kind-filtered kg_node read is ~200× SLOWER than KG_READ_CAP
description: PGlite walks the id primary key and filters by kind when the limit is small, scanning the whole 154k-row table; the cap lets it use kg_node_kind_idx. Measured on /zebricek.
---

`listKgNodes({ kind, limit: N })` gets DRAMATICALLY slower as `N` gets SMALLER.
Measured on the live store (~154 k `kg_node` rows), 3 rounds each:

```
listKgNodes({kind:"party",  limit:30})       498 / 632 / 723 ms   →  8 rows
listKgNodes({kind:"party",  limit:1_000_000})  2,4 / 2,9 / 41,7 ms →  8 rows
listKgNodes({kind:"person", limit:150})      419 / 587 / 692 ms   → 150 rows
listKgNodes({kind:"person", limit:1_000_000}) 47 / 47 / 55 ms      → 207 rows
```

Why: with a small `LIMIT` the planner prefers an ordered walk of the `id` primary
key with `kind` as a filter — it expects to stop early. For a rare kind it never
stops early, so it scans the entire table. At the cap it sorts a `kg_node_kind_idx`
index scan instead. A "cheap little probe" is therefore the most expensive
statement on the page.

Consequences already paid:
- `buildLeaderboard()`'s four ad-hoc limits made the /zebricek read path ~1,2 s;
  moving every read to `KG_READ_CAP` took it to ~0,47 s warm.
- `storeReady()`'s cardinality probe read `{ kind, limit: floor }` — the single
  most expensive read on that path AND a guaranteed false positive for
  `warnIfTruncated` (a probe that reads exactly its own limit is precisely what
  that guard cannot tell from a truncated read). It now calls `kgKindCounts()`,
  one indexed group-by that answers every kind at once (237–380 ms).

Rule: **never size a kg read to what you expect back.** Pass `KG_READ_CAP` and
count in JS; if you want a count, ask for a COUNT (`kgKindCounts`), never a
limited row list.
