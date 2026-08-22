# Money batch 016 — auditing the guard, and two refuted hypotheses

Case ① FollowTheMoney · 2026-08-22 · **pass 59**.

> Batch 015 shipped a two-axis attribution rule and left two things behind: a suspicion
> about what corrupted the live store, and 47 companies (18,04 mld. CZK) whose ownership
> the register would not name. This batch settles the first by refuting it, and chips at
> the second — and finds that the table both axes depend on disagrees with the registry it
> reads.

## 1. REFUTED: `npm run build` did not corrupt the store

Batch 015 recorded, as a suspected trigger, that the build's prerender workers had corrupted
`./.pglite` by opening a single-connection store concurrently. Tested deliberately on a
copy:

| experiment | result |
|---|---|
| copy healthy before the build | opens, reads |
| `PGLITE_PATH=<copy> npm run build` | completes, exit 0, **17 `Aborted()` loader lines** |
| copy after the build | **opens, reads — undamaged** |
| two concurrent openers, one store | **both succeed** |
| four concurrent LARGE reads (153 731 edges) | all four fail: `invalid memory alloc request size 1768780395`, `unexpected end of data` |
| the same store, single reader, afterwards | **opens, reads 153 731 edges — undamaged** |

So: concurrent PGlite connections produce **torn reads that fail loudly and leave no
damage**. The build degrades 40 loader reads to fallback (`buildLeaderboard` ×24,
`moneyLoader.loadMoneyLayer` ×16) and corrupts nothing.

**What actually broke the live store in batch 015 is unknown**, and the ledger now says so
instead of naming a cause it cannot support. The platform rule batch 015's steering proposed
— "the build needs its own copy" — is **not** justified by corruption.

Is the build's degradation a product problem? **No, measured**: every affected route is
`ƒ (Dynamic) server-rendered on demand`; the only statically prerendered route in the whole
app is `/opengraph-image`. Nothing ships fallback data to production. It is noise in the
build log — but noise that spends `reportLoaderFailure`, the honest-degradation trace, on a
non-event 40 times per build, which is how a real degradation gets scrolled past.

## 2. The table both axes depend on disagreed with the registry

`lib/analysis/public-body.ts` decides whether a company's money may be pinned on a
politician, and asks the legal form first. `PRIVATE_LEGAL_FORMS` is not a fallback — it is
an assertion that a code is *known not to be a public body*.

Two spot-checks found two defects, of different kinds, so the table was audited whole against
the ARES `PravniForma` číselník (`legal-form-audit-b16.ts`): **23 of 37 entries wrong.**

The one that matters:

> **`771` was labelled „Nadace" and filed PRIVATE. ARES says 771 is „Dobrovolný svazek
> obcí".** A voluntary association of municipalities is a public-law body — and the classic
> owner of a regional *vodovody a kanalizace* company, which this corpus is full of.

Also reclassified: **`301` Státní podnik** (label was right, classification wrong — Lesy ČR
s.p. and Povodí Labe s.p. verified via ARES) and **`941`**, labelled „Společenství vlastníků
jednotek" but actually „Evropské seskupení pro územní spolupráci". `741` turned out to be
„Stavovská organizace - profesní komora", not „Obecně prospěšná společnost"; it is genuinely
arguable, so it now sits in **neither** table and answers `unknown` for a human to rule on.
`391`/`392` were swapped (both public, so no verdict ever changed). The rest were label
drift, expiries, and two codes ARES no longer publishes.

**Does it bite today? No — and that is stated, not implied.** Measured across all 214 company
nodes, the only forms present are 112, 121 and 205, and the only recorded public owner form
is 801. No published figure was ever wrong because of this. What was wrong is the guard,
which would have failed the first time a svazek obcí or a státní podnik appeared.

The audit is now a **drift guard**: entries whose `verifiedVia` documents them as expired or
absent are ACKNOWLEDGED, so it reports 0 rather than crying wolf 6 times. Its fire rate was
validated the way the kernel requires — 23 → 7 → 0, every survivor hand-read.

## 3. Depth-2 ownership: one resolved, and a thin layer exposed

For the 48 companies whose own record names no owner, the graph's `owns_stake` layer
(dataor bulk OR export, batch 006) was consulted for the first time — the mandate sweep had
never joined the two.

**Plzeňská teplárenská, a.s. ← Město Plzeň (forma 801)** → publicly owned, **951 231 100 CZK
leaves attribution**. Its own VR record shows Město Plzeň with `datumVymazu 2018-10-31`, so
the register alone said "no current owner"; the ownership layer says the city still holds it.

Yield: **1 of 48**. Not because the method is weak but because the layer is: **33
`owns_stake` edges** for 214 companies. That is the finding — the ownership layer is too
thin to answer ownership questions at scale, and widening it is now the highest-value ingest
work in the case.

Depth is capped at **2, deliberately**: each hop weakens the claim that a company's turnover
is its parent's public activity, and a chain walked far enough reaches the state from
anywhere. One hop, with the parent named on the surface as evidence, is checkable.

**`/penize` headline: 18 368 539 501 → 17 417 308 400 CZK.** `totalCzk` unchanged.

## 4. Gate

`npm run check` green — **2 975 tests** (+7), 0 lint errors. Live-store verification through
`getMoneyData()`: headline 17 417 308 400 CZK, 4 publicly-owned companies, total unchanged
at 476 584 491 351.

## 5. Lessons

1. **A suspicion recorded in a ledger becomes a fact unless someone tries to kill it.**
   Batch 015's "the build corrupted the store" was plausible, cheap to test, and wrong. It
   took twenty minutes to refute and would have cost the next batch a platform-wide rule
   built on nothing.
2. **The expensive failure of a lookup table is the entry nobody had a source for.** Every
   defect here was invisible to tests, types and review, because a wrong label is still a
   valid string. The only thing that could find them was the registry that issues the codes.
3. **"It doesn't bite today" is a measurement, not a reassurance** — and it has to be
   reported with the defect, or a real fix reads as a crisis and a latent one reads as
   nothing.
4. **Joining two sources the platform already had beat acquiring a third.** The ownership
   layer and the mandate sweep had existed side by side for ten batches without being asked
   the same question.
5. **A thin layer gives a low yield, and the yield is the measurement of the layer, not of
   the method.** 1-of-48 is not a failed pass; it is 33 edges being asked to cover 214
   companies.
