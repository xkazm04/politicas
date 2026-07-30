# Batch 4 — Money — Report

> 5/5 features shipped in two waves (surface collisions in features/money and features/budget forced the split), 5 atomic commits. Gates: tsc 0 · lint 0 errors (30 doctrine warnings, unchanged) · tests 867 → **980/980** (82 files) · `next build` green.
> Cumulative: 20/35 accepted moonshots shipped across 4 batches.
> Operational note: 4A and 4C were interrupted mid-build by the weekly API limit and resumed cleanly from their on-disk partial state after reset.

## Commits

| Item | Wave | Commit | Scope | New tests |
|---|---|---|---|---|
| 4B Kolizní radar | 4.1 | `125fa8f` | features/lawwatch, app/zakony/kolize(+feeds) | 19 |
| 4A Every Town's Mirror | 4.1 | `3cd9794` | features/budget, app/rozpocty(+[ico]), lib/ingest/sources/monitor | 68 |
| 4C Vote-Collision Engine | 4.1 | `4864ae1` | features/money/collisions, app/penize/strety | 22 |
| 4E Evidence Packet Compiler | 4.2 | `e70fd69` | features/money, app/penize/[pspId]/paket | 16 |
| 4D Municipal Money Trail | 4.2 | `2552e20` | features/budget (supplierTrail), app/rozpocty | 19 |

## What shipped

1. **Every Town's Mirror** — BudgetMirror runs on real MONITOR data: the live API was verified and harvested (full 6,254-obec register; budget indicators for all 132 towns ≥10k × 2021–2025, 660 calls / 0 failures). Peer groups = population band × kraj with disclosed MIN_PEERS widening; coverage stated on-page; per-town `/rozpocty/[ico]` permalinks.
2. **Municipal Money Trail** — the town's supplier ledger from an IČO join over kg contracts: 11,582 contracts / 1,026 town×supplier pairs / 353 towns. Payment direction only asserted where the registry flags it (4,682 contracts); otherwise "směr platby záznam neuvádí" — never inferred. MP-tie overlay + /penize + /graf cross-links.
3. **Vote-Collision Engine** (`/penize/strety`) — deterministic verified-tie × ballot × statute join with the rule disclosed verbatim; vote→print linkage runs through session agendas (live vote titles never carry "tisk N"). Live result: 341 votes linked, **0 candidates — honestly**: 0/211 ties are human-verified; the page states this and links the review console. The engine lights up as reviews happen.
4. **Evidence Packet Compiler** (`/penize/[pspId]/paket`) — one-click citable dossiers: verified-only (collisions structurally excluded, test-pinned), timeline + registry links + review provenance + ready-to-cite blocks, content-hash that survives circulation, exclusions stated with correct Czech plurals.
5. **Kolizní radar** (`/zakony/kolize`) — chronological early-warning ledger of drafting conflicts dated by the payloads' own timestamps (undated flags get a disclosed ordering, never invented dates), `#r-<id>` anchors, citation blocks, RSS/JSON in the shared codec family.

## Follow-ups carried

- The whole money story now waits on **human review throughput**: strety candidates and packet contents both unlock as ties get verified (211 pending). The review console is the bottleneck by design.
- Full-6,254 indicator harvest (~37k calls) is a standing offline job candidate; architecture is ready.
- Codec/ref consolidation debt now spans 4 instances (claimRef, permalink, exhibit, radar/denik feed ids) — cleanup wave still warranted.

## Next

Batch 5 — Legislation & Alignment: Paměť zákona · Volební kompas naruby · Civic seismograph · Tripwires · Můj kraj.
