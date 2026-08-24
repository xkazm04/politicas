# Tender loop — STATE (resume here)

> **Regenerated every batch. Read THIS first, `ledger.md` only for history.**

**As of:** batch 003 · 2026-08-24 · last graph write **pass 68**.

## The doctrine (user-set, 2026-08-23)

Person-first analysis exhausted its register (211 ties, company axis 194/195,
everything waits on the human gate) and structurally cannot see the real loss:
**thousands of small inefficient tenders with no politician in them**. This case
inverts the direction — tender by tender, deterministic red flags, pictures
composed from volume, connection to the MP graph a bonus and never a filter.

## Campaign 1: CPV 45 (stavební práce), ISVZ record-level data 2024-12 → present

| fact | value |
|---|---|
| source | ISVZ/RVZ monthly JSON zips (verified: VZ-06-2026 = 16 662 VZ / 20 023 lots) |
| record-level coverage | 2024-12 → 2026-07 (earlier 404 / aggregate-only) |
| corpus persisted | **Jan–Jul 2026 · CPV 45 · 48 647 lots** (passes 67–68; 165 716 edges; monthly snapshots deduped, last wins) |
| graph_touch | **18 MP-tied companies in the tender layer, mostly as AUTHORITIES** (Teplárny Brno: 27 lots/month) |
| calibration | single-bid 3,5 % (real outlier) · deadline p10 11 d (per-procedure!) · spread p10 4,9 % · estimate fill 14 % → authority statistic |

## Open items

1. b004: FIRST FLAGS over the 7-month corpus per the b001 calibration
   (single_bid, tight_spread, short_deadline per-procedure p10) — hand-read
   survivors before persisting.
2. b005: 2025 + 2024-12 ingest (12 more zips) → trailing-window flags
   (repeat_winner, supplier_lock).
3. Product question parked deliberately: the mass map DISCLOSES the layer
   (`omitted.tendersTotal`); a dedicated procurement surface comes after flags.

## Durable tools

`lib/ingest/sources/isvz.ts` (lot parse, tests) · `filter-month.py` (streaming CPV
pre-filter → NDJSON; ijson) · `loadMonth.ts` (the one reader) · `measure.ts` (calibration)
· `persist-month.ts` (pass-stamped writer, snapshot dedupe). Raw months in `data/raw/isvz/`
(gitignored). Next pass: **69**.
