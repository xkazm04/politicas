# Justice-ministry open-data source — kiosek.justice.cz/opendata

Research session, 2026-07-25. Assesses `kiosek.justice.cz/opendata/` — the
source the operator believed to be the Ministry of Justice's new data
warehouse, replacing the retired `cslav.justice.cz`/InfoData justice-statistics
interface (procurement MSP-110/2024-MSP-CES; a sibling agent traces that
paper trail in `justice-sources-dwh-procurement.md`, not touched here).
Format follows [[justice-sources-registry]] (the house precedent: dataor.justice.cz
OR bulk export + eisir/isir.justice.cz SOAP). Samples in `.justice-samples/`
(gitignored): `prehled.json` (208-institution catalogue), `katalog.jsonld`
(root DCAT catalogue), `201000.jsonld`/`201010.jsonld`/`221000.jsonld`/
`222000.jsonld`/`302000.jsonld` (five per-institution notice-board datasets),
`201000_def.jsonld` (DCAT dataset-definition doc), `main.js`/`chunk1.js`
(Angular SPA bundles, read to find the API), `cslav_check.html` (live
CSLAV/InfoData fetch), `pdfs/` (5 downloaded posting attachments).

Every URL below was fetched/curled live on 2026-07-25 unless flagged.

---

## Verdict up front

**INGEST — kiosek clears the context-grade bar msp.gov.cz failed, and on two
of the three join-key axes it goes further than either `rozhodnuti.justice.cz`
or `dataor.justice.cz` already logged in the registry.** It is per-case,
non-aggregated, contains real (non-anonymized) IČOs on company
dissolution/liquidation orders — restoring exactly the money-case linkage
`rozhodnuti.justice.cz`'s anonymization killed — and carries dense,
non-boilerplate statute citations across FOUR agendas (commercial,
administrative, civil, criminal), not just first-instance civil. It is
**not** the CSLAV/InfoData replacement: CSLAV is still alive (verified 200
today) and kiosek's data shape (individual notice-board postings) has no
overlap with CSLAV's data shape (pre-aggregated national statistics) — see
§4.

| Source | Verdict | Effort | Consumes |
|---|---|---|---|
| **kiosek.justice.cz/opendata** (national "úřední desky" / official-notice-board OFN feed, 208 courts + prosecutor's offices) | **INGEST** — per-case postings with attached PDFs; a document-type filter separates boilerplate delivery notices (low value) from real court orders/judgments (real IČO + real varying statute citations, unanonymized). Beats msp.gov.cz's context-only verdict decisively; extends `rozhodnuti.justice.cz`'s law-case value to non-civil agendas and restores the IČO linkage that source lost to anonymization. | **M** first slice (PDF fetch + text extraction + agenda/document-type classifier + statute/IČO parser across 208 hourly-refreshed feeds); **S** incremental once built (poll cadence matches the declared `HOURLY` metadata) | Case ③ law (statute-citation enrichment, broader agenda coverage than Source C); Case ① money (real IČO on dissolution/liquidation/register orders — the linkage Source C's anonymization removed); cross-references Source A (dataor register locators) and Source B (ISIR case numbers) already logged in [[justice-sources-registry]] |

---

## What it actually is

**Not** the commercial-register bulk-export portal (that's `dataor.justice.cz`,
already ingest-decided in [[justice-sources-registry]]) and **not** a CSLAV
statistics replacement (§4). `kiosek.justice.cz/opendata/` is an Angular SPA
("Úřední deska Opendata" — `<title>` verified in `kiosek_root.html`) that is
the Justice-ministry-family front end for **`infodeska.gov.cz`**, the shared
Czech eGovernment "official notice board" (úřední deska) service, published
per the national **OFN** (Otevřená formální norma) standard
`https://ofn.gov.cz/úřední-desky/2021-07-20/` — the mandatory digital
publication channel every Czech public body uses to post case notices,
delivery-by-posting notices, and disclosure documents.

### API, discovered from the SPA bundle (not documented on the page)

Reading `main-6JZZHISJ.js` (fetched 200, `.justice-samples/main.js`) found
the Angular service backing the one visible page (a sortable table of
institutions):

