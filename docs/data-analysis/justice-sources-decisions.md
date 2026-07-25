# Justice open-data sources — court decisions & justice statistics

Research session, 2026-07-25. Assesses two Czech justice open-data sources for
value to the golden-trio case loops (`docs/case-loops.md`): **Source C**
(`rozhodnuti.justice.cz` — anonymized court decisions) and **Source D**
(`msp.gov.cz` — aggregate justice statistics). Format follows
[[budget-sources]] (BudgetMirror precedent). Samples in
`.justice-samples/` (gitignored): `opendata-years.json`,
`opendata-2025-months.json`, `opendata-2025-1-days.json`,
`opendata-2025-1-2-decisions-page1.json` (100-decision page), 15×
`doc_<uuid>.json` full decision documents, `ceske-soudnictvi-2020.pdf`
(7.6 MB annual report sample).

Every URL below was fetched/curled live on 2026-07-25 unless flagged.

---

## Verdict up front

| Source | Verdict | Effort | Consumes |
|---|---|---|---|
| **C — rozhodnuti.justice.cz** (court decisions) | **INGEST** — statute citations are directly machine-joinable to `law:sb:<n>-<rok>` nodes at an 85% parse rate on the "zákon" citation form. Corpus is civil-judgment-only (not commercial/insolvency), company names and IČOs are anonymized out — kills the ① money angle, but ③ law gets real judicial-application evidence per statute. | **M** for a first slice (date-range crawl + citation parser); **S** incremental (daily deltas) | ③ Law forensics (statute-citation enrichment). Money case: **skip**, verified negative. |
| **D — msp.gov.cz justice statistics** | **WATCH, don't ingest** — confirmed CONTEXT-grade: per-court/per-agenda/per-year aggregates in PDF/DOCX/XLSM, no entity or statute linkage found anywhere in the portal family (Infodata, KrimiData). Useful as narrative backdrop numbers only ("X% of civil suits are debt collection nationally"), never as a graph fact. | **S** if ever pulled (one annual XLSM, a few numbers) | None currently — no case loop needs national-aggregate justice stats yet. |

---

## Source C — rozhodnuti.justice.cz (court decisions)

### Corpus scope

- **Legal basis**: novela zákona o soudech a soudcích, effective **1.7.2022**,
  first mandating comprehensive publication of **first-instance civil
  decisions**, plus (criminal) only the **bribery sections** (§331–§334 tr.
  zákoníku) — cited as "3 sections out of >60,000 criminal decisions/year, 91
  decisions". *(Source: search summary of iROZHLAS/Advokátní deník coverage,
  verified 2026-07-25 — see Sources below; the primary law text was not
  independently opened this session.)*
- **Verified via the API's own year index** (`GET
  https://rozhodnuti.justice.cz/api/opendata`, 200, JSON):

  | Year | Decisions (`pocet`) |
  |---|---|
  | 2020 | 797 (pilot) |
  | 2021 | 150 939 |
  | 2022 | 181 862 |
  | 2023 | 85 463 |
  | 2024 | 61 207 |
  | 2025 | 71 528 |
  | 2026 (partial, to date) | 42 230 |

  The 2020→2022 jump matches the 1.7.2022 mandate; the 2021 number likely
  reflects backfill/pilot participation before the obligation was binding, and
  the 2022→2023 drop the initial-backlog-then-steady-state pattern. **Not yet
  cited**: total corpus size across all years (~594k decisions summed from the
  table above, 2020–2026 partial).
- **Courts covered**: sampled decisions span **okresní soudy** (district,
  the overwhelming majority), **obvodní soudy** (Prague districts), and
  **městský soud v Brně** (functions as the okresní-level court for Brno). No
  krajský/vrchní-soud (appellate) decision appeared in the 100-item sample
  pulled, though the NKOD dataset description below states krajský/vrchní are
  also in scope — likely appellate confirmations/reversals are a smaller
  share.
- **Case types in the sample are overwhelmingly consumer debt collection and
  divorce** (`predmetRizeni`: "o zaplacení N Kč s příslušenstvím",
  "rozvod manželství") — consistent with "first-instance civil" scope, i.e.
  **no commercial-register (Cm), insolvency, or criminal (beyond bribery)
  decisions were observed**, confirming the law's narrow criminal carve-out.

### API shape (verified live)

Four hierarchical GET endpoints, no auth, no key:

