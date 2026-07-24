# Phase 5 — the optional DataHub projection (tier 3)

The **disposable mirror** (design §2, §10.5). `scripts/data-analysis/kg-datahub-sync.ts`
(`npm run da:kg-datahub-sync`) projects `kg_node`/`kg_edge` into DataHub as datasets +
lineage, for cross-system context and external-agent access. **It is optional and the loop
is fully functional with it off** — nothing reads back from tier 3. Built 2026-07-23.

## What it is (and deliberately is not)

- **A pure projection of tier 2** (§11): it only *reads* `kg_*` and emits their metadata;
  it never writes the store and can never hold an unbacked fact. Metadata only — no civic
  rows, no node payloads beyond schema/counts/provenance.
- **Idempotent & disposable**: re-running re-emits the same aspects (DataHub upserts by
  urn+aspect). If DataHub Lite is dropped, nothing durable is lost — rebuild from `kg_*` any
  time. This is exactly the tier-1/2-independence the whole design is built around.
- **DataHub-free-verifiable**: default writes the aspect envelopes to
  `.kg-analysis/datahub-kg-aspects.json` and prints a summary; `--push --gms=<url>` POSTs to a
  running GMS (same `/openapi/entities/v1/` path, `politicas` platform, and envelope shapes as
  the existing `datahub-sync.ts`, so the KG catalog joins the corpus lineage graph).

## What it publishes (50 aspects)

- **`store.kg_node` · `store.kg_edge`** — the two tables: schema (§3), row counts, by-kind /
  by-rel breakdowns, and the deterministic-vs-verdict method split (nodes 248 det / 15 verdict;
  edges 21 304 det / 55 verdict).
- **`kg.node.<kind>`** ×5 (person 207 · party 8 · organ 33 · bloc 2 · theme 13) — per-kind views.
- **`kg.edge.<rel>`** ×5 (co_votes_with 20 496 · influential_in 605 · rebels_against 203 ·
  about 47 · belongs_to 8) — per-relation views, each documenting its weight meaning.

## Lineage — the payoff (recomputability, §3)

Every edge relation links to the **raw psp.cz corpus tables** it is recomputable from
(referencing the *same* dataset urns `datahub-sync.ts` publishes, so the graphs join):
- `co_votes_with`, `rebels_against` → `corpus.psp_hlasovani.vote_ballot` (+ membership/organ, vote_event)
- `influential_in` → `corpus.psp_poslanci.membership` + `organ`
- `belongs_to` (blocs) → `kg.edge.co_votes_with` (derived from the co-voting matrix)
- `about` (themes) → `corpus.psp_hlasovani.vote_event` (titles)

So an external agent can trace a **bloc → belongs_to → co_votes_with → vote_ballot** — the
derived graph grounded all the way back to the raw ballots. `store.kg_edge` rolls up from the
per-rel views; `store.kg_node` from the per-kind views.

## Status

Built and verified (50 aspects emitted to file; no GMS was running, so `--push` was not
exercised — by design it is not required). Case 2 phases 1–5 complete. Tier 3 remains what
the design intends: a convenience mirror, never the memory of record.
