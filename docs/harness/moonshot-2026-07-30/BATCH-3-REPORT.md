# Batch 3 — The Daily Record — Report

> 5/5 features shipped, 5 atomic commits. Gates: tsc 0 · lint 0 errors (30 doctrine warnings, unchanged — all new code satisfies the rule) · tests 785 → **867/867** (74 files; one apply-batch hook-timeout contention flake, 13/13 in isolation) · `next build` green.
> Cumulative: 15/35 accepted moonshots shipped across 3 batches.

## Commits

| Item | Commit | Scope | New tests |
|---|---|---|---|
| 3A Deník republiky | `2c487fe` | features/denik, app/denik(+feeds), landing teaser | 18 |
| 3B Evidence Permalinks | `e621994` | features/graph, app/graf/p/[ref](+OG, +bundle) | 15 |
| 3C Bitemporal Graph | `df46db3` | lib/db/pglite (history tables, asOf API) | 7 |
| 3D Data Releases | `59df5cf` | features/data-releases, app/data, readiness | 20 |
| 3E Kariérní spis | `8fa0e1c` | features/profile, careerSpine | 16 |

## What shipped

1. **Deník republiky** (`/denik`) — the daily record of the state, derived from the facts' own registry dates + the append-only review audit; `#d-<date>` anchors, RSS/JSON feeds, `?entita=` URL-as-subscription watch, landing front-page teaser. Investigation verdict: the store holds only the current materialization (no pass snapshots), so the diary rule is disclosed on-page; true pass-over-pass diffing becomes possible now that 3C's history tables record supersessions going forward.
2. **Evidence Permalinks** (`/graf/p/[ref]`) — any node, curated trail, or computed Trail-Engine path is a content-hashed citation with citation rail, stale-citation self-disclosure, downloadable JSON-LD evidence bundle, and a dark house-style OG card; wired into both graph variants.
3. **Bitemporal Graph** — append-only kg history tables + supersede-not-overwrite upserts (jsonb-semantic guard) + `asOf(date)` read view; `asOf(now)` proven identical to current reads; the pending→verified review timeline is now queryable.
4. **Data Releases** (`/data`) — deterministic release manifest (version = day of newest ok ingest run; honest "nevydáno"), changelog with Merkle heads from the Batch-2 ledger, capped size-exact snapshot download, manifest.json/snapshot.json endpoints.
5. **Kariérní spis** — the dossier's service-record term ribbon over real PSP1–PSP10 mandates (2,157 rows; 115/207 MPs multi-term), window merging, out-of-parliament breaks, per-term activity coverage disclosed; pre-PSP9 activity honestly marked out-of-record.

## Follow-ups carried

- Deník can upgrade to true record-time diffing once 3C's history accumulates (supersessions recorded from now on).
- 3B duplicated the ref-codec locally (claimRef precedent) — a third instance; codec consolidation is now warranted in a cleanup wave.
- Nav/shell entries for /denik, /data, /dukazy, /svedectvi still absent (shell is out of bounds for builders) — Batch 7 territory.

## Next

Batch 4 — Money: Every Town's Mirror · Municipal Money Trail · Vote-Collision Engine · Evidence Packet Compiler · Kolizní radar.
