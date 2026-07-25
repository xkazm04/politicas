# Justice-ministry DWH procurement — MSP-110/2024-MSP-CES

Research session, 2026-07-25. Traces the Ministry of Justice's (MSP) data-warehouse
procurement contract, the government GitLab lead, and the CSLAV/InfoData →
DWH migration, per the operator's lead. Format follows
[[justice-sources-registry]] / [[justice-sources-decisions]]. Every claim below
carries the URL it was verified at. Samples in `.justice-samples/` (gitignored):
`dwh_smlouva.pdf`/`.txt` (main contract, 65 pp.), `dwh_dodatek2.pdf`/`.txt`
(Amendment 2), `code_gov_cz_msp_projects.json`, `msp_projects_list.txt`.

---

## Verdict up front

**SKIP for ingestion. WATCH is not even warranted yet — there is nothing new to
watch.** The DWH (`MSP-110/2024-MSP-CES`, supplier CCA Group a.s., 55,258,900 Kč
bez DPH / 66,863,269 Kč incl. VAT, National Recovery Plan-funded) is an
**infrastructure replacement project**, not a data-scope expansion. It swaps
out the Ministry's aging CSLAV reporting platform for a modern data-warehouse
stack, but the contract's own requirements annex explicitly re-describes the
**same output granularity CSLAV always had**: aggregated
výkazy/statistické listy/přehledy agend/statistické ročenky (activity reports,
statistical sheets, agenda overviews, annual yearbooks) — i.e. exactly the
CONTEXT-grade aggregates [[justice-sources-decisions]] Source D already
assessed and declined to ingest. The contract does **not** add case-level,
statute-level, or entity-linked public output; if anything it *documents* that
the two existing open-data catalogues already known to politicas
(`dataor.justice.cz` — commercial register, money-loop territory; and
`kiosek.justice.cz/opendata/` — úřední desky notice boards, the sibling
agent's territory) are the only entity-linked things in the MSp open-data
family, and both predate and sit outside this DWH project's scope. No new
joinable-to-graph surface was found.

There is a real, live, **public** government GitLab (`code.gov.cz`) and the
MSp does use it — but not, as far as could be verified, for this project; its
DWH source code lives in a private client-side GitLab instance the contract
calls "GitLab Objednatele" that was not identified by URL and could not be
reached.

| Finding | Verdict | Effort | Consumer |
|---|---|---|---|
| DWH itself (reporting platform swap) | **Skip** — no new data surface, verified against the contract's own requirements text | — | None |
| `code.gov.cz` (real public gov GitLab) | **Skip for now** — real and public, but the MSp's 8 visible public repos there are unrelated (debt-relief registry, victims' compensation fund, judicial candidates, frontend/bootstrap/utility libs); no DWH code found there | — | Bookmark only, if a future MSp source needs code-level inspection |
| Old CSLAV/InfoData path | **Note, don't act** — `cslav.justice.cz` is still live (not yet decommissioned); contract specifies a two-month parallel-run cutover, timeline not independently confirmed as complete | — | None |

---

## 1. The contract — MSP-110/2024-MSP-CES

### What it is, verified

- **Title**: "Smlouva o dílo na vývoj a implementaci platformy datového skladu
  justice" (Contract for Work on Development and Implementation of the
  Justice Data Warehouse Platform), č. **MSP-110/2024-MSP-CES**, č.j.
  MSP-51/2024-OI-SML. Procured as an above-threshold open tender under
  zákon č. 134/2016 Sb. (ZZVZ), title of the underlying public contract:
  **"Implementace a následný provoz a podpora datového skladu justice."**
- **Parties**: Objednatel (customer) = Česká republika – Ministerstvo
  spravedlnosti, IČO **00025429**, sídlo Vyšehradská 16, Praha 2. Zhotovitel
  (contractor) = **CCA Group a.s.**, IČO **256 95 312**, DIČ CZ25695312,
  sídlo Karlovo náměstí 288/17, Praha 2, zapsaná Městským soudem v Praze,
  vložka 5556, oddíl B. Notably, **CCA Group is also the incumbent supplier
  who has maintained the CSLAV system it is now being contracted to replace**
  (contract text: "provozu informačního systému CSLAV a s ním
  federalizovaných systémů dodávaných firmou CCA Group a.s." — same vendor on
  both sides of the migration).
- **Price**: **55,258,900 Kč bez DPH**, DPH 21 % = 11,604,369 Kč, celkem
  **66,863,269 Kč vč. DPH** (Článek 3.1). Paid in two milestone tranches: 30%
  after Phase 2 acceptance, 70% after Phase 4 (final) acceptance.
