# Tender loop — unit ledger (Case ④ needles)

Resumable state for the tender-by-tender needle loop. Read STATE.md to resume;
this file is the append-only batch log. Skill: `.claude/skills/tender-loop/SKILL.md`.

## Batch log

### Batch 001 — the adapter, and the market's own numbers (2026-08-23/24)

Calibration batch, no graph writes. Built `lib/ingest/sources/isvz.ts` (lot-level parse,
6 tests) + `scripts/case-loops/tender/measure.ts`. VZ-06-2026 · CPV 45 · 3 625 lots:
authority IČO 100 %, bid count 88 %, deadline window 72 % (after correcting the basis to
procedure-start → lhůta-end; the lhůta start is ~13 % filled), estimate 14 % (→ authority-
level statistic, not a per-lot flag). Single-bid 3,5 % (JŘBU 18 %, přímé zadání 17 %, open
~1,6 %); spread p10 4,9 %; deadline p10 11 days (per-procedure percentiles needed).
EUROVIA 46 wins / 12 authorities in ONE month. Foreign 8-digit identifiers pass the IČO
shape test → the b002 writer gates the company join on country. Evidence:
`measure-cpv45-2026-08-24-1054.json`.
