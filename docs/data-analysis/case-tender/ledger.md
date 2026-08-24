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

### Batch 002 — the layer exists, and the islands touched land immediately (2026-08-24)

Pass 67: `tender` kind + `procures`/`bids_on`/`wins` rels; persist-month.ts (deterministic,
prop-key-gated, replayable). June 2026 CPV 45: 3 625 tenders, 3 377 new companies (namespace
350 → 3 727), 10 698 edges, 17 700 rows. Identity grew a THIRD state: 3 736 participant
entries have no IČO and no country — the register anonymises losing bidders; disclosed as
`unidentified_participants`, never guessed. **18 MP-tied companies appeared in the tender
layer with zero join logic — on the AUTHORITY side** (Teplárny Brno procures 27 lots/month).
props-check clean. Gate green (3 016 tests).

### Batch 003 — seven months, three size walls, and a map that must not draw (2026-08-24)

Pass 68: Jan–Jul 2026 CPV 45 = **48 647 lots** (61 017 scoped rows deduped — monthly files
re-publish snapshots; last month wins), +12 467 companies, **165 716 edges**, 226 830 rows.
April decompresses to 4,95 GB → streaming ijson pre-filter → whose single-document output
was STILL 650 MB → **NDJSON** (loadMonth.ts). `/graf` map after ingest burned >900 s CPU and
never finished (quadratic core at 16 k companies) → procurement-only companies leave the
force core AND the layer is **disclosed, not drawn** (`omitted.tendersTotal` 48 647); map
now 10,5 s / 2 825 nodes. Gate green (3 016).
