# Batch 1 — Citizen Instruments — Report

> 5/5 features shipped, 5 atomic commits on `vibeman/moonshot-exec-2026-07-30`.
> Gates: tsc 0 errors · eslint clean (pre-commit enforced) · tests 630 → **698/698** (60 files) · `next build` green.
> Baseline preserved; the one transient failure was PGlite store contention while builders ran in parallel (passes clean in the final serial run).

## Commits

| Item | Commit | Scope | New tests |
|---|---|---|---|
| 1A Otevřený index | `cfed6d8` | features/civicscore, app/zebricek | 18 (lens codec, re-rank, ties, invariants) |
| 1B Trail Engine | `7439355` | features/graph, app/graf | 14 (path determinism, tie-breaking) |
| 1C Seismograf sněmovny | `5f095bc` | features/votetrack, app/hlasovani | 16 (discipline/Rice/cohesion/anchors) |
| 1D Poster Mode | `ec45725` | features/shared/poster, app/plakat, globals.css | 7 (citation builder) |
| 1E Evidence cards | `483ff0c` | features/dashboard, app/dashboard/exponat | 13 (hash determinism, codec) |

## What shipped

1. **Otevřený index** (`/zebricek`) — six token-styled weight faders + editorial presets re-rank all 207 MPs live; the lens is URL-encoded (`?vahy=`) and shareable; cobalt "váš index" state is kept strictly distinct from the official methodology; disclosed-rule note.
2. **Trail Engine** (`/graf`, „Spoj dva body") — server-computed shortest evidence path between any two entities with a disclosed cost rule (co-vote edges excluded, hub penalty, verified-over-pending, alphabetical tie-break); canvas dims and hops light in sequence; hop ledger wired to NodeInspector provenance; honest empty state.
3. **Seismograf sněmovny** (`/hlasovani`) — verified PSP10 real coverage (2,030 roll calls / 402,800 valid ballots) and moved VoteTrack onto real-ledger derivations; hero seismogram day-strip (cohesion needles, rebellion spikes); per-vote `#h-<pspId>` permalinks with scroll+flash; mock survives only as disclosed outage fallback.
4. **Poster Mode** (`/plakat/zebricek` + reusable `PosterFrame`) — A4/A3 print-grade poster pipeline with archival Czech citation footer (zdroj / metodika / stav dat / živá URL); named `@page` rules, print-preview parity; PosterFrame is the designated export primitive for later batches.
5. **Evidence cards** (`/dashboard/exponat/[id]`, „Exponát") — content-hash-addressed, deterministically re-derived exhibit pages for the Velin slice and each dated fact; museum-label typography, citation footer with hash + sources + retrieved date; freshness disclosure when the derivation has moved on; only real data is citable.

## Known follow-ups (carried, not blockers)

- Shell rail has no entry for new sections (builders may not touch `features/shell/*` by contract) — wire nav affordances in a later batch (fits Batch 7 / Občanská schránka work).
- Czech copy is colocated per-feature (messages/*.json was a shared file across parallel builders) — consolidation candidate for a later batch.
- 1A/1C should adopt PosterFrame (deferred by design; PosterFrame shipped this batch).

## Cumulative

Batch 1 of 7 complete: 5/35 accepted moonshots shipped. Next per BATCH-PLAN.md: **Batch 2 — Provenance & Trust** (Provenance Capsule · Tamper-Evident Ledger · Deník důkazů · Doctrine Compiler · Numbers That Testify).
