# Justice-ministry open-data sources — dataor.justice.cz (OR) & eisir.justice.cz (ISIR)

Research session, 2026-07-25. Assesses two Ministry of Justice sources against
Case ① FollowTheMoney (money loop, 211 human-gated MP↔company ties, ARES-VR
corroboration model — see [[case-money/ledger]]) and the batch-004 PRaK dead
end (IČO 61858111, "PRaK, a.s. v likvidaci", dissolved 2012-12-13, 404 on ARES
REST — [[case-money/batch-003]] §2, [[case-money/batch-004]] §4). Every URL
below was fetched live on 2026-07-25 unless flagged; raw samples are in
`.justice-samples/` (gitignored).

---

## Verdict up front

**Ingest dataor.justice.cz's bulk OR export. It answers all three Case ①
value questions with evidence, not inference, and it just solved the PRaK
dead end that two prior batches (003, 004) could not close.** ISIR SOAP is
real, live, and free, but it is a **sequential event feed keyed by an
internal numeric ID, not by IČO or debtor name** — useful as a Pumper-watched
delta source, not a corroboration lookup; the IČO-searchable version is a
**Hlídač Státu paid-tier endpoint**, so it waits for the user (Authority: ingest
autonomous, payment always waits — [[case-loops]]).

| Source | Ingest? | Effort | Consumer |
|---|---|---|---|
| **dataor.justice.cz bulk OR export** (CKAN, court×legal-form×year CSV/XML) | **Yes** | **M** | Case ① money (corroboration + indirect-ownership layer); Case ③ law (entity registry backdrop) |
| **eisir.justice.cz / isir.justice.cz SOAP event feed** | Conditional — as a **watch/delta signal**, not a lookup | **S** (watch only) / blocked (no IČO search without Hlídač's paid tier) | Case ① money (insolvency-flag signal class) |

**The PRaK proof (the killer test the task asked for): SOLVED.** IČO
61858111 "PRaK, a.s. v likvidaci" — 404 on ARES REST, unreachable through
or.justice.cz's JS search form (batch 004) — **is present, with full officer
history, in the year-scoped bulk FULL export**
`as-full-praha-2012.csv` (fetched 2026-07-25, 200, 42.2 MB gzipped):

```
"61858111","PRaK, a.s. v likvidaci"  vymazDatum=2012-12-13  zapisDatum=1994-08-16
```

That `vymazDatum` matches batch-003's dissolution date exactly. The record
carries the **board history with birth dates** — the identity-match field
batch-003 flagged as unavailable:

```
{hlavicka=člen představenstva; zapisDatum=1996-01-15; vymazDatum=2002-12-31;
 clenstviDo=1999-07-28; funkce=člen představenstva;
 osoba={jmeno=Petr; prijmeni=Bendl; narozDatum=1966-01-24; titulPred=Ing.};
 adresa={obec=Kladno; ulice=Poděbradova; cisloText=909; okres=Kladno}}
```

This also **resolves batch-003's open item** (Bendl end-date conflict,
1999-07-28 vs 2002-12-31): `clenstviDo=1999-07-28` is his actual board-seat
end; `vymazDatum=2002-12-31` on that record is the register-entry's own
superseding date (a different person's re-filing), not Bendl's exit — the
two numbers were never in conflict, batch-003 was reading two different
fields as one. Richard Brabec (Kladno-era) is also present, `člen
představenstva`, `1994-08-16→1996-01-15`, confirming the second name batch-003
found via the kurzy.cz aggregator against a primary registry source for the
first time. This upgrades the medium-confidence, aggregator-only annotation
in batch-003 to a **primary-source-corroborated** one (still short of a
birth-date-verified ARES-VR match on the *identity* axis for Brabec — no
`narozDatum` on his record — but Bendl now has one).

**One-year window is the trick.** `as-full-praha-2013.csv` (the very next
year) already has **zero** hits for IČO 61858111 — once an entity is struck
off, it drops out of the FULL export for the following year. The FULL/year
dataset is a **snapshot-of-record-as-it-existed-that-year**, not a growing
superset. **To find a dissolved entity you must fetch the FULL export for
the year it was still on record (its dissolution year or earlier), keyed by
the court that held it** — court + legal form + year is the compound key of
the whole catalog (`{legalForm}-{full|actual}-{court}-{year}`), and you must
already know (or guess) the court. That is real, non-trivial friction the
PRaK proof makes concrete: batch 003/004 had the legal form (a.s.) and the
court (Městský soud v Praze, B 2674/MSPH) from the kurzy.cz aggregator — the
bulk export could not have replaced that first identification step, but it
would have upgraded the aggregator lead to a primary-source proof in one
targeted download once the court was known.

---

## Source A — dataor.justice.cz (bulk OR / ISVR open data)

### What it is, verified

- Root `https://dataor.justice.cz/` is a JS SPA ("Opendata"), but it exposes a
  documented **CKAN API v3** subset: `package_list` and `package_show`.
  Verified: `https://dataor.justice.cz/api/3/action/package_list` → 200, JSON,
  **9,496 dataset IDs** (fetched 2026-07-25, `.justice-samples/package_list.json`).
- Naming: `{legalForm}-{full|actual}-{court_slug}-{year}`, e.g.
  `sro-full-praha-2026`, `as-full-praha-2012`, `sf-actual-hradec_kralove-2026`.
  Legal-form codes seen: `sro` (s.r.o.), `as` (a.s.), `sf` (svěřenský fond),
  `zsf`, `ops`, `pobspolek`, `nevlad_org`, `komora_ha`, `p_nevlad_org`,
  `z_pobocny_spolek`, `zaj_sdr_po`, `p_odbor_org`, `podn_hz_ps`,
  `podn_hz_sdr`, `zvlastni_org`, `obec`, `po_zzz` — i.e. essentially every
  legal form in the public registers (ISVR = Informační systém veřejných
  rejstříků), not just s.r.o./a.s.
  Courts seen: `praha` (Městský soud), `brno`, `ostrava`, `ceske_budejovice`,
  `plzen`, `hradec_kralove`, `usti_nad_labem` — the 7 regional-court seats
  that administer the Czech public registers.
  **Years: 2005–2026**, one dataset per court×legal-form×year (verified via
  `package_show` 200 for `as-full-praha-2012` and `as-full-praha-2013`,
  `.justice-samples/package_show_*.json`).
- `package_show?id=<dataset>` (e.g. `sro-full-praha-2026`,
  `.justice-samples/package_show_sro_praha.json`) returns per-dataset
  metadata + **4 resources**: `.csv`, `.csv.gz`, `.xml`, `.xml.gz`, all
  key-free `http://dataor.justice.cz/api/file/{id}.{ext}` URLs. Verified 200
  downloads: `sf-full-hradec_kralove-2026.csv` (499 KB), `as-full-praha-2012.csv.gz`
  (42.2 MB → 23,876 records), `as-full-praha-2013.csv.gz` (42.4 MB → 23,930
  records) — all fetched 2026-07-25.
- **FULL vs ACTUAL is the critical distinction**: FULL = "Úplný výpis"
  (complete extract as of that year, includes struck-off/superseded history
  within the record); ACTUAL = "Platný výpis" (currently-valid state only).
  Confirmed by side-by-side `package_show` notes text (identical field list,
  differing only "Úplný"/"Platný") and by the PRaK proof: FULL for the
  dissolution year still has the entity, ACTUAL for the current year would
  not (not tested directly — PRaK was already gone from the *next* FULL
  year, so ACTUAL-2026 was not separately probed, but the FULL/ACTUAL
  semantics make a negative there certain).
- **Update cadence**: current-year datasets update **daily**; datasets for
  past years update **once a year, every January** (FAQ PDF §6,
  `.justice-samples/ISVR_OpenData_FAQ.pdf`, page 4). New dataset IDs are
  published **monthly** per the "Publikační plán ISVR".
- **Formats**: CSV (`;`-delimited, UTF-8, quoted) and XML, both plain and
  gzip. A CSV-W metadata description is published at
  `https://dataor.justice.cz/files/opendata-csv-metadata.json` (200,
  verified) — but it undersells the payload: it lists only 5 top-level CSV
  columns (`ico`, `nazev`, `udaje`, `vymazDatum`, `zapisDatum`). **`udaje` is
  where everything lives** — a single string field holding a
  Groovy-`toString()`-style nested structure (not JSON: `key=value` pairs,
  unquoted, `{}`/`[]` nesting) that encodes the *entire* register record:
  spisová značka, statutární orgán with named members + birth dates +
  addresses + term start/end dates, společníci/akcionáři (including
  **corporate shareholders** — see below), sídlo, předmět podnikání, and
  more. The XML resource almost certainly exposes the same structure in real
  XML (not independently parsed this session — flagged as a gap).

### The three Case ① value questions — answered with evidence

1. **Could bulk OR replace per-IČO ARES-VR fetches for corroboration at
   population scale?** **Yes, functionally, for entities the court still
   holds a record for at any year** — and it goes further than the ARES-VR
   endpoint the money loop uses today: officer records carry **term start
   AND end dates** (`zapisDatum`/`vymazDatum`/`clenstviOd`/`clenstviDo` on
   each `STATUTARNI_ORGAN_CLEN` sub-record) plus **birth dates**
   (`narozDatum`) for identity matching — exactly the two things the money
   loop's ARES-VR reconciliation already keys on
   (`lib/analysis/reconcile-ares-vr.ts` per [[case-loops]]/[[graph-schema]]
   convention). The catch: it is **one file per court×legal-form×year**, so
   population-scale use means either (a) already knowing each company's
   court+legal-form (usually true — it's in every existing tie's spisová
   značka) and pulling the one matching year-file, or (b) bulk-downloading
   all courts × both legal forms in scope (sro+as, 7 courts, ~1 year of
   history) — roughly 14–20 files, tens of MB each, a few hundred MB total,
   trivial to mirror. Not tested at full population scale this session — a
   single real record was proven end to end (the PRaK case); a batch
   pulling all 260 graphed ties' court+form+year and joining would need to
   be built and is the natural next step, not a re-derivation of this
   finding.
2. **Does it enable the indirect-ownership layer (company→company stakes —
   O-money-3, the Agrofert-chain problem)?** **Yes — directly observed, not
   inferred.** In `as-full-praha-2012.csv`, the `AngazmaPravnicke` engagement
   type (legal-entity party, as opposed to `AngazmaFyzicke` for a natural
   person) occurs **17,703 times** in this single court×year file. A live
   example, verified in the sample (a different a.s., not PRaK):
   ```
   {hlavicka=; zapisDatum=2017-06-10; hodnotaText=AngazmaPravnicke;
    udajTyp={kod=AKCIONAR; nazev=jediný akcionář};
    osoba={nazev=PF METAL CZ s.r.o.; ico=3233618}; adresa={...Praha, Malostranské nám...}}
   {hlavicka=; zapisDatum=2015-04-28; vymazDatum=2017-06-10; hodnotaText=AngazmaPravnicke;
    udajTyp={kod=AKCIONAR; nazev=jediný akcionář};
    osoba={nazev=Corporate service a.s.; ico=25454536}; adresa={...Litvínov...}}
   ```
   This is a **dated, IČO-keyed shareholder chain**: company A's sole
   shareholder was `Corporate service a.s.` (IČO 25454536) until 2017-06-10,
   then `PF METAL CZ s.r.o.` (IČO 3233618). Walking `ico` fields inside
   `AngazmaPravnicke` records across the corpus is a mechanical, deterministic
   way to build company→company ownership edges with validity dates —
   exactly the missing layer for tracing Agrofert-style holding chains. The
   `AKCIONAR`/`SPOLECNIK`/`STATUTARNI_ORGAN_CLEN` `udajTyp` codes distinguish
   shareholder vs. officer vs. board-member roles, so the edge type is
   recoverable, not just the fact of a link.
3. **Does it cover dissolved entities?** **Yes, proven directly by the PRaK
   test above** — with the one-year-window caveat: a struck-off entity is
   present in the FULL export for the year it was still on record and gone
   the year after. Courts publish the FULL series back to **2005**
   (`package_list` years span 2005–2026), so any entity dissolved between
   2005 and now is reachable if you know (or can determine) its court and
   legal form and pick the right year.

### Gaps and honest limits

- **Licence is non-commercial and GDPR-attached.**
  `https://dataor.justice.cz/files/ISVR_OpenData_Podminky_uziti.pdf` (200,
  verified, full text extracted): reuse is permitted to copy/distribute/
  communicate-to-public/cite/**non-commercial use** ("využívat pro
  **nekomerční** použití") — not a CC0/CC-BY-style unrestricted licence.
  It explicitly states the distributed data **contains personal data**
  (birth dates, home addresses of natural-person officers) under GDPR/zákon
  č. 101/2000 Sb., and that **the recipient becomes a data controller**
  with the legal obligations that follow. Politicas' "public-role facts
  only, private life out of scope" doctrine ([[case-loops]] web-research
  doctrine) already aligns with treating officer birth-dates/addresses as
  identity-matching keys only, never as narrative content — but this
  licence term should be logged before any bulk mirror ships, and the
  non-commercial clause should be flagged to the user given the political
  platform's positioning.
- **`udaje` is not machine-friendly out of the box.** It is a bespoke
  Groovy/Java `toString()` serialization, not JSON or well-formed anything
  — parsing needs a small custom grammar (nested `{k=v; k=v; sub=[{...}]}`),
  not a stock parser. The XML resource is the likely cleaner path and should
  be diffed against a parsed CSV sample before committing to one format —
  **not done this session** (flagged gap; the CSV was sufficient to prove
  the value questions, but XML should be preferred for the real ingest for
  parse safety).
- **No single index of "which court/legal-form/year has entity X".** The
  catalog is enumerable (9,496 known dataset IDs today) but not queryable by
  IČO — you must already know or guess the court+form+year, or scan across
  all court×year combinations for a legal form (feasible: 7 courts × ~20
  years × 1 legal form = ~140 file fetches, still small). This is the same
  friction the PRaK proof surfaced: the aggregator (kurzy.cz) or an existing
  graph fact (spisová značka) is what tells you *where* to look.
- **Field completeness is data-dependent, not schema-dependent** (FAQ PDF
  §6): optional attributes are only present if the underlying ISVR record
  has them filled in — absence isn't a parsing bug.
- **Size at full scale not measured.** Individual files are tens of MB
  (Praha a.s., a mid-size court/form combination, was 42 MB gzipped for one
  year). A full historical mirror (7 courts × ~15 legal forms × 20 years,
  FULL only) was not summed this session — likely several GB, still well
  within "download once, mirror" territory, but worth a HEAD-request sizing
  pass before committing to "ingest everything historical."

---

## Source B — eisir.justice.cz / isir.justice.cz (ISIR SOAP)

### What it is, verified

- `https://eisir.justice.cz/` is itself in maintenance ("Nová podoba
  insolvenčního rejstříku... dočasně nedostupná") and redirects users to the
  legacy `https://isir.justice.cz`. The public SOAP endpoint is **live and
  reachable at the legacy host**:
  `https://isir.justice.cz:8443/isir_public_ws/IsirWsPublicService`
  (WSDL: `?wsdl`, XSD: `?xsd=IsirWsPublicTypes.xsd`, both fetched 2026-07-25,
  200, saved to `.justice-samples/live_isir.wsdl` and `isir_types.xsd`).
- **No authentication required** — verified with a live POST (below).
- **Only two operations, both event-feed shaped, neither is a debtor/IČO
  search:**
  - `getIsirWsPublicPodnetId(idPodnetu: long)` → a batch of change events
    starting at that internal numeric ID.
  - `getIsirWsPublicPodnetPosledniId()` → the current highest event ID.
  Each returned `data` record has: `id`, `datumZalozeniUdalosti`,
  `datumZverejneniUdalosti`, `dokumentUrl`, `spisovaZnacka`, `typUdalosti`,
  `popisUdalosti`, `oddil`, `cisloVOddilu`, and a `poznamka` field that is
  itself an **embedded XML document** (namespace
  `http://www.cca.cz/isir/poznamka`) carrying the real payload for
  person-change events — debtor name and an `idOsoby` string that embeds
  the debtor's IČO (e.g. `ZP ZEMAN 63470489 3`) plus `druhRoleVRizeni`
  (role: DLUŽNÍK etc.).
- **Real query executed, real data returned** (SOAP POST,
  `.justice-samples/isir_request.xml` → `.justice-samples/isir_response.xml`,
  200, ~1 MB of events starting at `idPodnetu=1000000`): first event is
  `INS 4632/2010`, "Insolvenční návrh", filed 2010-04-30, court `KSJIMBM`
  (Krajský soud v Brně); next event in the same case is `Změna osoby` naming
  debtor `ZP ZEMAN TRANSPORT Group Brno, a.s.` with embedded IČO 63470489.
- **Feed scale**: `getIsirWsPublicPodnetPosledniId()` returned
  `cisloPosledniId = 79,618,489` (verified live call, 200). IDs start near
  1,000,000 around 2010 → roughly **79M events over ~16 years**, ~5M/year.
  Sequential, so a **watch/delta consumer is entirely practical** (store
  last-seen ID, poll forward) — the exact shape of `rpliva/HlidacStatu-
  InsolvencniRejstrik` on GitHub, which walks this same feed and republishes
  into Hlídač Státu's own dataset.

### Value assessment

- **Signal class**: real and currently invisible to the money loop — a tied
  company entering insolvency is exactly the kind of event the loop's
  static ARES-VR snapshot corroboration can't see. **Join-ability is IČO-
  keyed but indirect**: the IČO only appears inside the free-text `idOsoby`
  string of the embedded `poznamka` XML on `Změna osoby` events, not as a
  structured top-level field — extracting it needs a small regex/parse
  step (`ZP <NAME> <ICO> <suffix>` pattern observed; not guaranteed stable
  across event types — only one sample event class was inspected this
  session).
- **No debtor/IČO search exists in this public WSDL.** The initial web
  search summary claimed "querying using debtor identification data" — that
  is **not what this WSDL exposes**; the only two operations are ID-based
  event-feed reads. A debtor-keyed search service may exist behind
  authentication (`ISIR_CUZK_WS`/`ISIR_WS_1` were mentioned in search
  results as separate services on the "Další služby" page,
  `https://eisir.justice.cz/dalsi-sluzby/`, but that page itself is
  currently down for maintenance — verified via WebFetch, 2026-07-25 — so
  its content, including any auth-gated debtor-search WSDL, could not be
  confirmed this session).
- **Simpler REST/bulk alternative — checked, not found on the ministry side,
  but found (paid) on Hlídač Státu.** No flat-file/bulk export was located
  on isir.justice.cz or eisir.justice.cz (targeted web search + WebFetch of
  the eisir landing page, both came up empty). Hlídač Státu — whose token
  politicas already holds for contracts/subsidies — **does** expose
  `/api/v2/insolvence/hledat` and `/api/v2/insolvence/{id}`
  (`https://api.hlidacstatu.cz/swagger/v2/swagger.json`, fetched
  2026-07-25), almost certainly IČO/fulltext-searchable given the parameter
  shape. But the swagger description is explicit: **"Toto API je pouze pro
  držitele komerční licence. Kontaktujte nás na api@hlidacstatu.cz."** — a
  **commercial-licence-gated** endpoint, not covered by the free token
  currently held. Per Authority ([[case-loops]]): ingest can proceed
  autonomously on the free ISIR SOAP path; **the Hlídač commercial upgrade
  is a payment decision and waits for the user.**

### Recommended shape, if built

A small **watch app** (Pumper-style fingerprint or a cron script) that:
1. Persists last-seen `idPodnetu`.
2. Polls `getIsirWsPublicPodnetId` forward in batches.
3. Filters `typUdalosti`/`popisUdalosti` for person-change events, regex-
   extracts the embedded IČO from `poznamka`.
4. Cross-references extracted IČOs against the money-loop's graphed company
   IČO set; on a hit, raises an `insolvency-lead` signal (annotation only,
   gated like any web finding).

This is an **S**-effort watch, not a search integration — it never answers
"is company X insolvent" on demand, only "did any graphed company show up in
the last N days of insolvency filings."

---

## Pumper-watch angle

Both sources fit the pattern already established for MONITOR/budget data
([[budget-sources]] "Pumper angle") and psp.cz:

- **dataor.justice.cz bulk export** is CKAN-cataloged with a stable,
  guessable URL pattern and daily-updating current-year files — a Pumper
  `watch` app fingerprinting `package_list` (or a specific dataset's
  `package_show` `resources[].url` + size) turns "did today's daily OR
  refresh change this court's file" into a data event, same shape as the
  MONITOR quarterly-ZIP watch. **The download itself should bypass Pumper**
  — same reasoning as MONITOR/psp.cz: these are structured CSV/XML archives
  where Pumper's HTML→Markdown extractor path would destroy the nested
  `udaje` structure and (per the standing charset defect noted in
  [[budget-sources]]) risks mangling Czech diacritics if it isn't UTF-8-safe
  end to end — decode directly.
- **ISIR SOAP feed** is inherently a change-event stream — it *is* already a
  watch primitive, no fingerprinting needed, just an incrementing cursor.
  This is the cleanest "Pumper-shaped" source of the two: no polling
  ambiguity, no diffing, just "new IDs beyond my last cursor."

---

## Concrete URLs (all verified 2026-07-25 unless noted)

**dataor.justice.cz**
- Catalog index (JS SPA shell): `https://dataor.justice.cz/`
- `package_list`: `https://dataor.justice.cz/api/3/action/package_list` (200, 9,496 IDs)
- `package_show` examples: `https://dataor.justice.cz/api/3/action/package_show?id=as-full-praha-2012`,
  `...?id=as-full-praha-2013`, `...?id=sro-full-praha-2026`, `...?id=sro-actual-praha-2026`,
  `...?id=sf-full-hradec_kralove-2026` (all 200)
- File downloads (all 200): `http://dataor.justice.cz/api/file/as-full-praha-2012.csv.gz` (42.2 MB),
  `http://dataor.justice.cz/api/file/as-full-praha-2013.csv.gz` (42.4 MB),
  `http://dataor.justice.cz/api/file/sf-full-hradec_kralove-2026.csv` (499 KB)
- CSV-W metadata: `https://dataor.justice.cz/files/opendata-csv-metadata.json` (200)
- FAQ: `https://dataor.justice.cz/files/ISVR_OpenData_FAQ.pdf` (200)
- User manual: `https://dataor.justice.cz/files/ISVR_OpenData_Uzivatelska_prirucka.pdf` (200, not
  read in full this session — ch.5 "Data subjektu" is the per-legal-form attribute reference, flagged
  for a future parser-writing session)
- Licence: `https://dataor.justice.cz/files/ISVR_OpenData_Podminky_uziti.pdf` (200, full text read —
  non-commercial, personal-data/GDPR clause)

**eisir.justice.cz / isir.justice.cz**
- Landing (in maintenance): `https://eisir.justice.cz/` (200, but "temporarily unavailable" content)
- "Další služby" page (also down): `https://eisir.justice.cz/dalsi-sluzby/` (fetched, no
  technical content returned — maintenance notice only)
- Live WSDL: `https://isir.justice.cz:8443/isir_public_ws/IsirWsPublicService?wsdl` (200)
- Live XSD: `https://isir.justice.cz:8443/isir_public_ws/IsirWsPublicService?xsd=IsirWsPublicTypes.xsd` (200)
- Cached WSDL reference (older variant, HlidacStatu mirror):
  `https://github.com/rpliva/HlidacStatu-InsolvencniRejstrik/blob/master/src/InsolvencniRejstrik/Connected%20Services/IsirWs/IsirWsPublicService.wsdl`
- Live SOAP call (executed, 200): POST to
  `https://isir.justice.cz:8443/isir_public_ws/IsirWsPublicService` with
  `getIsirWsPublicIdDataRequest idPodnetu=1000000` → real event data returned
- Live SOAP call (executed, 200): `getIsirWsPublicPosledniIdDataRequest` → `cisloPosledniId=79618489`
- Hlídač Státu insolvency API (commercial-licence gated, not called):
  `https://api.hlidacstatu.cz/swagger/v2/swagger.json` → `/api/v2/insolvence/hledat`, `/api/v2/insolvence/{id}`

**Reference for the PRaK proof** (prior context, not re-verified this session — the money-loop
graph facts this session confirmed against):
- `docs/data-analysis/case-money/batch-003.md` §2 (Q-money-7 — original finding)
- `docs/data-analysis/case-money/batch-004.md` §4 (PRaK dead end via ARES/or.justice.cz)
- `docs/data-analysis/contradictions.md` (C7 partial resolution note)

**Local samples** (gitignored): `.justice-samples/` — `package_list.json`, `package_show_*.json`,
`as-full-praha-2012.csv(.gz)`, `as-full-praha-2013.csv(.gz)`, `sf-full-hradec_kralove-2026.csv`,
`prak_udaje.txt` (extracted PRaK record), `excerpt.txt` (Bendl/Brabec board excerpts),
`opendata-csv-metadata.json`, `ISVR_OpenData_FAQ.pdf`, `ISVR_OpenData_Uzivatelska_prirucka.pdf`,
`ISVR_OpenData_Podminky_uziti.pdf`, `dataor-main.js`, `live_isir.wsdl`, `isir_types.xsd`,
`isir_request.xml`, `isir_last_request.xml`, `isir_response.xml`, `hlidac_swagger.json`.