- **Funding**: explicitly financed from the **Národní plán obnovy** (National
  Recovery Plan / EU Recovery and Resilience Facility funds), under component
  "1.2 Digitální systémy veřejné správy", pillar "Digitální transformace",
  as part of a "digitální justice" enablement project (Preamble E).
- **Companion contract**: signed simultaneously, a separate "Servisní smlouva
  o údržbě, podpoře a rozvoji platformy datového skladu justice" covers
  ongoing maintenance/support/development after go-live — not itself fetched
  this session (referenced in Preamble B only).
- **Timeline**: platform implementation targeted for completion in 2024, with
  subsequent reporting implementation and further source-system onboarding
  "do konce května 2026" (by end of May 2026) (§3, requirements annex intro).
  Phases are labelled T1–T4 in a Harmonogram (schedule) that is itself an
  output of Phase T1, not fixed in the contract text — actual phase dates are
  not stated in the contract body itself (a gap, see below).
- **Amendment**: **Dodatek č. 2** exists and was also fetched (below), showing
  the requirements annex (Příloha č. 1) was itself revised at least once
  after signing; the amendment's own visible content is the same 65-page
  requirements-annex re-issue (component/architecture descriptions), not a
  price or scope change I could isolate in this session — flagged as a gap,
  not asserted either way.

### Technical scope — what the contract actually specifies

- **Core objective, verbatim**: *"Jádrem Díla je odstranit jednu ze
  současných komponent, informační systém CSLAV (Centrální statistické listy
  a výkazy), který slouží jako datový sklad a reportovací platforma zároveň
  pro jednu z nejdůležitějších BI agend resortu – pro reporting dat ze soudů.
  Jiným datovým skladem v současnosti justice nedisponuje."* (§3, p.9) — i.e.
  this is explicitly a **like-for-like platform replacement**, not a new data
  product. CSLAV today: Oracle 19c-backed, ~5 TB total, key table `VC` (věc)
  alone holds **125 million records** plus ~50 satellite tables (§3.3).
- **Deliverable**: a new "Platforma" (data-warehouse platform) with defined
  layers (STG/staging, then an "INT" integration layer unifying data from
  different source applications), able to onboard both the existing CSLAV
  source systems and future justice-sector information systems, feeding two
  consumption paths: a reporting tool and (per Amendment 2 text, line ~2360)
  a second, unspecified consumption mode.
