# Money loop — batch 001 (calibration)

Case ① FollowTheMoney · 2026-07-24 · fleet mode (money loop) · Sonnet army + Opus top-3.
Population: **260 `linked_to` ties** (all `pending_review`), 196 companies, 2 287 contracts,
19.76 bn CZK reachable. This batch processed the **top 15 ties by deterministic signal**.

> Web-research doctrine held throughout: every enrichment claim carries `{claim, url,
> accessedAt}`; primary registries (ARES subject + ARES VR, Registr smluv via Hlídač,
> psp.cz) outrank media; media is narrative context only. **No `review_state` was
> touched — corroboration annotates, only a human verifies.**

## Triage (deterministic, PGlite copy · R4)

`scripts/case-loops/money/triage.ts` over `.pglite-copy-money`. Enumerated all 260 ties,
**0 dropped**. Added a deterministic **tie-class** dimension (calibration improvement, see
lessons): `owner-operator` (private s.r.o./a.s. the MP controls that supplies the state —
the real FollowTheMoney), `manager` (board-of-directors seat), `steward` (supervisory seat
on a public/nonprofit body whose money is its own public activity, not MP enrichment).

| dimension | count |
|---|---|
| ties enumerated | 260 / 260 (0 dropped) |
| with a parseable role period | 255 |
| with reachable money (contract or subsidy) | 177 |
| **owner-operator** ties | **37** |
| manager ties | 23 |
| steward ties | 200 |
| full accountability triangles | 2 |
| near-threshold ties (within 10% below 2M/6M limit) | 24 |
| absentee-manager crossover (Case ②) | 25 |

**Why tie-class mattered:** the raw money-volume ranking was dominated by stewardship ties
(MPs on the supervisory boards of public hospitals/utilities/universities — ARENA BRNO,
VODÁRNA PLZEŇ, Oblastní nemocnice) where **money does not flow to the MP**. Class-weighting
surfaced the genuine owner-operator archetype at the head of the queue.

## Dossiers (signal 0–5, ARES-VR corroboration)

Signal = story-worthiness as a *live* owner-operator conflict. Corroboration = ARES VR verdict.

| # | MP → company | class | corroboration | ARES-VR role period | temporal | signal |
|---|---|---|---|---|---|---|
| 1 | **Róbert Teleky → Teleky Medicus s.r.o.** | owner-op | registry-confirmed | jednatel 2012-04-26→, 50% od 2015-11-11 | **current** | **5** |
| 2 | **Pavel Karpíšek → Truhlářství Za farou s.r.o.** | owner-op | registry-confirmed | jednatel 2017-03-01→, 70% od 2016-03-30 | **current** | **5** |
| 3 | **František Petrtýl → GEMA MB s.r.o.** | owner-op | registry-confirmed | jednatel 1995-04-06→, 50% | **current** | **5** |
| 5 | Pavel Karpíšek → STYLE PD, s.r.o. | owner-op | registry-confirmed | 50% od 2022-12-10 | current | 4 |
| 4 | Tomio Okamura → MIKI TRAVEL PRAGUE | owner-op | **conflicting** | jednatel 1997→**2021-06-02** | historical | 3 |
| 6 | Aleš Juchelka → OCCAM PR s.r.o. | owner-op | registry-confirmed | 100% 2008→**2026-01-16** | historical (právě) | 3 |
| 11 | Andrej Babiš → CS CABOT, spol. s r.o. | owner-op | registry-confirmed | jednatel 1999→2004 | hist. direct / **indirect current** | 3 (comb.) |
| 7 | Radim Fiala → B.S. - KINGS s.r.o. | owner-op | registry-confirmed | společník 1997→**2018-11-13** | historical | 2 |
| 10 | Radim Fiala → IF FACILITY a.s. | owner-op | registry-confirmed | 2008→2014-10-02 | historical | 2 |
| 8 | Eva Decroix → Delices de papa s.r.o. | owner-op | registry-confirmed | 2015→**2021-06-18** | historical | 1 |
| 9 | Marek Ženíšek → Pojišťovna VZP, a.s. | steward | **conflicting** | představ. 2013-07-17→**2013-10-26** | historical | 1 |
| 12 | Miroslav Žbánek → TAXONIA CZ, s.r.o. | owner-op | registry-confirmed | 2003→2007-11-19 | **money-postdates-role** | 1 |
| 13 | Jana Černochová → Komwag a.s. | steward | **conflicting** | představ. 2012→**2021-12-20** | historical | 1 |
| 14 | Radek Vondráček → VaK Kroměříž a.s. | steward | registry-confirmed | představ. 2015→**2018-09-05** | historical | 1 |
| 15 | Martin Záhoř → TAZATA, spol. s r.o. | owner-op | registry-confirmed | jednatel 2006→2014-11-18 | historical (pre-office) | 0 |

