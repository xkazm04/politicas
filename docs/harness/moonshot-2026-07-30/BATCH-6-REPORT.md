# Batch 6 — Ecosystem — Report

> 5/5 features shipped in one wave, 5 atomic commits + 1 fix-forward. Gates: tsc 0 · lint 0 errors (30 doctrine warnings — parity proven byte-identical through the plugin extraction) · tests 1074 → **1183/1183** (101 files, fully clean run) · `next build` green.
> Cumulative: **30/35 accepted moonshots shipped across 6 batches.**

## Commits

| Item | Commit | Scope | New tests |
|---|---|---|---|
| 6A czech-civic-data | `5875f14` | packages/czech-civic-data, ingest shims, tsconfig alias | 52 (from 26) + shim suite |
| 6C Civic Claim Gate | `5c3598f` | features/overeni, app/overeni, lib/claims/registry | 49 |
| 6D Quality Atlas | `ad7fbdd` | lib/analysis/atlas, features/atlas, app/atlas(+json) | 18 |
| 6B eslint-plugin-civic-transparency | `c7ee40b` | packages/eslint-plugin-…, eslint-rules shims, config | 8 RuleTester suites (6 new) |
| 6E Loop mission control | `aacea06` | features/admin/loops, app/admin/loops.json + actions | 30 |
| fix-forward | `325e9b6` | atlas.test.ts readonly-array append | — |

## What shipped

1. **czech-civic-data** — the UNL/cp1250/zip/fold layer is now a standalone in-repo package with CZ+EN README, real per-source examples, doubled test coverage (incl. a corrected false assumption about cp1250 gap bytes), consumed by the app through equivalence-tested shims.
2. **eslint-plugin-civic-transparency** — all 8 rules packaged as a flat-config plugin (recommended/strict presets, per-rule docs, adoption guide); 6 previously-untested rules gained RuleTester suites; repo lint output proven byte-identical.
3. **Civic Claim Gate** (`/overeni`) — paste any politicas-issued ref (5 ref families, each parsed by its own codec) → verified / value-moved-since (both values + dates) / unknown, with full receipt; zero-JS shareable GET form; the refs-only boundary stated above the form; newsroom citation guide.
4. **Open-Data Quality Atlas** (`/atlas` + atlas.json) — per-source coverage/freshness/integrity/completeness with each rule printed; "nehodnoceno" honest unknowns that sort last, never as zero; cadences disclosed as politicas expectations.
5. **Loop mission control** (`/admin` Velín smyček + loops.json) — real durations/failures from ingest_run, hand ledgers honestly unscored; two-phase-confirm drive actions (requeue/reorder/ack/resolve, none destructive) logged to an sha-256-chained JSONL disclosed as outside the Merkle ledger.

## Follow-ups carried

- `/svedectvi` should import its claims from the new lib/claims registry (consolidation).
- Nav/shell wiring for /overeni, /atlas and the other ~12 new routes → Batch 7.
- ClaimReview-builder consolidation (2A/2E) still open; ref-codec debt unchanged.

## Next

Batch 7 (final) — Second Surfaces: Občanská schránka · Referendum o metodice · Newsroom Evidence Terminal · Forenzní režim · Live-Graph Sentinel — plus the shell/nav wiring that makes all seven batches discoverable.
