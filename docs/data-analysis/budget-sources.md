# Budget data sources — BudgetMirror (`/rozpocty`)

Research session, 2026-07-24. BudgetMirror is the last module still fully on mock
data (`TOWNS` in `lib/civic/data.ts`, `features/budget/BudgetMirrorPage.tsx`). Its
metrics are **debt per capita**, **capex ratio** (podíl kapitálových výdajů),
**budget saldo per capita**, **multi-year debt trend**, and **peer-group medians**
(e.g. "města 20–40 tis. obyvatel") across ~6 250 obcí. The mock cites "MONITOR /
Státní pokladna" as the intended source — this doc verifies exactly what that
takes. See [[onboarding]] for how the psp.cz slice was evaluated, and
[[feature-opportunities]] for where BudgetMirror sits in the product.

Every URL below was fetched/HEAD-checked live on 2026-07-24 unless flagged.

---

## Verdict up front

**MONITOR / Státní pokladna (MF ČR) is the authoritative primary, and it is
enough on its own — every BudgetMirror metric is obtainable, free, machine-readable.**
Two complementary access paths, both verified working:

1. **Bulk FINM extract (backbone)** — one ZIP per period, ALL municipalities:
   `https://monitor.statnipokladna.gov.cz/data/extrakty/csv/FinM/{YYYY}_{MM}_Data_CSUIS_FINM.zip`
   - Verified 200: `2023_12`, `2024_06`, `2024_12` (24 MB), `2025_06` (20 MB).
   - 9 CSVs inside; the core is `FINM201_*.csv` (128 MB uncompressed) — budget
     fulfilment keyed by **IČO** × **Paragraf** (odvětvové/COFOG) × **Položka**
     (druhové třídění), with three money columns: `ZU_ROZSCH` (schválený
     rozpočet), `ZU_ROZPZM` (po změnách), `ZU_ROZKZ` (skutečnost od počátku roku).
   - From this alone: **capex ratio** = Položka třída 6 (kapitálové výdaje) ÷
     (třída 5 + 6); **saldo** = příjmy (tříd 1–4) − výdaje (tříd 5–6); revenue and
     expenditure breakdowns. Encoding is **windows-1250, `;`-separated** (same
     decode discipline as the psp.cz UNL dumps — see [[onboarding]]).

2. **Per-municipality SIMU monitoring API (debt + population, ready-made)** —
   `https://monitor.statnipokladna.gov.cz/api/ucetni-jednotka/{ICO}/monitoring?obdobi={YYMM}`
   - Clean JSON, no auth. Returns 28 pre-computed SIMU indicators **including every
     metric the mock needs already calculated**:
     - `u1` Počet obyvatel — the per-capita denominator, no external join needed
     - `u16` Dluh / `u18` **Dluh na obyvatele** — exactly the mock's `debtPerCapita`
     - `u6` Saldo příjmů a výdajů po konsolidaci, `u10` Provozní saldo na obyvatele
     - `u12` Podíl kap. výdajů na prov. saldu, `u23/u24` podíl cizích zdrojů, likvidita
   - Verified live on Písek (IČO 00249998, období 2312): population 30 742, and
     `obdobi=2212` returns `u18 Dluh na obyvatele = 8 324,66`. Historical periods
     work → **debt trend** is N calls with `obdobi` = `2012…2512`.

**Recommended first slice:** FINM bulk for **capex ratio + saldo p.c.** (all obcí,
one file), joined to the monitoring API for **debt p.c. + population** (per-IČO,
cache annually). Bucket municipalities by `u1` population into peer groups, take
medians. Licence: MF ČR open data, free reuse, cite the source (see below).

**Effort to a first real `/rozpocty` slice: M.** The pieces:
- Parse FINM201 (win-1250, `;`, join Paragraf/Položka číselníky, filter class,
  handle `kon_*` consolidation columns to avoid double-counting) — **M**.