## Top-3 stories found (cited, live owner-operator conflicts)

1. **Róbert Teleky — Teleky Medicus s.r.o. (IČO 29442044) — the clean archetype.** Current
   jednatel (since 2012-04-26) **and** 50% owner (since 2015-11-11) of an active family s.r.o.
   that is simultaneously a public-contract supplier (~11 M CZK), a subsidy recipient, and a
   party donor — the **only full accountability triangle** among the top 15, every hop
   registry-confirmed. Source: ARES VR 29442044.
2. **František Petrtýl — GEMA MB s.r.o. (IČO 61681679) — the reported one.** Founder and
   ~30-year continuous jednatel + 50% owner of a firm drawing ≥16.6 M CZK across 25+ public
   contracts in Mladá Boleslav, where he holds municipal/regional office. Independently
   reported by **iROZHLAS** (2023-03-01): the firm wins million-crown city contracts; the
   deputy mayor is his stepson. Source: ARES VR 61681679 + irozhlas.cz.
3. **Pavel Karpíšek — Truhlářství Za farou s.r.o. (IČO 04934482) + STYLE PD (26350416) — the
   cluster.** Current jednatel + **70% majority owner** of a joinery holding 22 public
   contracts (~10.2 M CZK), plus a current 50% stake in STYLE PD (which donated 215 000 CZK to
   his own party ODS in 2017–2020 — a donation edge missing from the graph). One MP, two live
   owner-operator ties. Source: ARES VR 04934482 + 26350416 + hlidacstatu.cz.

## Anomalies & data-quality signals (the batch's biggest finding)

**11 of 15 top ties carry a stale-"ongoing" or money-misattributed period.** The graph's
`linked_to` period comes from Hlídač's `datumDo` (absent = "ongoing"), which is unreliable;
ARES VR gives the real end date. Confirmed stale/misattributed:

- **Stale "ongoing"** (role actually ended): Okamura (2021-06-02), Juchelka (2026-01-16),
  Decroix (2021-06-18), Ženíšek (2013-10-26), Černochová (2021-12-20), Vondráček (2018-09-05),
  Fiala ×2 (2018 / 2014).
- **Money post-dates the role:** Žbánek — all 63 M CZK of contracts date 2017–2022, a decade
  after his 2003–2007 tenure (Hlídač per-year breakdown). Záhoř — role ended 2014, Registr
  smluv only starts 2016, so contracts are post-role.
- **Scope gap (missed indirect ownership):** Babiš/CS CABOT — the direct jednatel edge
  (1999–2004) is historical, but the live tie is **indirect**: shareholder DEZA a.s. (48% of
  CS CABOT) is an Agrofert subsidiary since 2007, and Agrofert is Babiš's conglomerate. The
  ~115 M CZK subsidy attaches to the indirect chain the graph does not model.
- **Hlídač period start is also coarse** (year-rounded to Jan 1): Teleky "2012-01-01" vs ARES
  2012-04-26; Karpíšek "2016-01-01" vs jednatel 2017-03-01.

**Leads surfaced (not gated in — need the donor registry):** undisclosed company→party
donations at STYLE PD (215 k ODS), OCCAM PR (240 k TOP 09), Delices de papa (40 k ODS). Each
contradicts the graph's "no party donation" and warrants a dedicated sponzoring pass.

## Gate

`scripts/case-loops/money/validate-payloads.ts` — **15/15** corroboration proposals validate
against the graph copy (every (person, linked_to, company) triple exists). **0 drops, 0
fabricated ids.** No IČO minted; all 15 IČOs confirmed to exist in ARES.
