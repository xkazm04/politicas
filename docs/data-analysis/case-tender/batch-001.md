# Tender batch 001 — the adapter, and the market's own numbers

Case ④ needles · 2026-08-23/24 · **no graph writes** (calibration batch, by design).

> The skill's rule: no flag threshold before the scoped distribution is read. This batch
> built the reader and read the distribution — and the reading corrected the design twice
> before a single flag exists.

## 1. What was built

- `lib/ingest/sources/isvz.ts` — the RVZ monthly-JSON adapter: one row per **lot**, with
  authority (IČO, category, profile), procedure, bid counts, participants (+ per-bid CZK),
  winners, spread, result, EU flag, tool ref. Register facts verbatim; no judgment in the
  module. 6 tests on a verbatim-shaped fixture.
- `scripts/case-loops/tender/measure.ts` — the calibration tool: fill rates + percentile
  distributions over the scoped corpus, flags nothing.

## 2. What the first month of CPV 45 says (VZ-06-2026 · 3 625 lots)

**Fill rates (case gate c — a flag a field cannot support must not exist):**
authority IČO 100 % · procedure 98 % · bid count 88 % · result 89 % ·
**deadline window 72 %** · estimated value **14 %** · spread computable 351 lots.

**Distributions (the future thresholds' evidence):**

| measure | n | p5 | p10 | p25 | p50 |
|---|---|---|---|---|---|
| bid count | 3 185 | — | — | — | **6** (p90 = 20) |
| deadline days (start→lhůta) | 2 596 | 8 | **11** | 16 | 29 |
| spread (max−min)/min, ≥2 bids | 351 | 2,4 % | **4,9 %** | 12,6 % | 26,7 % |
| lowest bid / estimate | 292 | — | 0,69 | — | 0,89 (p90 = 1,05) |

**Single-bid: 3,5 % overall** — construction is a *competitive* market on average (median
6 bids), which is exactly what makes single-bid a meaningful outlier here rather than a
degenerate signal. By procedure it concentrates where theory says it should:
Jednací řízení bez uveřejnění 18 % · Přímé zadání 17 % · Uzavřená výzva 8,8 % ·
open procedures 1,5–1,7 %.

**The oligopoly is visible in one month:** EUROVIA CZ 46 wins across 12 authorities,
STRABAG 36 (+23 via STRABAG SIS), SWIETELSKY 21, Metrostav CZ 18, M-SILNICE 18, PORR 17.
Concentration flags will have no shortage of material once the trailing window exists.

## 3. Two design corrections the reading forced

1. **The deadline window basis was wrong.** `historie_lhut` records carry their END always
   and their START ~13 % of the time (996 / 7 507); end−start would have "worked" for 1 %
   of lots and read like the register barely publishes deadlines. The honest, filled basis
   is **procedure start → bid-deadline end** (72 % of lots), which is also what a bidder
   actually experiences. First flag candidate `short_deadline` will use p10 ≈ 11 days.
2. **An 8-digit foreign identifier passes the IČO shape test.** The Slovak winner
   `53852869` (jiny_identifikator) is indistinguishable from an IČO by shape. The b002
   writer must gate the `company:ico:*` join on **country**, never on digits — otherwise a
   Slovak firm becomes a phantom Czech company node.

Also paid for (third time in three days): a filename stamped by string-slicing truncated at
the hour, two same-hour runs shared a name, and this case's first evidence file was
overwritten and tidied away. The stamp is now built explicitly. A lesson repeated until the
code stops inviting it.

## 4. Calibration read for the flag table (to confirm in b002–b003)

- `single_bid`: competitive procedures only (open/simplified/užší; NOT JŘBU or přímé
  zadání, which have their own flag) — fires ~1,5–4 % → healthy outlier.
- `no_open_procedure`: JŘBU + přímé zadání + uzavřená výzva above-limit — small
  populations, high single-bid shares; needs the regime axis before firing.
- `short_deadline`: < p10 (≈ 11 days) within procedure type — deadline norms differ by
  procedure, so the percentile must be computed per procedure class, not globally.
- `tight_spread`: < ~5 % (p10) with ≥ 2 evaluated bids — 351 lots/month computable.
- `estimate_gap`: only 14 % fill → per-lot flag is weak; keep as an AUTHORITY-level
  statistic instead (median bid/estimate per authority).
- `repeat_winner` / `supplier_lock`: need ≥ 12 trailing months — start computing at b003+
  once more months are ingested, on wins edges.

## 5. Next (b002)

Graph schema (`tender` kind; `procures` / `bids_on` / `wins` rels + registry keys),
insert writer in apply-batch's discipline, persist June 2026 CPV-45, verify counts through
the store. Then b003+: month-by-month accumulation backward.
