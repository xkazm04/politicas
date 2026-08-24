# Tender batch 009 — the pool statistic fails its hand-read, and b008 gets a correction

Case ④ needles · 2026-08-24 · no graph writes (**negative-result batch** —
payload computed and deliberately deleted; evidence `pool-stat-cpv45-*.json`,
tool kept as `pool-stat.ts` with the verdict in its header).

## 1. What was built

`pool-stat.ts`: per-authority bidder-pool concentration (avg appearances per
identified bidder, top-5 share, identified share), floors ≥ 20 lots and ≥ 50
identified entries, readability gate `identified_share ≥ 0,5` — the b008 plan's
deterministic marker for the rotation species.

## 2. Why it is not persisted

1. **The denominator does not exist for the population it targets.** 176 of 186
   measured authorities fall below the readability gate — the register
   anonymises losing bidders (the b002 `unidentified` class, 53 212 entries),
   so the pool is invisible for ~95 % of buyers, **Havířov and Moravská galerie
   included**. A marker unreadable exactly where its species lives is not a
   marker.
2. **avg_appearances confounds volume with closure.** The „closed-pool" top is
   led by ŘSD — 6 597 lots, **1 002 distinct bidders**, a DNS minitender
   machine and the *opposite* of a closed pool. Scale alone drives the ratio.

## 3. The correction to b008

b008 wrote „the SAME 4–6 bidders on every výstavnické-práce micro-lot" for
Moravská galerie. **The register does not show that.** What it shows: 4–6
*anonymous* bids per lot, and wins alternating among three named individuals.
The rotation of winners is a register fact; the composition of the bidder pool
is an inference — and this batch demonstrated it cannot be verified from RVZ
data. b008's species table stands, but its rotation marker must be built from
**winner sequences** (identified and dated), not bidder identities.

## 4. Doctrine notes

- A negative result is a loop product: the tool stays in the repo with its
  verdict in the header, the evidence file stays committed, and the next
  session cannot re-invent and re-persist the same dead end.
- **Before designing a statistic, check that its denominator is visible for the
  population it targets** — the readability gate should have been computed
  FIRST, from b002's own numbers, before any metric design.

## 5. Next (b010)

The winner-circle statistic — distinct winners, top-3 winner share, and
alternation runs over each authority's **dated win sequence** (wins are always
identified; 74 % dated) — plus the ten-batch skill reflection the session was
started for.
