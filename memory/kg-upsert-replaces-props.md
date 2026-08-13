---
name: kg-upsert-replaces-props
description: upsertKgNodes/Edges wholesale-replace props — a writer that rebuilds a node erases every other pass; kg-compute was the worst case, and clearKg is worse still
metadata:
  type: project
---

`upsertKgNodes`/`upsertKgEdges` (lib/db/pglite/repositories/kg.ts) do `props =
excluded.props` — a full replace, not a merge. Any writer that RECONSTRUCTS a
node's props therefore deletes every prop any other pass ever wrote to it.

**Why:** the P44 durability trap (docs/case-loops.md) generalized.

## The confirmed instances

- **`kg-compute.ts` — the worst one, fixed 2026-08-13 (D5).** It is the area's #1
  entry point and it built `const props = {}` from scratch, so `--commit` erased,
  on all 207 MPs: `contribution_score`, `participation_rate`, `absence_rate`,
  `bills_authored`, `speech_turns`, `interpellations`, `leadership_count`,
  `absentee_manager_lead`, `contribution_psp9`, `amendments_authored`,
  `bills_first_signed`/`co_signed`, `effort_tenure_class` — every one of them read
  today by `getLeaderboardData.ts`, `getProfileData.ts` and `moneyLoader.ts`. It
  now reads the nodes it is about to write and merges through
  `mergeComputedNodeProps`. **This file used to name kg-legislation-ingest and NOT
  kg-compute** — the more dangerous script was the one the note missed.
- **`kg-legislation-ingest.ts`.** Bill nodes accreted props across many passes
  (`summary_cz` pass 33, `forensic_*` 15–20, `sponsors_ranked`/fates 34), so
  re-running it today would erase 140 summaries + 27 forensic verdicts — it
  rebuilds props as of pass 11.
- **`kg-promote.ts` — both halves.** `toRows` builds `{rationale}` for anything a
  verdict declares. Edges were guarded 2026-07-24 (`CASE_OWNED_EDGE_RELS`, after a
  `linked_to`/`supplies` verdict could have wiped a human-gated tie's review
  state); NODES were not, until 2026-08-13 — a verdict declaring
  `psp:person:6790` passed the shared `KG_NODE_KINDS` enum and would have replaced
  that MP's whole enrichment layer with one rationale string.
  `CASE_OWNED_NODE_KINDS` is now derived as *the enum minus `bloc`/`theme`*, so a
  kind a future pass adds is refused by default.

## `clearKg()` is a separate, larger hazard

`--reset` does not scope to the caller: it deletes EVERY `kg_node` and `kg_edge`.
kg-compute rebuilds 3 node kinds and 3 edge rels against a graph holding ten kinds
and seventeen rels, so a reset wipes ~154 000 nodes / ~178 000 edges and restores
~1 000 — /penize, /zakony, /denik and /graf go dark. `docs/data-analysis/frontier.md`
F5 **prescribed that exact command as routine maintenance** until 2026-08-13.
Archiving to `kg_*_history` is a record, not a restore. `guardKgReset`
(lib/analysis/kg.ts) now names the casualties and refuses; `--supersede` overrides.

**How to apply:** never rebuild a node's props from scratch — read the live node
and merge (`mergeComputedNodeProps`, or the inline `{...node.props, ...new}` the
four sibling writers use). Dry-run by default, `--pass=N` explicit. Verify on a
`.pglite` copy that the later-pass props survive before touching live. And a
recompute never needs `--reset`: the upsert replaces each claim in place.

**Known residue (frontier F24):** merging cannot drop a prop the writer stopped
computing, so a conditionally-computed value can go stale under an old pass's
provenance. Smaller than the erasure it replaced; still open.
