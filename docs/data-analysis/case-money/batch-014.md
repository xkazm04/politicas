# Money batch 014 — the co-signatory: 11,77 mld. Kč připsaných špatnému člověku

Case ① FollowTheMoney · 2026-08-22 · **passes 56 + 57**.

> Batch 013's steering asked for a targeted pass on the highest-value `direction: unknown`
> edges. Measuring *why* that mattered before doing it turned the item into a different,
> much worse finding — and one that had a name on it.

## 1. Triage: how much of the headline is an assumption?

`direction-triage-b14.ts` — deterministic, read-only, on a copy — partitions every
`supplies` edge by direction in three nested frames. The attributable frame is the one that
matters: it is the money `/penize` renders.

| frame | edges | CZK | of which `unknown` |
|---|---|---|---|
| whole corpus | 153 731 | 7 187 156 531 294 | **93,21 %** |
| tied companies | 97 887 | 505 670 400 458 | 47,17 % |
| **attributable (the headline)** | **9 252** | **42 893 747 930** | **66,19 %** |

The frame sum reproduces the rendered figure to the koruna, which is the check that the
census is measuring the right population and not a neighbouring one.

Two thirds of the headline rested on contracts whose direction nobody had established. And
68 % of *that* sat on a single company.

## 2. The finding: `unknown` was hiding a stated negative

Reading the top rows against the raw register:

```
contract:21554117 — 4 444 444 444 CZK, "Multifunkční hala v Brně"
  subjekt        Statutární město Brno          platce: true
  smluvní strana HOCHTIEF CZ a.s.               prijemce: true
  smluvní strana Brněnské komunikace a.s.       (bez příznaku)
  smluvní strana Teplárny Brno, a.s.            (bez příznaku)
  smluvní strana ARENA BRNO, a.s.               (bez příznaku)
```

The register names who gets the money. It is not Teplárny Brno. Yet the graph carried a
`supplies` edge from Teplárny Brno to the full 4,44 mld. Kč, `reachableMoney` read it as
money reaching the company, and the ledger attributed it to **Petr Hladík**, who chaired
its board. Four more tram-Plotní agreements (1,45–1,47 mld. Kč each) run the same way,
with IMOS Brno, STRABAG and Dopravní stavby Brno as the flagged recipients.

`directionFor` answered `unknown` because its "only the other side is flagged" shortcut was
guarded on `sides.length === 2`; on a five-sided record it declined to answer. That refusal
was right as far as it went, and wrong in what it produced: **`unknown` was carrying two
different epistemic states** — *the register said nothing* and *the register spoke, and it
did not name us*. The second is a negative fact the register asserts, and it is the whole
difference between a supplier and a co-signatory.

### The partition, priced

`direction-refine-b14.ts`, attributable frame:

| state | edges | CZK | share |
|---|---|---|---|
| flagged-recipient | 3 369 | 11 556 203 656 | 26,94 % |
| co-recipient | 117 | 1 331 071 110 | 3,10 % |
| **non-recipient** | **43** | **11 760 018 633** | **27,42 %** |
| silent (nikdo neoznačen) | 345 | 3 470 592 447 | 8,09 % |
| sole-party | 5 293 | 14 764 481 039 | 34,42 % |
| **inferred-payer** | **85** | **11 381 045** | **0,03 %** |

Concentration: 11 745 934 354 of the 11 760 018 633 non-recipient CZK — **99,9 %** — is
Teplárny Brno, and through it one MP. The other four affected MPs (Karel Haas, Miroslav
Žbánek, Marek Ženíšek, Robert Stržínek) carry between 0,3 M and 10,7 M each.

## 3. The fix, in the three places it had to go

1. **`directionFromParties`** (`lib/ingest/sources/smlouvy-dump.ts`) gains a fourth verdict,
   `non-recipient`, so the NEXT re-ingest reaches the same conclusion rather than
   re-creating the defect. `unknown` deliberately still means silence: roughly half the
   register flags nobody, and reading silence as a negative would be the exact mirror of
   the bug — it would strip real suppliers of real money. Pinned by a test on the verbatim
   hall record, including one asserting a three-sided **unflagged** record stays `unknown`.
