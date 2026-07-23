---
name: data-analysis-dh
description: DataHub-backed variant of /data-analysis. Same civic-corpus intelligence loop, same slices, same enforced verdict schema — but subagents READ their context (source known-issues, deterministic stats, scoring rubric, prior coverage, provenance) from the DataHub catalog instead of having it hand-carried in the prompt, and coverage is stamped back to the catalog. Use when comparing catalog-backed context against the vault path, or once the catalog is the system of record for analysis context.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# Data Analysis — DataHub-backed variant

Identical in purpose, slices, capabilities, and guardrails to
[`data-analysis.md`](data-analysis.md). **Read that skill first — everything it
says still applies.** This file documents only what CHANGES when the context
layer is DataHub.

The bet being tested (the same one Pumper's `readme_datahub.md` measured on a
sibling product): an analyst agent that *queries* dataset context performs at
least as well as one that has context *hand-carried* into its prompt — and scales
better, because the orchestrator no longer has to remember which caveats matter
for which slice.

## What moves into the catalog

Published by `scripts/data-analysis/datahub-sync.ts` (metadata only — no civic
rows leave the Store), on platform `politicas` against the local GMS
(`http://localhost:8080`, no auth):

| Vault / skill artifact today | Catalog home |
| --- | --- |
| Product primer + Czech-first + club≠party rules (skill prose) | `datasetProperties.description` on every corpus/slice dataset |
| Per-source known-issues watch-list (skill § gotchas) | `description` KNOWN ISSUES block, per source, with provenance |
| Deterministic stats passed in the prompt | `customProperties` (`pct_*`, `quality_*`, `fresh_*`) |
| `coverage-ledger.md` rows | `customProperties.coverage_status` / `coverage_note` per slice |
| The 6 universal criteria definitions | documented FIELDS on `politicas.store.slice_quality` (the rubric IS the schema) |
| "where did this corpus come from" | `upstreamLineage`: `pumper.<app>.<dataset>` → `corpus.pumper-psp-opendata.source_release`; `corpus.<source>.<entity>` → `slice.…` |

Refresh with:

```bash
cp -r .pglite .pglite-copy
PGLITE_PATH=./.pglite-copy npx tsx scripts/data-analysis/slice-stats.ts --out=./.data-analysis   # ground truth
npx tsx scripts/data-analysis/datahub-sync.ts --stats=./.data-analysis/stats.json                # → catalog
```

`slice-stats.ts` is the ONE place the numbers come from — the vault arm and this
arm quote identical stats, so any quality difference is about context, never
arithmetic.

## What changes in the loop

Steps 1–3 and 5–9 of the base loop are unchanged. **Step 4 (fan the subagents) changes:**

- Each subagent is given its slice id + row file and told to call
  `npx tsx scripts/data-analysis/dh-context.ts --slice="<source>×<term>×<entity>"` **first**.
  That returns, as JSON: slice documentation (known issues + corpus rules), the
  deterministic stats, the parent corpus entity's field-level docs, the scoring
  rubric with definitions, upstream provenance, and **the coverage state of every
  sibling slice on that source**.
- The orchestrator does NOT paste the primer, the gotchas, or the stats into the
  prompt. Its prompt carries only: role, slice id, row-file path, the call to
  make, and the verdict-schema requirement.
- The tool surface is deliberately MCP-shaped (`get_entities` +
  `list_schema_fields` + `get_lineage` + a scoped search). Swapping the CLI for
  the DataHub MCP server (`DATAHUB_GMS_URL=http://localhost:8080`) changes the
  transport, not the contract.

**Step 8 (tag coverage)** additionally re-runs `datahub-sync.ts` so the catalog's
`coverage_status` matches the ledger. The vault stays the human-readable archive;
the catalog is what the next agent queries.

## Unchanged — do not relax

- The **verdict schema is still the contract** (`verdictJsonSchema` /
  `npm run da:validate-verdict`). Catalog context does not replace the gate.
- **Counts still come from the deterministic scorer.** The catalog carries those
  same numbers; a subagent still must not author them, and still must flag a stat
  that is semantically hollow (the merged K bucket, empty current-term contacts,
  the year-2925 placeholder, U+FFFD mirror text).
- **Never fabricate; derived metadata only; no lossy preprocessing; respect the
  PGlite writer** (read a COPY). All base-skill guardrails hold.

## Known limits of the catalog layer

- Documentation is a PORT of `docs/data-analysis/` — only as current as the last
  `datahub-sync.ts` run. Re-sync after any analysis pass or the catalog silently
  serves stale coverage state.
- The GMS scroll endpoint on the local quickstart returns an EMPTY body for page
  sizes above ~10; `dh-context.ts` pages at 10 for that reason.
- Freshness/operation history is thin against a bulk-loaded corpus — it becomes
  meaningful only once `da:ingest` runs on a recurring schedule.
