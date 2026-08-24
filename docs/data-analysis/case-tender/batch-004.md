# Tender batch 004 — first flags, and the hand-read that rewrote two of them

Case ④ needles · 2026-08-24 · **pass 69**.

## 1. The flags, as persisted (3 876 lots of 48 647 — 8,0 % carry ≥1 flag)

| flag | fires | rate | threshold (from THIS corpus) |
|---|---|---|---|
| `single_bid` | 1 266 | 2,6 % | competitive procedure & exactly 1 bid |
| `tight_spread` | 1 057 | 2,2 % | ≥2 evaluated & spread < p10 = 4,91 % |
| `short_deadline` | 1 473 | 3,0 % | < per-competitive-class **p5** (Otevřené 29 d, ZPŘ 16 d, výzva 8 d …) |
| `exceptional_procedure` | 263 | 0,5 % | **JŘBU only** |

Each flagged node carries `flag_inputs` (the exact register numbers behind the flag) and
`flag_thresholds` (the calibration used), so a rendered signal can always show its work.

## 2. What the hand-read changed BEFORE persisting

The first computation fired 2 734 `exceptional_procedure` flags. Reading six of them showed
fence repairs and servicing under „přímé zadání … malého rozsahu" — a lawful, routine
below-limit instrument. Flagging it per lot is noise; its meaningful form is **volume per
authority** (an authority-level statistic, like `estimate_gap` in b001). The flag now fires
only on **JŘBU** — 263 lots, and the samples read like the exception the law means.

`short_deadline` at p10 flagged „30 days vs threshold 31" — the boundary of a discrete
distribution — and flagged short windows INSIDE JŘBU, whose short window is its nature.
Now **p5, competitive classes only**. Boundary-adjacent hits still exist („28 vs 29") and
stay deliberately: a flag is a signal that shows its inputs, and the reader sees exactly
how marginal it is.

`tight_spread` and `single_bid` survived the read unchanged — the tight_spread samples are
textbook cover-bidding shapes (1,6–3,4 % spreads on multi-million rámcové dohody for lift
reconstruction, road repairs, the Prague Castle facade).

## 3. Doctrine notes

- The flag names and Czech render copy stay descriptive: „jediná nabídka", „těsné rozpětí
  nabídek", „krátká lhůta", „řízení bez uveřejnění". No word implies guilt.
- Thresholds live in the payload AND on every flagged node — a threshold change re-runs
  the whole corpus (gate e), and mixed-vintage flags are structurally impossible because
  the recompute rewrites all of them.

## 4. Next (b005)

Compose the first PICTURES: per-authority (needle counts, flag mix, flagged CZK, direct-
award volume share) and per-winner (wins under flags, distinct authorities). That is the
step where thousands of needles become a shape.
