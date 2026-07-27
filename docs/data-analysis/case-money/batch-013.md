# Money batch 013 — the consumers the re-ingest broke

Case ① FollowTheMoney · 2026-07-27 · a fix batch. **No graph writes** (no pass number).

> Batch 012 asked to fix one thing — ownership parents with no `linked_to` tie carrying
> 6.68 tn CZK into attribution queries. Tracing every consumer of `supplies` first turned
> up **two worse defects that the re-ingest had already caused**, both silent, both mine.

## 1. Systematic silent truncation (the severe one)

`features/money/moneyLoader.ts` and `getVerificationData.ts` read
`listKgEdges({ rel: "supplies", limit: 100_000 })` and
`listKgNodes({ kind: "contract", limit: 100_000 })`. Batch 012 grew those to **153 731
edges and 152 788 nodes**.

The loss was not random. Both listers `order by` (`id`, and `src, rel, dst`), so the read
returned the first 100 000 rows **in id order** — every company whose id sorted late lost
*all* of its contracts, on the surface whose entire promise is that its numbers are real.
Nothing anywhere said so.

Three fixes, smallest blast radius first:

- **`warnIfTruncated` in the kg repository.** Any list read whose result exactly equals its
  limit now logs loudly that it is probably truncated *and systematically so*. It cannot
  distinguish "exactly at the limit" from "truncated", so it warns on both — the false
  positive is cheap, the miss is not. This is the kernel's no-silent-truncation rule
  enforced in the one place every caller passes through.
- **`lib/db/readCap.ts` — one shared `KG_READ_CAP`.** Callers had been passing ad-hoc caps
  (100 000 here, 200 000 there, 10 000 elsewhere). Now the next ingest that outgrows the cap
  trips one guard and is fixed in one place, instead of degrading three surfaces
  differently. Set far above the corpus, not snugly above it.
- `/graf`'s loader had ~11 % headroom left on its 200 000 edge cap — it would have broken
  silently on the next ingest. Same constant now.

## 2. `/graf` would have shipped 153 715 nodes to the browser

`getMapData` built a canvas node for **every** entry in the index, contracts included. At
2 287 contracts that was a landscape; at 152 788 it is a ~20 MB payload of identical dots.

The contract layer is now bounded per supplier (`MAP_CONTRACTS_PER_SUPPLIER = 12`, chosen
deterministically by id so the picture is stable between loads), and **`MapData.omitted`
carries `contractsShown` / `contractsTotal` / `perSupplierCap`** — the map states what it
is not showing rather than implying it is the whole graph.

A second, older defect fell out of the same change: the canvas emitted edges to nodes it
had never drawn (the fixture's ghost `linked_to` points at a company node that does not
exist). Edges are now restricted to drawn nodes, and a test pins that the ghost is gone.

## 3. The untied parents — the original ask

`moneyLoader` now exposes **`tiedCompanyIds`**, derived once from `linked_to`, with
`contractsByCompany` documented as *containing untied companies* and unusable whole.

`getMoneyData` was already safe — it iterates `linked`, so untied parents never reached the
tile — but that was **an accident of how it happened to iterate, not a guarantee**, which
is exactly what the batch-012 steering flagged. It is now a guarantee: a fixture seeds an
untied ownership parent holding **900 000 000 CZK** (chosen to dwarf every tied company, so
any leak is unmissable) and a regression test asserts that figure never appears in
`contractCzkReachable`, `contractCzkAttributable`, `contractCzkSteward`, or the ledger.

`features/graph/graphLoader.ts` was checked too: its `companyMoney` map is only ever read
through `companiesOf`, which is built from `linked_to`, so untied parents cannot enter a
trail. Verified rather than assumed.

## 4. Gate

`npm run check` green — **511 tests** (+2 guards, +1 census update) — and `npm run build`
succeeds. No `review_state` touched; no graph write at all.

## 5. Lessons

1. **An ingest's blast radius is its consumers, not its data.** The re-ingest itself was
   correct and verified; what it broke was three readers that had encoded the old corpus's
   size as a constant. Growing a dataset by 67× should trigger a sweep of everything that
   reads it, as a rule, not as an afterthought.
2. **"Safe by accident" is a bug waiting for a refactor.** The loader did the right thing
   for a reason nobody had written down and no test protected. Naming the invariant
   (`tiedCompanyIds`) and pinning it with a deliberately outsized fixture costs minutes;
   discovering the leak later costs credibility.
3. **A limit that equals the row count is indistinguishable from success.** The only
   robust defence is to treat "result == limit" as suspicious at the boundary, because by
   the time it reaches a caller the information is gone.