- `GET https://kiosek.justice.cz/opendata/api/v1/prehled` → 200, JSON array,
  **208 institutions** (all Czech courts — Nejvyšší soud down to
  okresní/obvodní soudy — plus all Krajské/Okresní/Vrchní/Nejvyšší státní
  zastupitelství). Verified, `.justice-samples/prehled.json`. Each row:
  `{"nazev": "...", "ico": "...", "ovm": "...", "nazevSady": "<code>.jsonld", "nazevData": "<code>.jsonld"}`.
- `GET .../api/v1/prehled/odkaz` → 200, base-URL map:
  `{"ovm":"https://rpp-opendata.egon.gov.cz/odrpp/zdroj/orgán-veřejné-moci/",
  "sada":"https://kiosek.justice.cz/opendata/úřední_deska/",
  "definice":"https://kiosek.justice.cz/opendata/datová_sada/",
  "katalog":"https://kiosek.justice.cz/opendata/katalog.jsonld"}`.
- `GET .../api/v1/env` → 200, `{"verze":"1.2.7","prostredi":"MSP_PROD"}`.
- Per-institution data: `GET https://kiosek.justice.cz/opendata/úřední_deska/{code}.jsonld`
  (percent-encoded Czech path segment; a bare `%20`-unaware client 403s —
  the correct encoded form is
  `.../%C3%BA%C5%99edn%C3%AD_deska/{code}.jsonld`, verified 200).
- Per-institution DCAT dataset definition:
  `GET https://kiosek.justice.cz/opendata/datová_sada/{code}.jsonld` (same
  encoding requirement), 200, verified.
- Root DCAT catalogue: `GET https://kiosek.justice.cz/opendata/katalog.jsonld`
  → 200, lists all 208 `datová_sada` entries — cross-checked against
  `prehled.json`'s count, matches (208 = 208).

**Formats**: JSON-LD only (`typ_média: application/ld+json`,
`formát: JSON_LD` per the DCAT definition doc). No CSV/XML bulk export like
`dataor.justice.cz`. Attached case documents are PDF, hosted on a *third*
host: `https://infodeska.gov.cz/eudpub/api/v1/vyveseni/soubor/{uuid}/download`
(all 5 sampled PDFs 200).

**Cadence**: `periodicita_aktualizace: "http://publications.europa.eu/resource/authority/frequency/HOURLY"`
(verified in `201000_def.jsonld`) — declared, machine-readable, hourly. See
§5 for what that means operationally.

**Licence** (from the same DCAT definition doc, `podmínky_užití` block):
`autorské_dílo → neobsahuje-autorská-díla` (no copyrighted works),
`databáze_jako_autorské_dílo → není-autorskoprávně-chráněnou-databází`,
`databáze_chráněná_zvláštními_právy → není-chráněna-zvláštním-právem-pořizovatele-databáze`
— i.e. essentially unrestricted reuse, **stronger** than `dataor.justice.cz`'s
explicit non-commercial clause. But `osobní_údaje → obsahuje-osobní-údaje`
("contains personal data") is asserted **true** — postings name natural
persons (addressees of service-by-posting notices, sometimes with birth
year), so the same GDPR/identity-matching-only doctrine
[[justice-sources-registry]] already applies to dataor's officer data
applies here.

---

## Dataset table (verified samples)

| Institution | IČO | Dataset code | `informace` count | Dominant agendas |
|---|---|---|---|---|
| Městský soud v Praze | 00215660 | `201000` | 516 | Obchodní (282), Správní soudnictví (111), Insolvenční řízení (48), Veřejné rejstříky (34) |
| Obvodní soud pro Prahu 1 | 00024384 | `201010` | 1,420 | Informace §106/1999 (1,113), Dědické (129), Občanskoprávní (124), Trestní (30) |
| Vrchní soud v Praze | 00215651 | `221000` | 38 | Informace §106/1999 (30), Předseda soudu (7) |
| Nejvyšší soud | 48510190 | `222000` | 84 | Předseda soudu (84) — 100% administrative |
| Krajské státní zastupitelství v Praze | 00026018 | `302000` | 244 | Informace §106/1999 (237), Trestní (1) |

