# Tender batch 006 — twenty months, and the percentile that lied about locks

Case ④ needles · 2026-08-24 · **passes 70–72**.

## 1. The backfill: 2024-12 → 2026-07, one corpus

Thirteen new months (VZ-12-2024 … VZ-12-2025) downloaded, streamed to NDJSON, and
persisted **together with the seven 2026 months in one chronological run** (pass 70) —
the only way the last-snapshot-wins dedupe is correct across the whole span:
111 616 scoped rows → **61 421 lots**, 1 534 new companies, 193 012 edges. The re-ingest
deliberately wiped the pass-69 flags (`persist-month.ts` header now says so): gate (e)
forbids mixed-vintage flags, so any corpus change is ingest-then-reflag. Pass 71 re-ran
the four b004 flags over the full corpus — **thresholds barely moved on a 26 % bigger
corpus** (spread p10 4,91 → 4,92 %; per-class deadline p5 identical), the first robustness
check the calibration has passed.

## 2. Trailing-window flags (pass 72) — and the hand-read that killed a percentile

`decided_on` fills 74 % and reaches back to **2017** (snapshot files carry old
procedures), so a 365-day window is only honest where coverage is complete: flags evaluate
only wins with `decided_on − 365 d ≥ 2024-12-01` — **2 187 evaluable wins** today, growing
every month. Denominators count dated wins only (`dated_wins_only: true` in the inputs).

- **`repeat_winner`** (≥ p95 = 20 prior same-authority wins in 365 d): 111 fires, and the
  samples are the doctrine verbatim — a housing office handing its **41st–46th** flat
  renovation of the year to the same firm („Oprava volného bytu…", 2×–3× the same IČO in
  one December).
- **`supplier_lock`**: the corpus-percentile approach **failed the hand-read**. p90 of the
  lock-share distribution is 0,125 — it flagged „3 wins of 23" as a lock. Locks are tail
  events; a percentile lands in ordinary territory by construction. The flag now demands a
  **majority** (share ≥ 0,5, above the corpus p99 = 0,32, distribution disclosed in the
  report) over ≥ 10 dated authority wins: **2 fires**, both a 10/10 crane-work dominance
  at ČEZ power-plant call-offs. Tiny and true beats large and mushy.

## 3. The monopoly-counterparty class (`monopoly.ts`)

Defined by **legal basis, not corpus membership**: statutory network operators
(ČEZ Distribuce, EG.D, PREdistribuce, GasNet — § 47/§ 70 energetického zákona; přeložky
are single-source by law). Their wins skip trailing-window flags and leave the winner
signal listings; `compose-pictures.ts` prints and stores them in a disclosed
`monopolyCounterpartiesExcluded` section (ČEZ Distribuce 132 wins/107 flagged, EG.D
29/27). **PRAGOPROJEKT ← ŘSD stayed OUT of the class deliberately** — framework-agreement
concentration is a real shape a reader should see; classing it away would launder it.

## 4. The 20-month pictures

Havířov holds its profile at scale (1 553 lots / 2,2 mld. / 30 % flagged). The dependence
list gains names at 100 %: inkasta ← Plzeň (12/12), Odolovská stavební ← Vězeňská služba
(15/15), Petr Kuš ← Havířov now **70/70**. New in the flagged-winner top after the
monopoly exclusion: VLAMAG Czech — **121 wins, 59 % flagged, 17 M CZK total** — the
high-volume micro-lot shape, a different animal from the framework giants.

## 5. Lessons

1. **A percentile threshold presumes the signal is common enough to have a quantile.**
   For tail-shaped signals (locks), calibrate a legibility threshold *against* the
   disclosed distribution instead (0,5 > p99), as b004 did with JŘBU.
2. **A trailing window needs its full length inside coverage** — else the flag fires on
   an artifact of the archive's left edge. `COVERAGE_START + WINDOW` is the gate.
3. **Exclusion classes are defined by law, not by data** — and each exclusion decision
   (EG.D in, PRAGOPROJEKT out) is written down with its reason.

## 6. Next (b007)

Havířov deep-read: the city's 1 553 lots, its two 100 %-dependent suppliers, Petr Kuš's
70 wins, and the flag mix — read actual lots by hand, compose the city picture.
