# Money batch 012 — the re-ingest, and the metric it exposed

Case ① FollowTheMoney · 2026-07-27 · sibling law/effort sessions concurrent.

> **Headline.** The contract corpus went from **2 287 capped rows to 152 702 real ones**
> (×67), which is what batch 011 asked for. But lifting the cap multiplied the `/penize`
> headline by **383× to 7.19 TRILLION CZK**, with Ministerstvo financí (4.84 tn), Praha
> and ČSOB at the top. **99.4 % of that is not attributable to any politician.** The
> re-ingest did not break the metric — it exposed that the metric was already unsound and
> the cap had been hiding it. Both landed together; a more complete number behind the same
> label would have been a worse lie than the floor it replaced.

## 1. Two traps found before writing anything

**`idSmlouvy` ≠ `idVerze`.** The plan was to key new contracts on the id in the Registr
smluv URL. Checked first: the graph's `contract:1443766` is "Mořidla" (AGROFERT, 152 000
CZK, 2017-03-08) while `smlouvy.gov.cz/smlouva/1443766` is an unrelated pharmaceutical
contract. They are two different sequences — the graph keys on **`idSmlouvy`**, the URL
uses **`idVerze`**. **Keying on the URL id would have silently duplicated the entire
corpus and doubled every CZK figure.** Confirmed by the outcome: of 2 287 existing nodes,
**2 201 matched** an `idSmlouvy` in the harvest (96 %).

**A far better source than the one proposed.** Rather than re-running the rate-limited
HTML search 149 times, Registr smluv publishes full monthly XML dumps
(`data.smlouvy.gov.cz`, 2016-05 → present, ~26 GB, 123 files). They carry three things the
search cannot: `datumUzavreni` (the signature date, matching the corpus's existing
`signedOn`), `<platce>`/`<prijemce>` flags giving **direction of money** — the exact gap
batch 011 flagged — and `platnyZaznam`, which marks superseded contract versions (13 174
of them here; counting them would have over-stated the corpus by ~8 %).

## 2. The adapter, and what measurement decided

`lib/ingest/sources/smlouvy-dump.ts` (21 tests) + a resumable harvester. Three design
choices, each settled by data rather than assumption:

- **Direction is stated in only ~18 % of records** — but among those it runs
  **25 819 recipient to 23 payer**. So a `payer` contract never receives a `supplies`
  edge (that relation asserts the company *supplied*; batch 011 found a real prison-labour
  amendment running the other way), `recipient` and `unknown` do, and **every edge carries
  `direction`** so consumers filter on what is known rather than on my assumption.
- **Matching our IČOs raw pulled 13 777 records in a single month**, mostly public bodies
  publishing their own contracts. Scoping to the counterparty side cut it ~88 %; the
  **942 917 excluded publisher-side matches are counted per IČO**, not silently dropped.
- **Values come in three incompatible shapes** (`hodnotaBezDph` 82 918, `hodnotaVcetneDph`
  36 580, `ciziMena` 2 959, none 30 245). All are stored with an `amountBasis` so a total
  can disclose that it mixes bases rather than pretending not to.

**GDPR is a condition of use, not a footnote.** The dataset's terms make the recipient a
data controller, with an obligation to propagate later withdrawals. Enforced in code: an
explicit IČO allow-list is required (an empty one refuses to run), `adresa` /
`datovaSchranka` / `schvalil` are dropped at parse time, and the harvester keeps exactly
one dump on disk and deletes it after parsing. Re-harvesting is how deletions propagate —
**86 legacy contract nodes are absent from the current dumps** and are reported, not
auto-deleted.

Six months failed mid-run on transport errors and were recorded as **retry-able, never as
zero contracts**; a resume pass completed all 123/123.

## 3. What the re-ingest did to the numbers

Measured against a snapshot taken **before** the write, not reconstructed afterwards:

| | before | after |
|---|---|---|
| contract nodes | 2 287 | **152 788** |
| supplies edges | 2 290 | **153 731** |
| companies with contracts | 149 | 170 |
| max contracts per company | **25** (35 companies at exactly 25) | 19 942 (1) |
| raw reachable CZK | 18 743 685 265 | **7 187 156 531 294** (×383) |

The cap is gone, and with it the `contractCoverage.isFloor` caveat — which retires
**itself**, because it was computed from the data rather than hardcoded. That was the
point of building it that way in batch 011.

