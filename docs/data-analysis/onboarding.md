# Data-layer onboarding — politicas

Founding session, 2026-07-23. This replaced the illustrative mock in `lib/civic/`
for one real vertical slice: a typed `Store` over embedded Postgres, a real
ingest of Poslanecká sněmovna open data, a deterministic quality harness, and a
DataHub metadata catalog. The mock layer is untouched and stays clearly labelled
as mock until a surface is ported onto the store.

## What real data landed

Direct bulk download from **Poslanecká sněmovna** open data
(`https://www.psp.cz/sqw/hp.sqw?k=1300`), UNL format, windows-1250, licence
"free of charge, cite the source". Two dumps, term **PSP10** (chamber opened
2025-10-04):

| Entity | Rows | Source |
|---|---|---|
| person | 7,045 | poslanci.zip (osoby.unl) — full historical registry back to 1992 |
| organ | 1,790 | poslanci.zip (organy.unl) — chambers, clubs, committees, regions, party lists |
| mandate | 2,157 (207 in PSP10) | poslanci.zip (poslanec.unl) |
| membership | 42,261 | poslanci.zip (zarazeni.unl) — person ↔ organ/function, time-bounded |
| vote_event | 2,030 | hl-2025ps.zip — PSP10 roll calls |
| vote_ballot | 406,000 | hl-2025ps.zip — one row per MP × roll call |
| absence | 6,425 | hl-2025ps.zip (omluvy.unl), term-scoped |
| source_release | 17 | Pumper mirror (see below) |

**467,725 rows total**, ingested in ~20–27 s (cached dumps). Provenance
(`source`, `source_url`, `fetched_at`, `ingest_run_id`) + a verbatim `raw` JSONB
travel on every entity row; ids are natural keys `psp:<table>:<id>`.

### Registr smluv (ISRS) — `lib/ingest/sources/smlouvy.ts`

Added money batch 009 (2026-07-27). Per-IČO contract search against
**smlouvy.gov.cz**, **no API token required** — which matters because
`HLIDAC_API_TOKEN` has been absent from `.env` for the whole project and had been
treated as the only contract-side path.

`GET /vyhledavani?party_idnum=<8-digit IČO>&all_versions=0`. Three properties of
this source shape the adapter and are easy to get wrong:

- **`party_idnum` matches only the NON-PUBLISHING party** ("IČO smluvní strany");
  `subject_idnum` is the publisher side. A sweep on `party_idnum` alone therefore
  misses every contract the swept company published itself — negligible for a
  private supplier, a real gap for any company that is itself a publishing
  authority. (An earlier note here claimed it matched either party; that was
  never tested until money batch 011 disproved it.)
- **Direction of money is NOT in the search row.** Only a minority of contracts
  carry an explicit `Plátce / příjemce` label, and it lives on the detail page.
  A hit means "was a counterparty to a published contract", never "was paid
  public money" — batch 011 found rows running the other way (a prison-labour
  amendment where the company pays the state). Read direction per contract from
  the underlying document before describing any row as public money received.
- **There is no structured export.** `&export=1|xml|csv` all return the same
  HTML. It is scraping or nothing, so the parser fails loud on header drift
  rather than mis-reading a shifted column into a contract value.
- **Pagination is a Nette session signal, not a query parameter.** A
  `do=searchResultList-setLimit` request only takes effect as a *second* request
  carrying the first response's cookie; a bare limit param is silently ignored.

`Neuvedeno` (value not stated) parses to `null`, never `0`. The site rate-limits
(429) an unthrottled sweep within a handful of requests, so callers must pace
themselves — see `scripts/case-loops/money/parent-contract-sweep.ts`, which
records a 429 as an explicit query failure and never as "no contracts".

**Coverage note this adapter exists to fix:** the graph's `supplies` edges cover
only the 149 companies the original money feed queried (all of them MP-tied), out
of 215 company nodes — so most of the company population has never been asked
about contracts at all.

### Registr smluv BULK dumps — `lib/ingest/sources/smlouvy-dump.ts`

Added money batch 012. The per-IČO search above is rate-limited, carries no
signature date and — decisively — **no direction of money**. The bulk export has
all three. Index at `https://data.smlouvy.gov.cz/`, monthly
`dump_<YYYY>_<MM>.xml`, 2016-05 → present, ~26 GB total (~7–185 MB per file).

Four things measured once, recorded so nobody re-derives them:

- **`idSmlouvy` is the graph's contract key, `idVerze` is the URL's.** They are
  different sequences. `contract:1443766` = `idSmlouvy` 1443766 = "Mořidla"
  (AGROFERT, 2017-03-08); `idVerze` 1443766 is an unrelated contract. **Keying a
  re-ingest on the URL id silently duplicates the entire corpus.**