```
https://rozhodnuti.justice.cz/api/opendata                  → years [{rok, pocet, odkaz}]
https://rozhodnuti.justice.cz/api/opendata/{rok}             → months [{rok, mesic, pocet, odkaz}]
https://rozhodnuti.justice.cz/api/opendata/{rok}/{mesic}     → days [{datum, pocet, odkaz}]
https://rozhodnuti.justice.cz/api/opendata/{rok}/{mesic}/{den} → decisions, paginated 100/page, {items:[...]}
https://rozhodnuti.justice.cz/api/finaldoc/{uuid}             → one full decision document, JSON
```

Verified samples (saved in `.justice-samples/`):
- `opendata-years.json` — 200, 596 B
- `opendata-2025-months.json` — 200, 1159 B, 12 months
- `opendata-2025-1-days.json` — 200, 2533 B, daily counts for Jan 2025
  (highly bimodal: ~300–400/day on weekdays, single digits on some days —
  suggests per-judge/per-court batch publication, not uniform)
- `opendata-2025-1-2-decisions-page1.json` — 200, ~60 KB, 100 decisions for
  2025-01-02
- 15× `doc_<uuid>.json` — full decision documents, 20–25 KB each

No documented paging beyond `page=N` on the daily listing; no filter
parameters observed for court, case type, or date range within a
month/day (must walk year→month→day→page). **Bulk ZIP/dump was not found** —
this is a page-at-a-time REST crawl only, unlike MONITOR's bulk extracts.
Licence: **CC BY 4.0**, confirmed via the NKOD catalog entry (`data.gov.cz`
dataset `00025429/1525174511`, "Rozhodnutí okresních, krajských a vrchních
soudů", publisher Ministerstvo spravedlnosti, "continuously updated").

### Metadata schema (per decision, from the daily listing)

```json
{
  "jednaciCislo": "7 C 219/2024-31",
  "soud": "Okresní soud v Pardubicích",
  "autor": "Mgr. Jitka Nováková",
  "ecli": "ECLI:CZ:OSPU:2024:7.C.219.2024.1",
  "predmetRizeni": "o určení vlastnictví k motorovému vozidlu",
  "datumVydani": "2024-10-22",
  "datumZverejneni": "2025-01-02",
  "klicovaSlova": ["smlouva kupní"],
  "zminenaUstanoveni": ["§ 7 vyhl. č. 177/1996 Sb.", "§ 2079 z. č. 89/2012 Sb.", "..."],
  "odkaz": "https://rozhodnuti.justice.cz/api/finaldoc/1073b124-cfe3-462c-9ee8-2195a8617eff"
}
```

Judge name (`autor`) and full ECLI identifier are **not anonymized** —
consistent with the NKOD note "judge names remain unredacted". `soud` is the
deciding court, plain text, not anonymized (needed to identify the court, not
a private party).

### The statute-citation join — verified machine-joinable

`zminenaUstanoveni` is the field of interest for Case ③. Parsed the full
100-decision sample (`opendata-2025-1-2-decisions-page1.json`, 548 total
citation strings) with regex `z\.\s*č\.\s*(\d+)\/(\d+)\s*Sb\.?`:

- **467/548 (85.2%)** match the "zákon" citation form and parse directly to
  `(číslo, rok)` — exactly the two components of the graph's `law:sb:<n>-<rok>`
  node id (verified against `docs/data-analysis/graph-schema.md:45`:
  `law | law:sb:<n>-<rok> | pass 11 (101) | ref, esbirka_title, esbirka_exists`).
  Example: `"§ 2079 z. č. 89/2012 Sb."` → `n=89, rok=2012` → `law:sb:89-2012`
  (nový občanský zákoník) — a **direct, deterministic parse, no LLM needed**.
- **The remaining 14.8%** are `vyhl. č. …` (prováděcí vyhláška, implementing
  decree) and `nař. vl. č. …` (government regulation) citations — a different
  Sb. numbering series from acts of parliament (zákony). These are correctly
  *outside* the `law:sb:` node scope (which models zákony, not decrees), so
  the effective match rate against the actual target population (zákon
  citations only) is close to 100% — a small regex extension
  (`vyhl\.\s*č\.` / `nař\.\s*vl\.\s*č\.`) would separate the series cleanly if
  decree-level tracking is ever wanted.
- Top-cited laws in the one-day, 100-decision sample: `99-1963` (o.s.ř., 236
  hits), `89-2012` (nový obč. zákoník, 135), `257-2016` (zákon o
  spotřebitelském úvěru, 25), `168-1999` (10), `262-2006` (zákoník práce, 10),
  `292-2013` (10), `40-1964` (starý obč. zákoník, 5), `145-2010` (spotřebitelský
  úvěr, 5), `269-2021` (5), `348-2005` (5) — dominated by procedural/backbone
  civil-law statutes rather than niche amendments, as expected from a
  debt-collection-heavy civil-court sample. A law-loop enrichment pass would
  need to target *specific* statutes of interest (e.g. laws with recent
  amendments already in the graph) rather than pull the whole corpus, to find
  decisions that matter for a given dossier.

### Full-document format and anonymization findings

Fetched 15 full decisions (`odkaz` → `/api/finaldoc/{uuid}`). Structure:
`{uuid, header[], verdict[], verdictText, justification[], ...}`, each a list
of `{texts:[{text, anonStyle}], styleLocalId, tableCellInfo}` blocks.
`anonStyle` is either `"NONE"` (verbatim) or `"ANON"` (replaced with a
generic placeholder label, e.g. `"Jméno zainteresované osoby 0/0"`, `"IČO
zainteresované společnosti 0/0"`, `"Adresa zainteresované osoby 0/0"`).

**Verified on a real commercial-debt decision** (`doc_63233746-…json`,
Okresní soud v Kroměříži, defendant is a company):

```
[NONE]žalovanému: [ANON]Jméno zainteresované osoby 1/0[NONE], IČO [ANON]IČO zainteresované společnosti 0/0[NONE] sídlem [ANON]Adresa zainteresované společnosti 0/0
```

**Both the company name AND its IČO are anonymized out** — only the literal
label word "IČO" survives, not the value. This matches the iROZHLAS reporting
that the implementing decree specifically orders "začernit názvy úřadů a
firem" (black out names of authorities and companies) — i.e. this is
deliberate, documented anonymization policy, not an artifact of the sample.
**Conclusion for Case ① (money): dead end, verified on real data, not
assumed.** No company name, no IČO, no address survives in any of the 13
company-touching decisions checked (13/15 sampled documents matched a
`s.r.o.|a.s.|IČO` grep; all had the entity anonymized). Natural-person
plaintiffs/defendants, birthdates, and addresses are likewise fully
anonymized (`Jméno zainteresované osoby`, `Datum narození…`, `Adresa…`) —
confirming this source cannot feed MP↔company tie-tracing at all.

**What DOES survive**: judge name, court, case number, ECLI id, date of
decision/publication, keywords (`klicovaSlova`), statute citations
(`zminenaUstanoveni`), the full legal reasoning text (`justification`) with
private-party details redacted but legal argument intact, and the verdict
operative text. This is precisely "how courts apply the statute" without any
identifiable party — a clean fit for Case ③'s doctrine (public-role
facts only; a judge's public ruling, not a private litigant's data).

