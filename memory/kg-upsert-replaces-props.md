---
name: kg-upsert-replaces-props
description: upsertKgNodes/Edges wholesale-replace props — re-running an old ingest erases later passes' props; backfill with merge-preserving scripts instead
metadata:
  type: project
---

`upsertKgNodes`/`upsertKgEdges` (lib/db/pglite/repositories/kg.ts) do `props =
excluded.props` — a full replace, not a merge. Bill nodes accreted props across
many passes (summary_cz pass 33, forensic_* passes 15–20, sponsors_ranked/fates
pass 34), so **re-running `kg-legislation-ingest.ts --commit` today would erase
140 summaries + 27 forensic verdicts** — it rebuilds props from scratch as of
pass 11.

**Why:** the P44 durability trap (docs/case-loops.md) generalized: any writer
that reconstructs a node must first read the live node and spread its props.

**How to apply:** never re-run an old ingest against the live graph to add
props. Write a targeted backfill in the `kg-bill-roles-ingest.ts` /
`kg-bill-engagement-ingest.ts` pattern (2026-07-27): read nodes, `{...node.props,
...new}`, dry-run default, `--pass=N` explicit (auto-derives from firstSeenPass,
which understates the graph-log sequence). Verify on a `.pglite` copy that the
later-pass props survive before touching live.