- Debt p.c. + population via monitoring API — **S** (ready-made; ~6 250 small JSON
  calls per period, trivially cacheable — annual data doesn't move).
- Peer buckets by population + medians — **S**.
- Wire one peer group (e.g. města 20–40 tis.) into `TOWNS` shape — **S**.

A **debt-only** slice (drop capex-from-FINM, take everything from the monitoring
API including `u12` as a capex proxy) collapses to **S** but the capex ratio would
be "podíl kap. výdajů na provozním saldu", not the mock's "…na výdajích celkem".
For the exact mock metric you need FINM.

---

## Source-by-source

| Source | Provides | Access | Format | Cadence | Licence | Cost | Coverage | Fit for BudgetMirror |
|---|---|---|---|---|---|---|---|---|
| **MONITOR — FINM bulk** (`/data/extrakty/csv/FinM/…zip`) | Budget fulfilment by IČO×paragraf×položka (schválený/po změnách/skutečnost) | Bulk ZIP (key-free) | CSV win-1250, `;` | Quarterly (also 06/12 semiannual; not published Jan & Jul for územní data) | MF ČR open-data podmínky užití (free reuse, attribution) | Free | All obcí + DSO + kraje | **Capex ratio ✓, saldo p.c. ✓, revenue/expenditure ✓.** Debt stock ✗ (flow only, class 8). |
| **MONITOR — monitoring API** (`/api/ucetni-jednotka/{ico}/monitoring`) | 28 SIMU indicators incl. dluh, dluh/obyv, saldo, počet obyvatel | REST JSON (key-free) | JSON | Annual (12-měsíční obdobi); quarterly obdobi also resolve | same | Free | Per-IČO (one call each) | **Debt p.c. ✓, saldo ✓, population ✓, trend ✓.** Capex ratio only as `u12` (proxy). |
| **MONITOR — Rozvaha bulk** (`/data/extrakty/csv/Rozvaha/…`) | Balance sheet (cizí zdroje: úvěry účty 451/281/283…) | Bulk ZIP | CSV win-1250 | Quarterly | same | Free | All účetní jednotky | Debt stock ✓ if you'd rather compute it than take `u16`; needs účetní know-how. |
| **MONITOR — struktura docs** (`/data/struktura/{finm,rozv,…}.xlsx`) | Column dictionaries per dataset | Direct XLSX | XLSX | — | — | Free | — | Reference for the parser (verified 200: `finm.xlsx`). |
| **MONITOR — číselníky** (`/data/csv/CIS_*.CSV`) | Codebooks (Paragraf, Položka, Finanční místo, kraj/NUTS…) | Direct CSV | CSV win-1250 | as needed | same | Free | — | Required JOINs; verified 200: `CIS_FINMISTO.CSV`. Time-sensitive (filter by period). |
| **ČSÚ — Počet obyvatel v obcích** | Authoritative population per obec k 1.1. | Product page → XLSX/PDF; DataStat CSV/JSON | XLSX/CSV/JSON | Annual (k 1.1.) | ČSÚ open data | Free | All obcí | Authoritative per-capita denominator if you don't trust MONITOR `u1`. |
| **ČSÚ — MOS / KROK / DataStat** | Municipal statistics incl. hospodaření obcí | Bulk CSV + JSON schema | CSV/JSON | Annual | ČSÚ open data | Free | 2000→ per obec | Secondary/cross-check; ČSÚ also republishes municipal revenue/expenditure. |
| **Hlídač státu API** (api.hlidacstatu.cz, token held) | Smlouvy, dotace, sponzoring, osoby | REST | JSON | continuous | free tier + token | Free (held) | contracts/subsidies | **Not a budget source** — no municipal-budget/rozpočet endpoint. Used by FollowTheMoney, not BudgetMirror. |
| **CityVizor** (cityvizor/cityvizor, AGPLv3) | Per-item budget viz, some towns | app + PostgreSQL/Node | — | — | AGPL-3.0 (code) | Free | **Voluntary — dozens of obcí only** | Competitor/complement, not a comprehensive upstream. Coverage far below MONITOR's ~6 250. |
| **MF ČR — Monitoring hospodaření obcí (SIMU)** legacy pages | Debt/liquidity indicator methodology | mf.gov.cz articles | XLSX/PDF per year | Annual (legacy 2009–2017 era) | MF ČR | Free | All obcí (historical) | Superseded by the live monitoring API above; keep for methodology only. |

Notes on cadence: the MONITOR DCAT topic page states datasets are **"čtvrtletně
aktualizovány"** (quarterly). For územní (municipal) FIN 2-12 M specifically, data
is **not provided in January and July** (per the methodology / data.europa entry) —
so the natural pull points are after Q1/Q2/Q3/annual closes.

---

## What CANNOT be gotten (honestly), and buy options

- **Nothing essential is paywalled.** Every mock metric — debt p.c., capex ratio,
  saldo p.c., trends, peer medians — is reachable from free MONITOR data. There is
  **no product worth buying** for BudgetMirror v1. Hlídač's paid tiers add contract
  volume/throughput, irrelevant to budgets.
- **Debt STOCK is not in FINM** (FINM class 8 "financování" is a flow — drawdowns
  and repayments, not the outstanding balance). The stock comes from either the
  monitoring API `u16/u18` (ready-made) or Rozvaha (compute from cizí zdroje). This
  is a modelling caveat, not a gap.
- **SIMU indicator CODES are not stable across methodology versions.** Verified:
  `u18` = "Dluh na obyvatele" for období 2212/2312, but `u18` = "Zadluženost
  zřízených PO" for 2012/2112. **Key historical trend series by indicator NAME, not
  by `uN` code**, or the trend will silently mix metrics.
- **The MONITOR licence page is a JS SPA** (`/datovy-katalog/licence`) — its exact
  text could not be extracted by fetch. The DCAT metadata on `data.mf.gov.cz`
  describes MF ČR **custom open-data conditions** ("speciální licenční podmínky"),
  not CC-BY/CC0; MF is a registered NKOD open-data publisher and the practical
  terms are free reuse with source attribution. **Confirm the exact wording** at
  `https://monitor.statnipokladna.gov.cz/datovy-katalog/licence` before publishing
  figures — treat as "free, cite MF ČR / MONITOR" until confirmed.
- **~6 250 per-IČO API calls per period** for the monitoring path. Not a blocker
  (annual data, cache once), but if you want debt for ALL obcí in one file you must
  compute it from the Rozvaha bulk — no bulk SIMU/monitoring extract was found
  (guessed `…/Monitoring/…zip` and `…/SIMU/…zip` both 404).

---

## Pumper angle

MONITOR fits the psp.cz mirror pattern **exactly**, and for the same reason:

- The bulk FINM/Rozvaha extracts are **versionless, diff-less binary ZIPs** — the
  URL just gains a new `{YYYY}_{MM}` each quarter. "Did a new quarterly extract
  appear?" is not answerable from the files. A **Pumper `watch` app fingerprinting
  `/datovy-katalog/transakcni-data`** (or the extract directory listing) makes a new
  dump a **data event**, identical to how `pumper-psp-opendata` makes psp.cz
  staleness detectable (`lib/ingest/sources/pumper.ts`, [[onboarding]]).
- The **download itself should bypass Pumper** — like the psp.cz UNL dumps, these
  are binary win-1250 CSV archives; a ZIP gains nothing from the HTML→Markdown
  apps and loses the byte-exact archive. Decode with `TextDecoder("windows-1250")`
  ourselves.
- **Same charset SPEC applies:** MONITOR CSVs are windows-1250; the reported Pumper
  fetch defect (drops non-latin-1 bytes to U+FFFD) would mangle Czech column
  headers and paragraf names if routed through Pumper's readable/extractor path.
  Another reason the bulk path stays direct.
- The per-IČO **monitoring API is clean JSON** and needs no Pumper — pull it
  directly like ARES/Hlídač in the money layer.

---

## Concrete URLs (all verified 2026-07-24 unless noted)

- FINM bulk: `https://monitor.statnipokladna.gov.cz/data/extrakty/csv/FinM/2024_12_Data_CSUIS_FINM.zip` (200, 24 MB)
- FINM structure dict: `https://monitor.statnipokladna.gov.cz/data/struktura/finm.xlsx` (200)
- Codebook example: `https://monitor.statnipokladna.gov.cz/data/csv/CIS_FINMISTO.CSV` (200, win-1250 CSV)
- Monitoring API: `https://monitor.statnipokladna.gov.cz/api/ucetni-jednotka/00249998/monitoring?obdobi=2312` (200, JSON, 28 SIMU indicators)
- Other datasets (same `/data/extrakty/csv/{dir}/…` pattern): `Rozvaha`, `ZiskZtraty`
  (výkaz zisku a ztráty), `PenezniToky`, `Priloha`, `FinU`/`FinSF`/`FinSPO`/`FinOSS`
  (dataset id → dir map from the `statnipokladna` R package, `R/datasets.R`).
- MF open-data portal (DCAT/NKOD): `https://data.mf.gov.cz/topics/monitor`
- Licence (SPA, verify manually): `https://monitor.statnipokladna.gov.cz/datovy-katalog/licence`
- ČSÚ population: `https://csu.gov.cz/produkty/pocet-obyvatel-v-obcich-rlm0s92pwn`;
  DataStat CSV/JSON: `https://data.csu.gov.cz/datastat/data/VYBER/OBY02AT02`
- ČSÚ MOS docs: `https://csu.gov.cz/statistika/databaze-mos-otevrena-data-dokumentace`
- CityVizor: `https://github.com/cityvizor/cityvizor` (AGPL-3.0)
- MF SIMU (legacy methodology): `https://mf.gov.cz/cs/rozpoctova-politika/uzemni-rozpocty/hospodareni-uzemnich-rozpoctu/monitoring-hospodareni-obci`
- Reference implementation to mirror the parsing logic: `statnipokladna` R package,
  `https://github.com/petrbouchal/statnipokladna` (URL builder = `R/datasets.R`
  `sp_get_dataset_url`; monitoring = `R/monitoring.R` `get_sp_monitoring`).