### Value assessment per case

- **③ Law forensics — INGEST.** Decisions citing a specific `law:sb:<n>-<rok>`
  are a **judicial-application signal**: for any bill/law dossier already in
  the graph, "N first-instance decisions cited this statute in the last
  quarter, judges' most common `klicovaSlova` were X/Y/Z" is a real,
  deterministic enrichment with zero LLM guessing on the join itself (only
  narrative synthesis of *why* a statute is heavily litigated would want LLM
  interpretation, per the web-research doctrine — cited, never asserted as
  fact from the decision text alone). Best fit: **laws with a live dossier
  already in the graph** — crawl decisions mentioning those specific
  `(n, rok)` pairs rather than the whole corpus (the whole corpus is
  ~594k decisions and growing ~60–180k/year; there is no bulk filter by
  statute in the API, so this means either (a) crawling day-by-day and
  filtering client-side, cost scales with corpus size, or (b) a Pumper-watch
  approach — see below).
  - **Gap**: no server-side filter by statute exists in this API — every
    enrichment pass pays the cost of walking the date range and filtering
    locally. For a small number of target laws this is fine (M effort: build
    a crawler + citation-parser + statute-index cache); for "all laws in the
    graph" it would mean indexing the whole corpus, which is a bigger lift
    (L) better deferred until a specific dossier need justifies it.
- **① Money (MP↔company ties) — SKIP, verified negative.** Commercial-court
  decisions were not observed in the sample (civil-only scope excludes
  obchodní/insolvenční agendy per the 1.7.2022 mandate's narrower scope for
  those courts, unconfirmed whether Cm cases are covered at all — the sample
  simply didn't surface any), and even where a company IS a party (debt
  collection defendant), **name and IČO are both anonymized**. This closes
  the door definitively: no company names, no IČOs, survive to be joined to
  `contract:<id>` / ARES nodes. Do not revisit without new evidence the
  anonymization policy changed.