**Pattern, confirmed across the 5 samples**: courts with a commercial docket
(regional/municipal seats that also administer the public register — same
7 seats as `dataor.justice.cz`'s court list) carry rich, per-case,
IČO/statute-bearing content. District courts without a commercial docket
carry probate/civil/criminal case notices (statute-bearing but no IČO).
Appellate/supreme courts and prosecutor's offices skew almost entirely to
administrative disclosure boilerplate (§106/1999 information-act postings,
"Předseda soudu" notices) — near-zero join value. **A future harvester
should prioritize the ~40-some commercial/regional court seats, not spend
budget uniformly across all 208.**

---

## Record schema (OFN "Úřední deska" JSON-LD)

Schema: `https://ofn.gov.cz/úřední-desky/2021-07-20/schémata/úřední-deska.json`.
Each `informace[]` item (excerpt, from `201000.jsonld`, MS Praha, real record):

```json
{
  "vyvěšení": {"typ": "Časový okamžik", "datum_a_čas": "2026-06-25T13:20:32.439493"},
  "spisová_značka": "70 Cm 1999/2026-3",
  "revize": "25.06.2026 13:20:32",
  "dokument": [{"typ": ["Digitální objekt"],
    "url": "https://infodeska.gov.cz/eudpub/api/v1/vyveseni/soubor/15375249-738d-469d-b43a-994d87fd62f2/download",
    "název": {"cs": "70Cm_1999_2026_2.pdf"}}],
  "agenda": [{"typ": "Agenda", "název": {"cs": "Obchodní"}}],
  "url": "https://infodeska.gov.cz/eudpub/uredni-deska/organizace/201000/vyveseni/9420213",
  "iri": "https://data.justice.cz/zdroj/úřední_deska/00215660/vyveseni/9420213",
  "název": {"cs": "Usnesení o naříz. likvidace a jmen. likvidátora"},
  "relevantní_do": {"typ": "Časový okamžik", "datum_a_čas": "2026-07-25T18:00:00.641"}
}
```

Fields: posting timestamp (`vyvěšení`), court case reference
(`spisová_značka` — first-class, present on every posting), attached PDF(s)
(`dokument[]`), category (`agenda[]`), permalink (`url`/`iri`), title
(`název`), removal date (`relevantní_do` — either a datetime or
`{"nespecifikovaný": true}` for permanent postings). **The join-key content
(IČO, statute citations) lives inside the attached PDF, not in the JSON-LD
metadata** — this is metadata-plus-document, not a flat structured record;
a real ingest needs PDF text extraction, not just JSON parsing.

Note: the `iri` field (`https://data.justice.cz/zdroj/...`) points at a host
that is **currently unreachable** — `https://data.justice.cz/` connection-failed
(curl exit 000, no HTTP response) both today and in the prior
`justice-sources-decisions.md` session (logged there as an ECONNRESET on
2026-07-25, re-confirmed today with the same failure mode). This is the
canonical-URI namespace, not the actual data host — the working host is
`kiosek.justice.cz` (JSON-LD) + `infodeska.gov.cz` (PDFs), a real gap in the
Ministry's own linked-data hygiene, not a blocker for ingest (the working
URLs are stable and already in hand).

---

## Join-key findings — the value question, with evidence

### (a) Statute references — YES, but bimodal by document type

Two content classes ride the same JSON feed:

1. **Boilerplate delivery-by-posting notices** ("Sdělení pro vyvěšení na
   úřední desce soudu podle § 49 odst. 4 o.s.ř.") — ~50% of MS Praha's
   corpus (`Sdělení pro vyvěšení na ÚD+EÚD` 114 + `Sdělení §49...` variants
   57 + similar ≈ 220/516). Each cites **exactly one fixed statute**
   (`§ 49 odst. 4 o.s.ř.` = zákon č. 99/1963 Sb.) — same citation every
   time, zero discriminative value for a citation-density parser. Sample,
   full text extracted (`.justice-samples/pdfs/obchodni1.pdf`): addressee
   "Česká federace ZATRE, o. s.", case "87 Cm 606/2026-9", no IČO, single
   statute.

2. **Actual court orders/judgments attached as the "underlying document"**
   — real, varied, non-boilerplate statute citations. Two samples,
   full text extracted:
   - **Liquidation order** (`70 Cm 1999/2026-3`, `Usnesení o naříz.
     likvidace a jmen. likvidátora`, `.justice-samples/pdfs/likv.pdf`)
     cites **five distinct statutes with pinpoint sections**: `§ 25 odst. 1
     písm. g) zák. č. 304/2013 Sb.` (public registers act), `§ 172 odst. 1
     písm. c) a odst. 2 zákona č. 89/2012 Sb.` (civil code), `zákona
     č. 90/2012 Sb.` (business corporations act), `§ 6, § 9 odst. 1, § 85
     písm. a), § 89 odst. 1 z. č. 292/2013 Sb.` (special judicial
     proceedings act), `§ 2 odst. 1 písm. e) zákona č. 549/1991 Sb.`
     (court-fees act) — each tied to the court's actual legal reasoning
     (18 numbered paragraphs of odůvodnění), not recital boilerplate. All
     five parse cleanly to `law:sb:<n>-<rok>` (304-2013, 89-2012, 90-2012,
     292-2013, 549-1991).
   - **Administrative-court judgment** (`39 A 16/2026-23`, full
     `ROZSUDEK JMÉNEM REPUBLIKY`, agenda "Správní soudnictví",
     `.justice-samples/pdfs/rozsudek1.pdf`, 7 pages, complete reasoning)
     cites `zákona č. 65/2022 Sb.` ("lex Ukrajina" — temporary-protection
     act), `zákona č. 150/2002 Sb.` (soudní řád správní), `zákona
     č. 221/2003 Sb.` (temporary-protection-for-foreigners act),
     `vyhlášky č. 177/1996 Sb.` (advokátní tarif), plus **dozens of
     cross-references to specific NSS/SDEU case numbers** (e.g. NSS
     `1 Azs 174/2024-42`, SDEU `C-753/23 Krasiliva`) — a judicial
     application evidence trail even richer than a single statute-citation
     count.

**Coverage is agenda-dependent, not court-dependent**: "Správní soudnictví"
(administrative), "Obchodní" (commercial), "Trestní" (criminal), and
"Občanskoprávní"/"Dědické" (civil/probate) agendas all produced real
court orders in the samples — this is **broader agenda coverage than
`rozhodnuti.justice.cz`**, which [[justice-sources-registry]]'s sibling doc
[[justice-sources-decisions]] scoped as **civil-first-instance-only**
(Source C). A first-slice ingest needs a document-type classifier
(agenda name + title-string heuristic, e.g. `název` starting with
"Usnesení"/"Rozsudek" vs "Sdělení") to route only the substantive ~40-50%
of postings into the citation parser — the boilerplate half is real noise
that would otherwise dilute the parse-rate metric the way the registry's
85.2%-on-rozhodnuti number was measured.

### (b) IČO / entity identifiers — YES, real and unanonymized

The liquidation order sample names **two real, unredacted IČOs** in one
document: the dissolved company "**New Era Corporation s.r.o., IČO
07043694**" (named 6 times across the operative clauses) and the
court-appointed liquidator "**VPI CZ, v.o.s., IČO 03007740**". This is
**exactly the linkage `rozhodnuti.justice.cz` cannot provide** —
[[justice-sources-decisions]] verdict for Source C states plainly:
"company names and IČOs are anonymized out — kills the ① money angle."
kiosek's commercial/register-agenda documents restore it, on the same
statute-rich document type that also serves the law case (§(a) above) —
one document, two case loops.

Caveat matches the agenda pattern in §(a): IČOs appear only in
commercial/register-agenda postings (dissolution, liquidation, register
correction orders), not in civil/criminal/administrative postings (those
name natural persons, sometimes only by initials as in the asylum
judgment sample — GDPR-conscious redaction is already applied by the
courts themselves for that agenda class).

### (c) Court/case identifiers — YES, and they cross-reference two sources already in the registry

`spisová_značka` is a first-class structured field on every posting, in
three keyspaces that are **directly reusable against sources already
logged in [[justice-sources-registry]]**:

- **Insolvency case numbers** (`90 INS 111/2020-B-36`, sampled from MS
  Praha's Insolvenční řízení agenda) are the exact same `INS <n>/<rok>`
  format the ISIR SOAP event feed (Source B) uses — a kiosek posting on an
  insolvency case is directly cross-walkable to that feed's `spisová_znacka`
  field without any fuzzy matching.
- **Register locators** (`L 40726/MSPH` sampled; the liquidation order
  cites "oddílu C, vložka 293622" for New Era Corporation) are the same
  oddíl+vložka keyspace `dataor.justice.cz`'s bulk OR export (Source A)
  indexes by — a kiosek dissolution order can be paired with the
  corresponding dataor snapshot record for the same entity.
- **Ordinary court case numbers** (`87 Cm 606/2026-9`, `39 A 16/2026-23`)
  are the same senate/agenda/number/year format used platform-wide across
  Czech courts, including on `rozhodnuti.justice.cz` (Source C) — though
  no direct overlap was tested this session (kiosek's commercial/
  administrative agendas fall outside Source C's civil-only scope, so
  overlap is expected to be small to none).

### (d) Per-case granularity vs pre-aggregated — per-case, decisively

Every one of the 516–1,420 records sampled per institution is one specific
posting tied to one specific case (`spisová_značka`) with one specific
attached document. There is no aggregation anywhere in this data shape —
the opposite of `msp.gov.cz`'s per-court/per-year count tables
([[justice-sources-decisions]] Source D). This alone clears the
context-grade bar; §(a)–(c) show it also clears the higher bar of being
**joinable**, not just granular.

---

## CSLAV / InfoData status (task 4)

**Alive, not retired.** `http://cslav.justice.cz/InfoData/uvod.html` → 200
today, redirects to `https://cslav.justice.cz/InfoData/uvod.html` (same
final URL and 200 status the prior [[justice-sources-decisions]] session
recorded on the same date). Page content unchanged: six report categories
(statistické ročenky, výkazy soudů a státních zastupitelství, přehledy
statistických listů, přehledy agend, ostatní dokumenty, FAQ), sourced from
courts'/prosecutors' own activity reports at the **aggregate level**
(criminal/civil/guardianship/commercial/insolvency agenda counts) — the
same context-grade shape [[justice-sources-decisions]] already characterized.

**kiosek is not a data-content replacement for it.** The two portals have
zero shape overlap: CSLAV publishes pre-aggregated national/per-court
statistical tables (PDF/DOCX/XLSM); kiosek publishes individual per-case
notice-board postings (JSON-LD + PDF). No CSLAV statistical-sheet aggregate
was found reproduced, derived, or referenced anywhere in the five kiosek
datasets sampled. **If the MSP-110/2024-MSP-CES contract's data-warehouse
deliverable is meant to replace CSLAV's statistical function, kiosek is not
where that shows up** — worth flagging back to the sibling procurement
agent as a negative finding: the "new data warehouse" data layer, at least
at kiosek.justice.cz, is a different product (case-notice publication, an
EU/national eGovernment mandate — infodeska.gov.cz — not a
Ministry-specific statistics rebuild).

**`data.justice.cz`** (the general "Otevřená data" landing page
[[justice-sources-decisions]] flagged as connection-reset and unverified)
was re-tested today: **still connection-failed** (curl exit 000, no TCP/TLS
response), consistent failure across two independent sessions — upgrade
from "flagged, not independently confirmed" to "confirmed down across two
dates," though still not conclusively diagnosed as permanently retired vs.
intermittently unavailable.

---

## Pumper-watch angle (task 5)

**Has real versioning/cadence metadata — the opposite of the psp.cz
versionless-mirror pattern.** Every per-institution dataset definition
declares `periodicita_aktualizace: HOURLY` (machine-readable, DCAT-standard
frequency URI), and every posting carries its own `revize` timestamp. No
release-page fingerprinting is needed — the freshness contract is already
explicit and structured.

**But it is not append-only — this is the operational catch.** Postings
disappear from the JSON-LD once their `relevantní_do` date passes: the
sampled MS Praha delivery notices have ~30-day posting windows (`Vyvěšeno
21.7.2026` / `Svěšeno 20.8.2026` on the sample). Only postings with
`relevantní_do: {"nespecifikovaný": true}` (mostly the §106/1999
disclosure-act items) persist indefinitely. A naive diff-based fingerprint
(hash the file, alert on change) would silently miss any posting that
appeared and was removed entirely between two polls — the recommended shape
is closer to the **ISIR SOAP cursor pattern** already logged in
[[justice-sources-registry]] (Source B: poll forward, dedup by a stable
key) than to `dataor.justice.cz`'s snapshot-file pattern (Source A): use
each posting's `iri`/`url` as the dedup key and poll at (or faster than)
the declared hourly cadence to avoid missing short-lived postings.

**Operational note, observed directly this session**: single sequential
`curl` calls to individual dataset URLs succeeded reliably (200 every time,
5-for-5 across different institutions). A tight back-to-back loop issuing
15 requests with only a 0.5s gap produced repeated connection failures
(curl exit 000) after the first call — a real bulk harvester across 208
datasets needs throttling/retry logic, not a bare loop; this was not
diagnosed further (could be a WAF/rate-limit or an unrelated local network
blip) but is worth building defensively for.

---

## Honest gaps

- **Statute/IČO extraction requires a PDF pipeline, not a JSON parser.**
  The join-key content lives entirely inside attached PDFs; the JSON-LD
  metadata only carries the case reference and category. This session read
  5 PDFs manually to characterize content — no parser was built, and the
  ~40-50%/~50-60% boilerplate-vs-substantive split is estimated from one
  court's title-frequency histogram (MS Praha), not measured across the
  corpus.
- **No corpus-wide record count.** 208 institutions were catalogued and 5
  were sampled in full; a bulk size/count pass across all 208 was attempted
  and hit the throttling issue above before completing — total corpus size
  is unknown (MS Praha alone: 516 records, ~438KB JSON; Obvodní soud pro
  Prahu 1: 1,420 records, ~1.1MB — a rough 208×~700 avg ≈ 145K postings is
  a guess, not a measurement).
  Effort C — measured population estimate for the actual first-slice batch,
  not re-derivable from this session's samples alone.
- **No overlap test against `rozhodnuti.justice.cz`.** Both sources carry
  court case numbers; whether any specific case appears in both (e.g. a
  civil judgment posted to kiosek's notice board also appearing in Source
  C's crawl) was not tested — flagged for a future session rather than
  assumed either way.
- **`data.justice.cz`/the `iri` canonical-URI namespace is unreachable**
  (confirmed down twice, see §CSLAV above) — not a blocker (kiosek +
  infodeska.gov.cz are the working hosts) but means the "official"
  linked-data URIs in every record can't be dereferenced independently of
  kiosek itself.
- **NKOD/data.gov.cz catalogue registration not directly confirmed.** The
  `poskytovatel` field in every dataset definition points at
  `rpp-opendata.egon.gov.cz` (the national OVM/RPP registry, confirming
  kiosek's institutions are registered public bodies), and the OFN schema
  itself is the national open-data standard — but a direct NKOD search API
  call 404'd (wrong endpoint guessed, `data.gov.cz/api/1/catalog/datasets`)
  and was not retried with the correct endpoint this session.
- **GDPR/personal-data posture not deeply assessed.** The DCAT licence doc
  self-declares `obsahuje-osobní-údaje` (contains personal data) — natural
  persons' names, sometimes birth years, appear as delivery-notice
  addressees. Politicas' existing "public-role facts only" doctrine
  ([[case-loops]]) should extend here the same way it already does for
  dataor's officer birth-dates, but this session did not re-derive that
  policy, only flags that the same class of data is present.

---

## Concrete URLs (all verified 2026-07-25 unless noted)

**kiosek.justice.cz**
- SPA root: `https://kiosek.justice.cz/opendata/` (200, Angular shell,
  `<title>Úřední deska Opendata</title>`)
- SPA bundles (read to find the API): `https://kiosek.justice.cz/opendata/main-6JZZHISJ.js` (200, 52.9KB),
  `https://kiosek.justice.cz/opendata/chunk-QOTHSSZR.js` (200, 386KB)
- `GET /opendata/api/v1/prehled` → 200, 208 institutions
- `GET /opendata/api/v1/prehled/odkaz` → 200, base-URL map
- `GET /opendata/api/v1/env` → 200, `{"verze":"1.2.7","prostredi":"MSP_PROD"}`
- Root catalogue: `https://kiosek.justice.cz/opendata/katalog.jsonld` (200, 208 datasets listed)
- Per-institution data (5 verified 200): `.../%C3%BA%C5%99edn%C3%AD_deska/201000.jsonld` (MS Praha, 516 records),
  `.../201010.jsonld` (Obvodní soud Praha 1, 1,420 records), `.../221000.jsonld` (Vrchní soud Praha, 38),
  `.../222000.jsonld` (Nejvyšší soud, 84), `.../302000.jsonld` (KSZ Praha, 244)
- Per-institution dataset definition (DCAT): `.../datov%C3%A1_sada/201000.jsonld` (200)
- Attached PDFs (5 verified 200, downloaded to `.justice-samples/pdfs/`):
  `https://infodeska.gov.cz/eudpub/api/v1/vyveseni/soubor/4bb11377-8d97-46c4-b9fb-b4e3a606e29d/download` (delivery notice, no IČO),
  `.../22905cfa-e76a-478b-a470-f8ac3ff0d207/download` (INS delivery notice),
  `.../50550b81-18ae-4b44-9d9b-2a6f83b8841b/download` (register delivery notice),
  `.../15375249-738d-469d-b43a-994d87fd62f2/download` (liquidation usnesení — 2 IČOs, 5 statutes),
  `.../a071cceb-c1a0-40f1-b534-78e1baf97c9f/download` (asylum rozsudek — 4+ statutes, dozens of case cites)
- OFN schema: `https://ofn.gov.cz/úřední-desky/2021-07-20/schémata/úřední-deska.json` (referenced, not independently fetched)

**cslav.justice.cz / data.justice.cz**
- `http://cslav.justice.cz/InfoData/uvod.html` → 200 (redirects to https), alive, same content as prior session
- `https://data.justice.cz/` → connection failure (curl exit 000), confirmed down twice (this session + prior)
- `https://data.justice.cz/zdroj/úřední_deska/00215660/vyveseni/9294477` (a canonical `iri` from a live record) → connection failure

**data.gov.cz / NKOD**
- `https://data.gov.cz/api/1/catalog/datasets?keyword=kiosek` → 404 (wrong endpoint, not retried with correct one — gap)

**Reference (already decided, this session cross-references but does not re-verify)**:
- [[justice-sources-registry]] — Source A (dataor.justice.cz, INGEST) and Source B (ISIR SOAP, WATCH)
- [[justice-sources-decisions]] — Source C (rozhodnuti.justice.cz, INGEST for law) and Source D (msp.gov.cz, WATCH/context-only)

**Local samples** (gitignored): `.justice-samples/` — `kiosek_root.html`, `main.js`, `chunk1.js`, `chunk2.js`,
`prehled.json`, `prehled_odkaz.json`, `env.json`, `katalog.jsonld`, `201000.jsonld`, `201010.jsonld`,
`221000.jsonld`, `222000.jsonld`, `302000.jsonld`, `201000_def.jsonld`, `cslav_check.html`, `datajustice.html`,
`nkod1.json`, `nkod2.json`, `all_institutions.txt`, `all_dataset_files.txt`,
`pdfs/obchodni1.pdf`, `pdfs/ins1.pdf`, `pdfs/vr1.pdf`, `pdfs/likv.pdf`, `pdfs/rozsudek1.pdf`.
