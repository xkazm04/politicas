# Tender loop — STATE (resume here)

> **Regenerated every batch. Read THIS first, `ledger.md` only for history.**

**As of:** batch 006 · 2026-08-24 · last graph write **pass 72**.

## The doctrine (user-set, 2026-08-23)

Person-first analysis exhausted its register (211 ties, company axis 194/195,
everything waits on the human gate) and structurally cannot see the real loss:
**thousands of small inefficient tenders with no politician in them**. This case
inverts the direction — tender by tender, deterministic red flags, pictures
composed from volume, connection to the MP graph a bonus and never a filter.

## Campaign 1: CPV 45 (stavební práce), ISVZ record-level data 2024-12 → present

| fact | value |
|---|---|
| source | ISVZ/RVZ monthly JSON zips; record-level coverage 2024-12 → 2026-07, all 20 months in |
| corpus persisted | **2024-12 → 2026-07 · CPV 45 · 61 421 lots** (pass 70; 193 012 edges; snapshot dedupe across the whole span) |
| flags (pass 71+72) | **4 392 lots**: single_bid 1 490 · tight_spread 1 059 · short_deadline 1 557 · JŘBU 397 · repeat_winner 111 · supplier_lock 2 — thresholds from the corpus, samples hand-read every pass |
| trailing window | 365 d, evaluable only where the FULL window is inside coverage → 2 187 dated wins today, grows monthly; `supplier_lock` = majority bar 0,5 (> p99; percentile REJECTED by hand-read) |
| monopoly class | `monopoly.ts` — statutory DSOs (ČEZ Distribuce, EG.D, PREdistribuce, GasNet) skip trailing flags + leave winner listings, disclosed; PRAGOPROJEKT deliberately NOT in class |
| graph_touch | 18 MP-tied companies in the tender layer, mostly as AUTHORITIES |
| robustness | b004 thresholds held on a 26 % bigger corpus (spread p10 4,91→4,92 %, deadline p5 identical) |

## Open items

1. b007: **Havířov deep-read** — 1 553 lots / 2,2 mld. / 30 % flagged, Petr Kuš
   70/70 wins, Hornosušská stavební 19/19; read actual lots by hand, compose the
   city picture. Also look at VLAMAG Czech (121 wins / 59 % flagged / 17 M —
   the high-volume micro-lot shape).
2. Product surface for the needle picture — shapes exist now (see
   pictures-cpv45-*.json).
3. Later: second CPV campaign (72 — IT services) once the CPV 45 loop's flag
   set stabilises.

## Durable tools

`lib/ingest/sources/isvz.ts` (lot parse, tests) · `filter-month.py` (streaming CPV
pre-filter → NDJSON; ijson) · `loadMonth.ts` (the one reader) · `measure.ts` (calibration)
· `persist-month.ts` (pass-stamped writer, snapshot dedupe; re-ingest wipes flags BY
DESIGN — reflag after) · `compute-flags.ts` (6 flags incl. trailing-window; thresholds
from the corpus, hand-read samples) · `monopoly.ts` (legal-basis exclusion class) ·
`compose-pictures.ts` (authority/winner shapes, small-n floors, monopoly disclosure).
Raw months in `data/raw/isvz/` (gitignored). Next pass: **73**.