- **Direction is in the data**: `<subjekt>` and each `<smluvniStrana>` may carry
  `<platce>` / `<prijemce>`. Stated in only ~18 % of records; among those,
  recipient:payer ≈ 95:5. Absence is `unknown`, never an assumed direction.
- **Values are three incompatible shapes** — `hodnotaBezDph`,
  `hodnotaVcetneDph`, or a `ciziMena` pair. Summing across them is wrong, so each
  is stored separately alongside an `amountBasis`.
- **`platnyZaznam=0` marks superseded versions** (~8 % of rows). Counting them
  over-states the corpus.

**GDPR is a condition of use, not a footnote.** The publisher states the dataset
contains personal data and that the recipient becomes a data controller, with an
obligation to delete records later made inaccessible. The adapter therefore
requires an explicit IČO allow-list (no bulk corpus is retained), drops
`adresa` / `datovaSchranka` / `schvalil` at parse time, and the harvester keeps
exactly one dump on disk at a time. Re-harvesting is how withdrawals propagate.

Harvest + persist: `scripts/case-loops/money/{harvest-contract-dumps,
persist-contract-harvest}.ts` — resumable, and a contract where our company is
the **payer** is never given a `supplies` edge.

## Database — pglite (embedded Postgres)

`@electric-sql/pglite` behind a typed `Store` interface (repository pattern),
`lib/db/`. Chosen because politicas is an entity GRAPH: club resolution is a
recursive walk through the organ tree, open-data payloads are heterogeneous
(JSONB), and validity is an arithmetic check over 406k ballots — all native in
Postgres, none native in SQLite. `CORE_DDL` in `pglite-store.ts` is authoritative;
`lib/db/migrations/0001_civic_graph.sql` is a reference snapshot for the eventual
hosted-Postgres move.

Two pglite caveats handled explicitly:
- **Single connection.** The instance is memoised on `globalThis`; analysis
  scripts read a COPY of `.pglite` (`PGLITE_PATH=./.pglite-copy`), never a 2nd
  connection to the live dir.
- **No `unaccent` extension.** Czech diacritics are folded to ASCII at ingest
  into `*_norm` columns (`lib/ingest/normalize.ts`) that carry their own btree
  index — never folded at query time.

### One real bug found and fixed (durability)

PGlite (WASM) returned **inconsistent query results and silently dropped writes**
when fed the 406k-ballot table in ~6,600-row single-statement INSERTs under
cumulative load: `select count(*)` reported the right number while an ordered
`select … limit` from the same table returned zero rows, and a later small
`ingest_run` UPDATE never reached disk. Reproduced deterministically and fixed by
capping statement width to ≤500 rows / ≤30k bind params (`upsertMany` in
`pglite-store.ts`). At that size the same ingest is fully durable and consistent.

## Pumper — how it was used

Wired end-to-end, but deliberately for what Pumper is good at rather than forcing
the primary path through it. Two generic apps:
- **extractor** — a params-supplied RuleSet (`each` over the release-page file
  table) parsed the psp.cz open-data index into a machine-readable manifest
  (file, href, description) → `extractor/extracted`.
- **watch** — fingerprinted the release page (sha256 + char count) → `watch/pages`.

Both were enqueued via `POST /apps/{name}/jobs`, and their datasets were mirrored
into the corpus via `GET /datasets/{app}/{dataset}/export?format=json`
(`lib/ingest/sources/pumper.ts`, following the reference adapter) into
`source_release`. This is what makes the direct psp.cz download's **staleness
detectable** — the dumps carry no version or diff feed, so "did a new dump appear
/ did the release page change" is only answerable from the Pumper mirror.

**Why the bulk dumps do NOT go through Pumper:** they are binary ZIPs of
windows-1250 UNL (0.4–3 MB). Pumper's generic apps are HTML→Markdown / DOM
extractors; a ZIP would gain nothing and lose the byte-exact archive. And a real
defect makes it necessary to decode ourselves — see the SPEC below.

### SPEC for Pumper (reported, not worked around)

Pumper's HTML fetch does **not honour the `charset=windows-1250`** that psp.cz
declares. Czech letters outside latin-1 (ě ř č š ž ů) arrive as U+FFFD. All 17
mirrored `source_release` rows carry mangled text — they are **flagged
(`_mangled`), never guess-repaired** (a civic dataset must not contain characters
nobody published), and the `validity` criterion on that slice is 0 **by design**
as the honest signal of the defect. The authoritative Czech text comes from the
direct UNL download, which the ingest decodes with `TextDecoder("windows-1250")`.
Requested fix: honour the HTTP `Content-Type` charset (or `<meta charset>`) in
the tiered fetcher's Markdown path before storing `readable`/`watch`/`extractor`
text.

## Analysis harness — the six criteria, ported

Same six universal criteria as the reference corpora (completeness, freshness,
categorization, validity, richness, volume), so composites compare across repos.
The arithmetic is byte-identical; the per-entity MEANING is the politicas
interpretation, documented next to each predicate in `lib/analysis/quality.ts`
and as documented fields on the DataHub `slice_quality` dataset.