- **Reporting outputs to be replicated/replaced** (§3.4, requirements annex,
  describing today's state that the new platform must match/improve):
  výkazy (activity reports) at monthly/quarterly/half-year/annual cadence,
  per-"řešitel"/senát breakdowns (judge/panel-level internal reporting, not
  public), organizational/regional/national summary aggregates, and
  "statistické listy" (statistical sheets) supporting internal search/detail
  view/XLS export — with the **public-facing output limited to "vybrané
  výstupní sestavy"** (selected output reports) published via InfoData, i.e.
  the same aggregate-only public surface [[justice-sources-decisions]]
  already found.
- **Migration requirements** (§5.4 of the requirements annex): historical
  data (~10 years) must be migrated from non-CSLAV systems; CSLAV data itself
  migrated only "co nejblíže" (as close as possible) to reporting-ready
  layers; a **two-month parallel run** with CSLAV is required for validation;
  only after that does MSp retire CSLAV-side reporting, and CSLAV is retained
  temporarily afterward purely as a pass-through for ISYZ data before final
  shutdown (§4258–4266) — i.e. **CSLAV is not switched off atomically**; it
  has a scheduled but not date-fixed wind-down.
- **Open-data section (§3.5)**: the requirements annex **documents, but does
  not expand**, the existing open-data landscape: `dataor.justice.cz`
  (commercial-register open data, ISVR-sourced, 7,974 datasets at time of
  writing — matches [[justice-sources-registry]] Source A, count differs
  slightly from the 9,496 this repo found on a later date, consistent with
  ongoing growth) and `kiosek.justice.cz/opendata/` (194 datasets, úřední
  desky) — explicitly flagged as the sibling agent's territory, **not
  independently re-verified here**, only quoted from the contract's own
  description. The annex notes the InfoData/kiosek public web apps expose
  machine-readable metadata but **no live API** ("finální webová aplikace
  infodeska.justice.cz už API neposkytuje").
- **Source-code / repository requirement — the GitLab finding** (§5.7,
  N-6.4-05 through N-6.4-07 of the requirements annex): the contractor
  **must use Git in "GitLab Objednatele"** (the customer's/MSp's own GitLab
  instance) for all source code, maintaining a `master` branch that always
  matches the deployed production version, submitting each release as a
  tagged (`v*`) merge request with a full changelog, and using a ticketing
  system for all change management. Contractual penalties (30,000 Kč per
  incident) apply if a phase's output is **not uploaded and deployed via
  "GitLab Objednatele."** This is real contractual language, but **the
  contract text never gives the GitLab instance's URL** — "GitLab
  Objednatele" is simply MSp's own GitLab, presumed to be a private,
  authenticated instance for this project. See §2 below for what was found
  when searching for it.

### Concrete URLs (all fetched 2026-07-25)

- Main contract PDF: `https://smlouvy.gov.cz/smlouva/soubor/37672552/Smlouva%20o%20d%C3%ADlo_DWH.pdf`
  (200, 3.99 MB — downloaded to `.justice-samples/dwh_smlouva.pdf`, text extracted with
  `pdftotext -layout` to `.justice-samples/dwh_smlouva.txt`, 5,171 lines)
- Amendment 2 PDF: `https://smlouvy.gov.cz/smlouva/soubor/39531692/Dodatek%20%C4%8D.2%20-%20DWH.pdf`
  (200, 1.85 MB — `.justice-samples/dwh_dodatek2.pdf`/`.txt`, 3,180 lines)
- Press coverage corroborating the same facts (contractor, purpose, first
  connected systems): `https://www.ceska-justice.cz/2025/04/datovy-sklad-na-ministerstvu/`,
  `https://msp.gov.cz/en/web/msp/-/ministerstvo-spravedlnosti-%C3%BAsp%C4%9B%C5%A1n%C4%9B-spustilo-datov%C3%BD-sklad`
  (both 200, fetched via WebFetch)

---

## 2. The government GitLab — found, public, but not the project's

### `code.gov.cz` is real, live, and public

- `https://code.gov.cz/` → HTTP 302 (redirects to the app root — confirmed
  reachable, not dead).
- `https://code.gov.cz/msp` → HTTP 200. This is a real GitLab group,
  `"Ministerstvo spravedlnosti"`, group id 8, `"visibility":"public"`,
  created 2019-04-10, confirmed via the **anonymous GitLab REST API**:
  `https://code.gov.cz/api/v4/groups/msp?with_projects=false` (200, JSON).
- Full public-project listing pulled via
  `https://code.gov.cz/api/v4/groups/msp/projects?per_page=100` (200, JSON,
  saved to `.justice-samples/code_gov_cz_msp_projects.json`): **8 public
  repositories** under the MSp namespace —
  `debt_relief_entities` ("Seznam subjektů pomoci při oddlužnění"),
  `insolvency-accredited_entities`, `social_insurance`, `azahara-schema`,
  `egov-utils`, `victims_compensation_fund`, `judicial_candidates`,
  `bootstrap-custom` (a styling library). **None relate to CSLAV, the data
  warehouse, or statistics/reporting.**
- The Ministry also runs a separate public presence on GitHub,
  `https://github.com/MinistryOfJusticeCZ` (confirmed via WebFetch, live) —
  pinned repos include `azahara_schema`, `egov_utils`, accessibility
  training material, and internship projects; again **nothing DWH-related**.

### The project's actual "GitLab Objednatele" was not located

The contract's N-6.4-05 mandate (§ above) requires the contractor to push
code to "GitLab Objednatele" — grammatically this just means "the customer's
GitLab," and given `code.gov.cz/msp` is MSp's known public GitLab presence,
it is a reasonable inference that this is the same instance, just used for a
**private, non-public project** not visible to the anonymous API (GitLab's
API only lists projects visible to the requester; a private DWH project
would simply not appear in the public listing above). This is an inference,
not a verified fact — no contract text, press release, or search result
gave a direct URL or project slug for the DWH repository itself. **Treat
"DWH code lives in a private code.gov.cz/msp project" as the most likely
explanation, not a confirmed one.**

### Concrete URLs (fetched 2026-07-25)

- `https://code.gov.cz/` (302, live)
- `https://code.gov.cz/msp` (200)
- `https://code.gov.cz/api/v4/groups/msp?with_projects=false` (200, JSON)
- `https://code.gov.cz/api/v4/groups/msp/projects?per_page=100` (200, JSON, 8 projects)
- `https://github.com/MinistryOfJusticeCZ` (200, live, ~11 visible repos, none DWH-related)

---

## 3. Old → new statistics path: CSLAV/InfoData status

- **`cslav.justice.cz` is still live.** `curl -L http://cslav.justice.cz/InfoData/uvod.html`
  → HTTP 200 (upgrades to https transparently, no error, no maintenance
  banner encountered this session). This matches [[justice-sources-decisions]]'s
  same finding from the same date. **Not yet decommissioned**, consistent
  with the contract's own two-month-parallel-run + phased-retirement plan
  (§5.4 above) rather than an abrupt cutover — CSLAV is scheduled to keep
  running in a reduced capacity even after the new platform's reporting
  goes live.
- **What the contract says will replace it**: the new "Platforma" absorbs
  CSLAV's reporting role entirely (its explicit "core objective" is to
  *remove* CSLAV), then optionally retains a temporary CSLAV pass-through
  purely for one source system (ISYZ) until that, too, is migrated off.
  No new public output type is introduced — the successor's public surface
  is described in the same terms as CSLAV's ("vybrané výstupní sestavy").
- **What is actually live today, per public reporting**: two systems have
  been connected to the new DWH so far — the **misdemeanor registry
  (rejstřík přestupků)** and the **list of experts and interpreters (seznam
  znalců a tlumočníků)** — per the Ministry's own April 2025 announcement
  (`https://msp.gov.cz/en/web/msp/-/ministerstvo-spravedlnosti-%C3%BAsp%C4%9B%C5%A1n%C4%9B-spustilo-datov%C3%BD-sklad`,
  200, fetched) and corroborating press coverage
  (`https://www.ceska-justice.cz/2025/04/datovy-sklad-na-ministerstvu/`, 200,
  fetched). CSLAV/InfoData itself — the actual justice-statistics reporting
  chain the contract's core objective targets — was **not** reported as
  migrated/cut over as of that April 2025 announcement; neither source
  states a completion date for the CSLAV migration specifically.
- **`kiosek.justice.cz/opendata/`**: mentioned in the contract's own
  open-data section (194 datasets, úřední desky) — per task instructions
  this is the sibling agent's assessment target and was **not independently
  sampled** here; only the contract's own count/description is quoted above.

---

## 4. Honest gaps

- **No `smlouvy.gov.cz` contract-record (metadata) page was reached** — only
  the two PDF attachments (main contract, Amendment 2), fetched directly by
  their known file URLs (`/smlouva/soubor/{id}/...`). The Registr smluv
  search UI (`https://smlouvy.gov.cz/vyhledavani`) is a JS SPA; WebFetch
  returned only the empty search-form shell, not results, for both the
  identifier search and a Hlídač Státu fulltext lookup
  (`https://www.hlidacstatu.cz/api/v2/search?...` → HTTP 404). This means
  the **publication date, signature date, and effective date** of the
  contract were **not independently confirmed** — the PDF's own signature
  blocks are blank template fields in the extracted text (pdftotext could
  not recover an inline signature timestamp, if any exists as an image or
  qualified e-signature metadata not captured by text extraction). Report
  this as unverified rather than guessed.
- **Amendment 2's actual delta (what changed vs. the original contract) was
  not isolated.** Both PDFs were extracted and searched, but Amendment 2's
  visible content in this session was dominated by a full re-issue of the
  same 65-page requirements annex; a diff against the original to find the
  actual amended clauses was not performed (would need a proper PDF diff
  tool, not available this session — flagged, not assumed benign).
- **Whether "GitLab Objednatele" is `code.gov.cz` or a separate, unnamed
  internal MSp GitLab instance was not confirmed** — see §2, held explicitly
  as an inference.
- **CSLAV's actual shutdown/completion date is unknown** — only that it was
  still live as a portal on 2026-07-25 and that the contract specifies a
  phased, not hard-cutover, retirement.
- **The companion "Servisní smlouva"** (maintenance/support contract, signed
  alongside the main contract per Preamble B) was **not located or fetched**
  this session — only referenced by name in the main contract's preamble.
- WebSearch budget was exhausted mid-session (200/200 calls used across the
  whole conversation, not all by this task) — the final planned search (a
  Hlídač Státu public-search cross-check for the contract's Registr smluv
  metadata page) could not be run; the WebFetch fallback against Hlídač's
  API also 404'd. This is the direct cause of the metadata-page gap above.

---

## Local samples (gitignored)

`.justice-samples/dwh_smlouva.pdf`, `dwh_smlouva.txt` (main contract, extracted),
`dwh_dodatek2.pdf`, `dwh_dodatek2.txt` (Amendment 2, extracted),
`code_gov_cz_msp_projects.json`, `msp_projects_list.txt` (code.gov.cz/msp public
project listing).