- **② Effort — not applicable.** No MP-linked content in this corpus (courts,
  not parliament); no enrichment path identified.

### Pumper-watch angle

Same shape as the MONITOR pattern in [[budget-sources]]: the corpus grows via
daily appends with **no bulk diff-able artifact** — "did new decisions
citing law:sb:89-2012 appear this week" is not answerable without walking the
API. A Pumper `watch` app fingerprinting the **daily counts endpoint**
(`/api/opendata/{rok}/{mesic}`, cheap — 12 calls/year fully enumerates a
year's day-level counts) could turn "new decisions published" into a data
event without re-crawling the whole corpus; the actual per-decision fetch and
citation parse should **bypass Pumper** and hit the JSON API directly (same
reasoning as MONITOR's win-1250 CSVs: this is clean UTF-8 JSON already, no
readability-extraction value-add, and Pumper's HTML→Markdown path would only
risk mangling the `anonStyle` structure needed to distinguish real text from
anonymized placeholders).

### Concrete URLs (verified 2026-07-25)

- Portal: `https://rozhodnuti.justice.cz/opendata/` (200)
- API root: `https://rozhodnuti.justice.cz/api/opendata` (200, JSON, 7 years)
- Year drill-down: `https://rozhodnuti.justice.cz/api/opendata/2025` (200, 12 months)
- Month drill-down: `https://rozhodnuti.justice.cz/api/opendata/2025/1` (200, 31 days)
- Day listing: `https://rozhodnuti.justice.cz/api/opendata/2025/1/2` (200, 100 decisions, page 1 of 3)
- Decision document: `https://rozhodnuti.justice.cz/api/finaldoc/1073b124-cfe3-462c-9ee8-2195a8617eff` (200, JSON, 23.7 KB)
- Licence + publisher (NKOD): `https://data.gov.cz/dataset?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatov%C3%A9-sady%2F00025429%2F1525174511` (CC BY 4.0, Ministerstvo spravedlnosti, "continuously updated")
- Legal basis / anonymization policy context (secondary reporting, not primary law text):
  `https://www.irozhlas.cz/zpravy-domov/rozsudky-zverejnovani-spravedlnost-soudy_2208040500_cib`,
  `https://advokatnidenik.cz/2022/02/02/novy-kratky-paragraf-muze-zpusobit-revoluci-v-pozitivnim-slova-smyslu/`
- Graph node convention cross-checked: `docs/data-analysis/graph-schema.md:45` (`law:sb:<n>-<rok>`)

---

## Source D — msp.gov.cz justice statistics

### What's actually there

- Landing page `https://msp.gov.cz/statisticke-udaje-z-oblasti-justice`
  (200, but page body is a navigation shell — no inline data). It links out
  to three distinct sub-portals:
  1. **Infodata** (`http://cslav.justice.cz/InfoData/uvod.html`, plain HTTP,
     200) — the actual report browser. Six categories confirmed by fetch:
     statistical yearbooks ("Statistické ročenky kriminality a soudních
     agend"), court/prosecutor activity reports, statistical-sheet summaries,
     agenda overviews (tabular case-processing stats), other documents, FAQ.
     Sourced from "výkazů o činnosti soudů a státních zastupitelství" —
     structured compilations of courts' own activity reports, covering
     criminal, civil, guardianship (opatrovnické), commercial, and insolvency
     agendas **at the aggregate level**.
  2. **Otevřená data** (`https://data.justice.cz/`) — a general open-data
     landing page; fetch failed with a connection reset on this pass
     (`ECONNRESET`), not independently re-verified — flag for a follow-up
     check rather than treated as evidence either way.
  3. **Registr open data** (`https://dataor.justice.cz/`) — this is the
     **public/commercial register (obchodní rejstřík)** open-data portal
     (company filings, IČO-linked), a **different dataset family** already
     covered by the money-loop's ARES/Hlídač ingestion, not a "justice
     statistics" publication — noted so it isn't mistaken for Source D
     itself.
- **Annual report ("Výroční statistická zpráva")**: sample downloaded,
  `Ceske_soudnictvi_2020.pdf`, 200, **7.6 MB PDF**, saved to
  `.justice-samples/ceske-soudnictvi-2020.pdf`. Could not render page content
  with available tooling this session (no `pdftoppm`/poppler in this
  environment) — structure is described from search-indexed secondary
  sources, not independently re-verified against the PDF's actual text:
  reports are organized **per court tier** (okresní/krajský/vrchní/Nejvyšší
  soud/NSS), each tier's section split into chapters by **agenda type**
  (case category) and personnel data, subchapters covering indicators like
  proceeding length and case throughput. Reports ship as **.docx + .pdf**,
  with **.xlsm attachments carrying the underlying per-court tabular data**,
  years 2018–2024 available (the 2022 edition URL was independently found:
  `https://msp.gov.cz/documents/2509270/0/Ceske_soudnictvi_2022_verze_k_publikaci.pdf/510f7a37-4987-4fe7-9a2a-3a710cd9f406`,
  not fetched this session).
- **KrimiData** (`https://iksp.gov.cz/krimi-data`, fetched 200) — a
  **national-level-only, annual-snapshot** interpretive dashboard (detected
  offenses, clearance rates, convictions, sentencing patterns, prison
  population, victim-support activity), explicitly **no crime-type,
  regional, or case-level breakdown visible on the page itself** — it links
  out to the primary CSLAV/Police/Vězeňská služba databases rather than
  exposing granular data directly.

### Honest value read

**CONTEXT-grade, as expected, and confirmed rather than assumed**: every
publication found in this family — Infodata's agenda overviews, the annual
"České soudnictví" report's per-court/per-agenda tables, KrimiData's national
annual snapshot — is an **aggregate count**, not a statute- or entity-linked
record. None carries anything resembling `law:sb:<n>-<rok>`, an IČO, or a
case-level `jednaciCislo`. This is fundamentally different in kind from
Source C: Source C anonymizes *within* an otherwise case-level record; Source
D never reaches case level to begin with — it's pre-aggregated at
publication time by the ministry's own reporting pipeline, so there is
nothing to de-aggregate.

The one dataset that IS entity/statute-linked in the `msp.gov.cz` orbit is
`dataor.justice.cz` — but that is the **obchodní rejstřík (commercial
register) open-data feed**, a different product entirely, already the money
loop's territory via ARES/Hlídač (see [[budget-sources]] and the money
skill), not a "justice statistics" publication and out of scope for this
research request.

**No case loop currently needs national-aggregate justice statistics.**
The nearest fit would be a narrative caveat in a Case ③ dossier ("X% of
first-instance civil suits nationally are debt-collection matters, per MSp's
2024 annual report") — decorative context, never a graph fact, and not worth
building an ingest pipeline for at this time. **Verdict: WATCH** (bookmark
the annual report + Infodata as a manual reference for narrative framing) —
**do not build an ingest adapter.**

### Concrete URLs (verified 2026-07-25 unless noted)

- Landing page: `https://msp.gov.cz/statisticke-udaje-z-oblasti-justice` (200, navigation shell)
- Infodata: `http://cslav.justice.cz/InfoData/uvod.html` (200)
- Annual report sample (2020): `https://msp.gov.cz/documents/12681/719244/Ceske_soudnictvi_2020.pdf/43b3020e-fc02-44a4-bb2c-a124ce85f57b` (200, 7.6 MB PDF, downloaded to `.justice-samples/`)
- Annual report (2022, found not fetched): `https://msp.gov.cz/documents/2509270/0/Ceske_soudnictvi_2022_verze_k_publikaci.pdf/510f7a37-4987-4fe7-9a2a-3a710cd9f406`
- KrimiData: `https://iksp.gov.cz/krimi-data` (200)
- Otevřená data landing (unverified this pass, ECONNRESET): `https://data.justice.cz/`
- Commercial-register open data (different product, not Source D): `https://dataor.justice.cz/`

---

## Honest gaps

- Source C: total historical corpus size was derived by summing the year
  index (~594k, 2020 through partial-2026), not independently cross-checked
  against a stated "as of" total on the portal itself.
- Source C: whether krajský/vrchní-soud appellate decisions or any
  obchodní-agenda (Cm) decisions are actually present anywhere in the corpus
  was **not conclusively settled** — only one day (2025-01-02, 100 items) and
  15 full documents were sampled; the NKOD description claims "okresních,
  krajských a vrchních soudů" but none appeared in this specific sample.
  A larger multi-day, multi-year sample would be needed before ruling
  appellate decisions in or out of a citation-crawl scope.
- Source C: the legal basis (exact law + article) was sourced from secondary
  reporting (iROZHLAS, Advokátní deník), not the primary statute text —
  flagged inline above, not stated as directly verified.
- Source D: the annual report's actual chapter/table structure was not
  independently confirmed from the downloaded PDF (no PDF-rendering tool
  available this session) — described from search-indexed secondary sources.
- Source D: `data.justice.cz` connection reset mid-fetch and was not
  retried — its content is unverified either way this session.