2. **`moneyReachesCompany`** (`features/money/reachableMoney.ts` — the module that already
   owns the definition of reach) is the one predicate. Both fold sites in `moneyLoader`
   (corpus fold and per-company read) import it; the value moves into
   `CompanyContracts.excluded` instead of into `czk`. The edge is **not** deleted — Teplárny
   Brno really is a party to that contract, and a platform built on provenance may not
   delete a true relation to fix a false number.
3. **`features/graph/graphLoader.ts`** had the same defect independently: its money trail
   summed every `supplies` weight itself. Batch 013 audited this function for a *different*
   leak (untied ownership parents) and found it clean; this one was there the whole time.
   Caught by the integration fixture, not by re-reading the file.

## 4. What the surface now says

`/penize`'s headline: **42 893 747 930 → 31 122 348 145 CZK**, −11 771 399 785 (−27,44 %).
Teplárny Brno's own reach: ~23,57 mld. → 11,82 mld. Kč.

The tile states what it left out (`reachableExcluded`) rather than quietly shrinking — a
number that moves by 27 % with no explanation is indistinguishable from a data loss, and
the difference between those two is the whole brand.

**And a second silence was refused.** `co-recipient` (117 attributable edges, 1,33 mld. Kč)
is money that genuinely *does* reach the company — but the full contract value is credited
to every flagged recipient, and the register never states the split. Excluding it would
understate exactly as badly as counting it whole overstates. So it stays in the total,
carries `recipients_shared` on the edge (pass 57), and the tile names it. The batch
corrected one unstated over-count; shipping another one under it would have been the same
mistake with better arithmetic.

## 5. Graph writes

| pass | what | edges |
|---|---|---|
| 56 | `direction: non-recipient` (6 251) + `direction: payer` (3 495), with `direction_basis` and `direction_recipients` | 9 746 |
| 57 | `recipients_shared` + `recipients_shared_with` | 1 058 |

Corpus-wide, not just the tied slice, so `/graf` and the budget supplier trail read the
same fact as `/penize`. Both idempotent — the re-run after pass 56 proposed 0 of those
9 746 again, which is how the second write was verified before it was made.

**No `review_state` touched. 211 ties remain `pending_review`.**

## 6. Gate

`npm run check` green — **2 954 tests** (+9), 0 lint errors. Verified through
`getMoneyData()` itself on the live store (`verify-b14.ts`), not by re-deriving the
arithmetic: two copies of my own assumption agreeing proves nothing.

## 7. Lessons

1. **An `unknown` that spans two epistemic states is a bug, not a hedge.** "No data" and
   "data that says not us" were one token, and the conflation was worth 27 % of a headline.
   Any refusal-to-answer worth trusting has to say *which* refusal it is.
2. **Delegating to the shared rule can be wrong if the caller's data is shaped differently.**
   Pointing the census at the adapter's `directionFromParties` — the correct instinct, one
   rule not two — silently moved 101 of 128 edges back into `silent`, because the stored
   party list is one side short and the adapter's two-party shortcut fired on a record that
   only *looked* two-sided. Fixed by re-attaching the publisher as an unflagged party. An
   inference over incomplete data may only make a verdict weaker, never stronger, and the
   argument that enforces it is now required (`refineState(parties, ico, publisherIco)`).
3. **A defect found in one consumer is a question about every consumer.** `graphLoader` had
   been audited for a neighbouring leak eight batches ago and passed. Reading the file again
   would not have found this; the outsized fixture did.
4. **A hang in the harness read as a defect in the product.** Verification against the
   live store started taking >10 minutes and I got as far as writing a steering item
   blaming `getMoneyData()`. The real cause: a script that opens PGlite and never exits
   (the event loop stays open, so it prints and hangs), plus five orphaned node processes
   from the runs I had killed, each still holding the data directory. `getMoneyData()`
   runs in seconds. Two corollaries — `process.exit(0)` belongs in every case-loop script
   that opens the store, and it must sit in `.then()`, because `main(); process.exit(0)`
   exits before the promise resolves and prints nothing at all while exiting 0.
5. **The measurement that justifies the work is worth more than the work.** Batch 013's
   steering asked for a direction pass on high-value unknowns — plausible, and it would have
   spent a research army on the "silent" 8 % while the 27 % sat in the flags we already had.
