# Batch 5 — Legislation & Alignment — Report

> 5/5 features shipped in one parallel wave, 5 atomic commits. Gates: tsc 0 · lint 0 errors (30 doctrine warnings, unchanged) · tests 980 → **1074/1074** (91 files; the usual apply-batch contention flake passes isolated) · `next build` green.
> Cumulative: **25/35 accepted moonshots shipped across 5 batches.**

## Commits

| Item | Commit | Scope | New tests |
|---|---|---|---|
| 5A Paměť zákona | `5fc85fe` | features/lawwatch, app/zakony/predpis(+[ref]) | 16 |
| 5E Můj kraj | `9dde9e5` | features/civicscore, app/kraj(+[kraj]), poster additive | 12 |
| 5C Civic seismograph | `18e3fcc` | lib/ingest, change_event table+repo, features/denik | 41 |
| 5B Volební kompas | `815cfba` | features/votetrack/kompas, app/kompas | 19 |
| 5D Tripwires | `04e8718` | lib/analysis/tripwires, features/admin, app/admin | 21 |

## What shipped

1. **Paměť zákona** (`/zakony/predpis`) — statute registry + critical-edition dossiers: chronicle of amending bills with sponsors/provenance, §-trails with verbatim before/after and `#p-<§>` anchors. Honesty verdict: real e-Sbírka diffs cover 3 statutes / 6 windows, so per-§ authorship is *not* claimed — window candidates under a disclosed rule, coverage box on every dossier.
2. **Volební kompas naruby** (`/kompas`) — ~20 real roll calls chosen by a printed selection rule; per-MP/club alignment from actual ballots with a documented scoring rule (abstain/absence never inflate agreement); shareable `?hlasy=` URLs; unrankable MPs shown below the line, never hidden.
3. **Civic seismograph** — typed change events (`change_event` table, additive) derived from snapshot diffs + backfilled from the bitemporal trails and review audit; Deník republiky now carries the record-time "zaznamenáno" stream beside registry-dated entries, covered by the `?entita=` watch.
4. **Tripwires** (`/admin` § Hlídky grafu) — four declarative watch patterns with rules printed verbatim, derive-per-request, zero writes. Live: 33 vote-window, 169 unverified-contract, 5 rapporteur, 8 ownership-chain candidates, each linking into the verification console and /penize/strety.
5. **Můj kraj** (`/kraj/[kraj]`) — the constituency ballot card: kraj + national ranks, pillar bars, badges, kraj/chamber averages; PosterFrame's first real adoption ("Tisk kandidátky"); Otevřený-index lens passes through with the cobalt discipline intact on screen, print and citation.

## The flywheel is now closed

Tripwires (5D) propose → the verification console gates → verified ties light up strety (4C) and packets (4E) → decisions publish to Deník důkazů (2C) → change events (5C) put them in Deník republiky (3A) → everything is citable via permalinks/exhibits/receipts (3B/1E/2A). Human review remains the single deliberate bottleneck — 211 ties pending, with tripwire ranking now ordering that queue by evidence completeness.

## Follow-ups carried

- Vote links on statute dossiers (bod_schuze join needs a cheaper path — a second 100k-row ledger read today).
- Codec consolidation debt (×4) still open; nav/shell entries for ~10 new routes (batch 7).

## Next

Batch 6 — Ecosystem: czech-civic-data · eslint-plugin-civic-transparency · Civic Claim Gate · Open-Data Quality Atlas · Loop mission control.
