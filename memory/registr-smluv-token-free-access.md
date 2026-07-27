---
name: registr-smluv-token-free-access
description: Registr smluv (smlouvy.gov.cz) is queryable per-IČO with NO token — but it has no structured export and its pagination is a Nette session signal, not a query param.
metadata:
  type: reference
---

`HLIDAC_API_TOKEN` has been absent from `.env` for the whole project, which
blocked contract-side work for several money batches. It need not: Registr
smluv (ISRS) answers per-IČO queries token-free.

- `GET https://smlouvy.gov.cz/vyhledavani?party_idnum=<8-digit IČO>&all_versions=0`
- `party_idnum` ("IČO smluvní strany") matches **only the NON-publishing party**;
  `subject_idnum` is the publisher side. Sweeping `party_idnum` alone misses
  contracts the company published itself — irrelevant for a private supplier, a
  real gap for a publishing authority. (Batch 009 asserted "either party"
  untested; batch 011 disproved it with a decisive query.)
- **Direction of money is NOT in the search row.** Only a minority of contracts
  carry a `Plátce / příjemce` label, and only on the detail page. A hit means
  "was a counterparty", never "was paid" — rows genuinely run both ways (batch
  011: a prison-labour amendment where the company pays the state). Read the
  document before calling any row public money received.
- **No structured export.** `&export=1|xml|csv` all return the same HTML
  (verified 2026-07-27) — it is HTML scraping or nothing.
- **Pagination is a Nette session signal**, not a stateless parameter: a
  `do=searchResultList-setLimit` / `-setOffset` request only takes effect as a
  *second* request carrying the first response's cookie. A bare limit param is
  ignored (still 10 rows).
- **It rate-limits (429) hard** — an unthrottled sweep dies within a handful of
  requests. Pace it (~12 s between IČOs) and back off; never let a 429 be
  recorded as "no contracts".

## The bulk dumps are better than the search — and have one lethal trap

There is a full open-data export (documented at `/stranka/otevrena-data`, index at
`https://data.smlouvy.gov.cz/`): monthly `dump_<YYYY>_<MM>.xml`, 2016-05 → present,
~26 GB. It carries what the HTML search cannot: `datumUzavreni` (signature date),
both parties with IČO, and `<platce>`/`<prijemce>` flags giving **direction**.

**THE TRAP: `idSmlouvy` ≠ `idVerze`.** The graph's `contract:<n>` ids are
**`idSmlouvy`**. The web URL `/smlouva/<n>` and the dump's `<odkaz>` use
**`idVerze`**, a different sequence. Verified: `idSmlouvy` 1443766 is "Mořidla"
(AGROFERT, 2017-03-08, matching our node exactly); `idVerze` 1443766 is an
unrelated pharmaceutical contract. **Keying a re-ingest on the URL id silently
duplicates the whole corpus.** Batch 011's party-search sweep recorded `idVerze`
under the name `contractId` for this reason.

Other dump facts worth not re-deriving: `platnyZaznam=0` marks superseded
versions (~8 % of rows); values come as `hodnotaBezDph` OR `hodnotaVcetneDph` OR
a `ciziMena` pair and are **not summable together**; direction is stated in only
~18 % of records, and among those it runs recipient:payer ≈ 95:5. The dataset
carries personal data and its terms make the recipient a **GDPR controller**,
with an obligation to propagate later withdrawals — so harvest against an
explicit IČO allow-list and re-harvest periodically rather than keeping a static
bulk copy.

Adapters: `lib/ingest/sources/smlouvy.ts` (per-IČO search),
`lib/ingest/sources/smlouvy-dump.ts` (bulk). Sweeps:
`scripts/case-loops/money/{parent-contract-sweep,harvest-contract-dumps}.ts`.

**Why:** it removes the token blocker from the largest un-answered question in
Case ① — `supplies` covers only the 149 companies the old money feed queried,
so most of the company population has never been asked about contracts at all.

**How to apply:** reach for this before treating any contract-side question as
blocked on a token. Related: [[ico-node-id-canonical-form]].
