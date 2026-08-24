# Tender loop — STATE (resume here)

> **Regenerated every batch. Read THIS first, `ledger.md` only for history.**

**As of:** batch 001 · 2026-08-24 · no graph writes yet (calibration first, by design).

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
| corpus measured | VZ-06-2026 · CPV 45 · 3 625 lots (adapter + tests done; nothing persisted) |
| calibration | single-bid 3,5 % (real outlier) · deadline p10 11 d (per-procedure!) · spread p10 4,9 % · estimate fill 14 % → authority statistic |

## Open items

1. b002: graph schema (`tender` kind; `procures`/`bids_on`/`wins` rels, registry
   keys) + insert writer (company join GATED ON COUNTRY — an 8-digit Slovak id
   passes the IČO shape test) + persist June 2026 CPV 45 + verify.
2. b003+: accumulate months backward (2026-05 … 2024-12), then trailing-window
   flags (repeat_winner, supplier_lock) once ≥ 12 months stand.
3. Flag computation per the b001 calibration read (see the skill's log).

## Durable tools

`lib/ingest/sources/isvz.ts` (lot parse, tests) · `scripts/case-loops/tender/measure.ts`
(calibration distributions; flags nothing). Raw months in `data/raw/isvz/` (gitignored).