## 4. The metric problem the re-ingest exposed

Breaking the new total down by the case's own attribution rule:

| tie class of the company | companies | contracts | CZK |
|---|---|---|---|
| owner-operator | 19 | 846 | 588 927 702 |
| manager | 16 | 8 406 | 42 304 820 229 |
| **steward** | 121 | 88 635 | **462 776 652 527** |
| **untied** (ownership parents only) | 14 | 55 844 | **6 681 486 130 836** |

**Attributable (owner-operator + manager): 42.89 bn CZK. Not attributable: 99.4 %.**

Two separate faults, both mine to fix:

1. The 6.68 tn "untied" bucket is 14 ownership parents — Ministerstvo financí, Praha,
   ČSOB, České dráhy — that have **no `linked_to` tie at all**. They had zero contracts
   before because nobody had queried them; my harvest gave them 55 844. They have no
   business in a "money reachable through MP-tied firms" figure. (The `/penize` loader
   iterates `linked_to`, so they never reach the tile — but any consumer joining
   `supplies` directly would pick them up, and the audit script did.)
2. Of what *does* reach the tile, **stewards are ~91 %**. The existing sub-label already
   warned that steward money is the institution's, but the number still included it. At
   the old capped volume that was cosmetic; at full volume it is the whole number.

**Fixed in the same batch.** `stats` now carries `contractCzkAttributable` and
`contractCzkSteward`; the tile renders the attributable figure and names the steward
total separately ("*dalších X připadá na instituce, kde poslanec jen zasedá v orgánu — to
nejsou jeho peníze*"). A test pins that the two reconcile to the whole.

## 5. Data-quality flags recorded, not silently absorbed

- **24 contracts carry an impossible `signedOn`** (the corpus contains `0002-02-25` and
  `3062-07-16`) — publisher typos. Flagged; the surfaces do not date-filter, so they are
  not currently load-bearing, but any time-window analysis must exclude them.
- **30 245 contracts state no value at all** — `null`, never coerced to 0.
- **86 legacy nodes absent from current dumps** — candidates for the GDPR deletion
  obligation, or Hlídač-only artifacts. Reported for a human decision.

## 6. Live writes (pass 41)

| write | scope | result |
|---|---|---|
| contract corpus re-ingest | 152 702 contract nodes, 153 634 supplies edges | applied; props **merged**, not replaced |

Props are merged so earlier passes' annotations survive `upsertKgNodes`, which replaces
wholesale; the ingest's own provenance is nested as `reingest_provenance` so each row's
identity provenance column is untouched. **No `review_state` touched — 211 ties remain
`pending_review`.**

## 7. Open items for batch 013

1. **The 14 untied ownership parents should not carry `supplies` edges into any
   attribution query.** Either drop them from the harvest allow-list or teach every
   consumer to require a `linked_to` tie. The loader is safe today by accident of how it
   iterates, which is not a guarantee.
2. **Direction is `unknown` for 83 % of edges.** The detail pages carry `Plátce/Příjemce`
   for more records than the dumps flag; a targeted pass on the highest-value unknowns
   would convert the biggest figures from assumed to established.
3. **Re-harvest cadence.** Dumps are retroactively corrected; `--refresh=<month>` exists.
   Decide a cadence and wire it to the Pumper watch.
4. **The subsidy channel is still unmeasured** (SZIF decides rather than contracts, so it
   is not in this corpus at all) — carried from batch 011 and now the single largest
   remaining blind spot.
5. Steward class sweep, Teplárny Brno, ČSOB, České dráhy remain UNMEASURED from batch 010.

## 8. Lessons

1. **Check the id space before a re-ingest, always.** Two id sequences that both look like
   plausible contract ids, one in the URL and one in the payload, differing by ~10 % in
   magnitude. The check cost one HTTP request; the miss would have doubled every figure in
   the module and been very hard to spot afterwards.
2. **Completing a dataset can make a metric worse.** The cap was hiding an attribution
   error, so fixing the cap made the error 383× louder. Any ingest that materially changes
   a rendered number has to re-ask what the number means — shipping the data without the
   metric fix would have been a regression disguised as an improvement.
3. **A flag computed from data retires itself.** The batch-011 floor caveat turned off on
   its own the moment the corpus stopped being capped. Had it been a hardcoded disclaimer
   it would still be there, quietly lying in the other direction.