- **`slice-stats.ts`** — the single source of truth for numbers. A slice is
  `source × term × entity`; it writes `stats.json` + bounded per-slice row files.
- **`quality.ts`** — the deterministic scorer.
- **`verdict.ts`** — the `AnalysisVerdict` schema + a dependency-free validator
  that rejects invented dimensions and (with `--rows`) cited entity ids that are
  not real rows in the slice.
- **`promote-verdicts.ts`** — writes the DETERMINISTIC `slice_quality`; subagent
  scores are never written as the trusted number, only cross-checked against it.

### Deterministic scores (all 8 slices)

| Slice | Rows | Composite |
|---|---|---|
| psp-hlasovani×PSP10×absence | 6,425 | 5.0 |
| psp-poslanci×all×organ | 1,790 | 4.6 |
| psp-poslanci×all×person | 7,045 | 4.5 |
| psp-poslanci×PSP10×membership | 1,334 | 4.5 |
| psp-hlasovani×PSP10×vote_ballot | 406,000 | 4.5 |
| psp-hlasovani×PSP10×vote_event | 2,030 | 4.2 |
| psp-poslanci×PSP10×mandate | 207 | 3.8 |
| pumper-psp-opendata×all×source_release | 17 | 3.8 |

## What the analysis found (2 slices through the verdict gate)

Both verdicts (`docs/data-analysis/verdicts/`) passed the deterministic gate with
entity-id membership checking.

**psp-hlasovani×PSP10×vote_event** (composite 4.2)
- Vote-tally integrity is **perfect**: `yes+no+abstain+notVoting == present` on
  100% of 2,030 rows — an internal-consistency proof, not just referential.
- **16 voided (zmatečné) roll calls** must be excluded from any discipline /
  attendance metric — legally disregarded; counting them fabricates rebellions.
- **Short titles empty corpus-wide** for the current term → richness capped at 1
  (structural publisher gap, not a scrape target).

**psp-poslanci×PSP10×mandate** (composite 3.8)
- **Current-term MP contacts empty on all 207 mandates** (email/web/facebook 0/207)
  while 203/207 have photos — upstream-absent, not un-scraped; "backfill email"
  is not a fix.
- **Club ≠ elected party-list**: every mandate resolves to a parliamentary club
  through the organ tree, kept separate from the party list it was elected on —
  conflating them is the classic Czech-politics error and would mis-attribute
  discipline. Categorization scores the club, never the party list.
- 207 mandates for 200 seats reflects mid-term replacements — any seat count must
  dedupe on the current holder.

## DataHub

Platform `urn:li:dataPlatform:politicas`, env PROD, local GMS `:8080` (no auth).
Metadata only — no civic rows. `datahub-sync.ts` published **17 datasets** (8
corpus entities + 8 slices + 1 `slice_quality` rubric) across **61 aspects**:
`DatasetProperties` (source known-issues + corpus rules + deterministic stats as
customProperties), `SchemaMetadata` (the scoring rubric as documented fields),
`DatasetProfile`, `Operation`, and `UpstreamLineage`
(`pumper.{extractor.extracted,watch.pages}` → `corpus.pumper-psp-opendata.source_release`;
each corpus entity → its slices; `slice_quality` ← all corpus datasets).
`dh-context.ts` reads it back for the catalog-context analysis arm (pages the
scroll endpoint at 10 — the local GMS returns an empty body above that).

## Honest gaps

- **One term only (PSP10).** The adapter is term-parameterised (`--term=`) and
  the organ/person registries are already full-history, but only the current
  term's votes/ballots/absences are ingested. Earlier terms are a re-run away.
- **The two verdicts were author-then-gated, not Sonnet-subagent-authored.** The
  enforced contract is the gate (schema + entity-id membership), which is
  identical regardless of author; the subagent fan-out is wired into the skills
  but not exercised this session (the available subagent tooling is agent-team,
  heavier than this bounded pass warranted).
- ~~**No FollowTheMoney data.**~~ **RESOLVED 2026-07-24.** Registr smluv / ARES / Hlídač
  were ingested; the money layer (196 companies, 2 287 contracts, 260 human-gated
  `linked_to` ties) plus the legislation layer (141 bills, 101 laws, 150 `amends`) and the
  per-MP contribution index are now materialized into `kg_*` — the "golden trio" cases (see
  [[graph-schema]] track note, [[coverage-ledger]]). This founding-session doc predates that
  work; it is retained as the record of the *initial* vertical slice.
- **Pumper mirror text is unusable for display** until the charset SPEC above is
  fixed; today it serves only as a change-detection / staleness signal.
- **membership carries a far-future placeholder date** (a 'Předseda' row dated
  year 2925, a 2025 typo) — surfaced and flagged, not corrected in source.
