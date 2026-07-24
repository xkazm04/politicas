# Case ② Effort — Batch 003 (tenure + divergence retune, Opus money-verification routing)

**Term** PSP10 (207 MPs) · **army** 35 · **coverage** 85/207 (41.1 %) · **mean signal** 0.500
**Engine** PGlite SQL on `.pglite-copy-effort` (R4, population < 100k) · **no live write, no commit** (fleet;
money-loop and law-loop confirmed live-concurrent in the same working tree this batch — see §Fleet note).
**Models** driver + army on Sonnet (7 grouped agents × 5 MPs, 0 Opus in the army) + **2 Opus calls**
(the batch's full budget): (1) targeted verification of the 13 money-crossover dossiers + the Kott
conflict-of-interest lead, per the kernel rule the batch-002 reflection established; (2) end-of-batch
reflection/QA. Every rendered claim carries `{claim, url, accessedAt: 2026-07-24}`; primary registries
(psp.cz, ARES/justice, Hlídač, vlada.gov) outrank media. Public-role facts only.

## Q-effort-5 — deterministic tenure annotation (new this batch)

`contribution.ts` never had a real per-MP start date to normalize against — batch 002 named 4 replacement
MPs by hand via LLM enrichment. Batch 003 grounds this deterministically: the mandate table's own
`mandateFrom`/`mandateTo` columns are almost entirely null in this ingest (checked: only 1/208 persons has
>1 distinct value), but `membership.fromAt` on the person's row in **organ 174** (`abbrev="PSP10"`, the
chamber itself, `kind="member"`) is populated for all 207/207 and gives a real per-person seating date.

**Method**: mode of the 207 start dates = **2025-10-04** (200/207, the general election) → `full_term`;
any other date → `replacement`. **Result: 7 replacement MPs** (up from batch 002's 4 named cases — 3 new:
Libor Forman, Martin Šmída, Vlastimil Hebr):

| MP | mandate arose | tenure (days, ref 2026-07-24) |
|---|---|---|
| Jiří Kotlík | 2026-06-18 | 35 |
| Libor Forman | 2026-05-29 | 55 |
| Josef Nerušil | 2026-03-11 | 135 |
| Martin Šmída | 2025-11-05 | 260 |
| Vlastimil Hebr | 2025-11-03 | 262 |
| Jiří Penc | 2025-11-03 | 262 |
| Jana Demjanová | 2025-11-03 | 262 |

**End-date awareness (added after the Opus reflection caught the gap)**: a fromAt-only classifier
misclassified every DEPARTED MP as a 293-day `full_term` — including the four never-sworn phantoms who
served zero effective days. `membership.toAt` on the same organ-174 row carries the departure date for
exactly the 7 vacated seats; the classifier now emits two further classes: **`never_seated`** (toAt set +
the `never_cast_ballot` signature: Brabec, Kubis, Zarzycký, Kučerová — 30-33 formal days each) and
**`departed`** (toAt set, actually served: Šichtařová 158d, Beran 238d, Kott 258d — matching batch-002's
resignation findings and Kott's NKÚ departure exactly). `effort_tenure_end` is emitted where toAt exists.
Semantics note: `fromAt` is the date the mandate AROSE (mandát vznikl), not the oath date — UI copy must
say "mandát vznikl".

Payload: `payloads/batch-003-tenure.json` (207/207 proposals, `effort_tenure_days` + `effort_tenure_class` +
`effort_tenure_start`) — **gated 207/207 PASS**. Contextual annotation only; `computeContribution`'s inputs
and outputs are untouched. `triage.ts`'s "bottom" lens is now also tenure-normalized (excludes
`replacement` MPs, not just `never_cast_ballot`) — a code-quality fix caught and corrected during this
batch's own development (see §Lessons).

## Q-effort-6 — componentDivergence retune, with discriminative-power evidence

Batch 002's `componentDivergence` (stddev of the 6 raw 0-1 normalized components) was near-degenerate:
**mean 0.314, sd 0.098, 38 distinct values/207** — most MPs clustered 0.25-0.45 regardless of actual
one-sidedness. Retuned per the frontier note: **club-relative** (z-score each component against a cohort
mean/sd instead of an absolute 0-1 scale) and **participation-paired** (the cohort is `club × tenure_class`,
using Q-effort-5's new annotation, so short-tenure MPs are never compared against full-term participation
denominators; cohorts under 3 fall back to club-wide, then population-wide).

**Validation (before using it for ranking — kernel guardrail):**

| | old (batch 002) | new (batch 003) |
|---|---|---|
| mean | 0.314 | 0.762 |
| sd | 0.098 | **0.323** (3.3×) |
| distinct values (2dp) / 207 | 38 | **95** |
| range | 0.076 – 0.496 | 0.20 – 2.07 |

Full histograms in `payloads/batch-003-divergence-validation.json`. **PASS** — sd more than tripled,
distinct-value count roughly doubled; safe to rank on. The mid-band divergence threshold in `triage.ts` was
recalibrated from 0.35 (old scale) to 0.9 (new scale, roughly the top quartile) to preserve the lens's
intent (one-sided work profile in a mid-range score, not floor/ceiling artifacts).

## Army (35, 7 Sonnet groups × 5)

Lenses: 6 top-composite, 4 bottom-composite (now tenure- and phantom-filtered), 4 quiet-workhorse-legislative
(0 oversight slots — **the oversight-flavour quiet-workhorse population is now exhausted, 5/5 covered across
batches 001–002**: Ratiborský, Žáček, Krejčí, Samaš, Beran), 5 contested-vote-rebellion overlap, 6
component-divergence (V2 metric), 17 high-triage filler. The high-triage share (17/35, up from batch 002's
1/30) is itself a finding: as coverage deepens, the sharpest lenses (extremes/workhorse/absentee) exhaust
faster than filler slots — the mean-signal drop this batch (0.744→0.500) is largely this composition shift,
not a Sonnet quality regression (confirmed by the Opus reflection, §below).

## Headline finding — a THIRD structural floor-artifact class: mid-term role change

Distinct from batch 001's never-sworn phantom mandate and batch 002's replacement-MP tenure artifact,
batch 003's army surfaced a cluster of MPs whose LOW plenary activity is explained by taking on a bigger job
mid-term, not disengagement:

- **Karel Havlíček** — 1st Deputy PM + Minister of Industry and Trade since Dec 2025 (his "bottom/divergence"
  triage flags are an artifact of `committee_count=0` following the appointment).
- **Petr Macinka** — Deputy PM + Foreign Minister since Dec 2025 (largest componentDivergence in the batch).
- **Alena Schillerová** — Finance Minister since 15.12.2025.
- **Andrej Babiš** — Prime Minister since 9.12.2025 (signal 0.9, the batch's highest — near-zero interpellations
  and a steep speech-turn drop are the PM-handover artifact batch 001 already named for Fiala, recurring).
- **Lubomír Metnar** — Interior Minister (his third cabinet post) since 15.12.2025.
- **Barbora Urbanová** — elected Deputy Speaker of the Chamber 5.6.2026 (a real promotion, not executive
  branch, but the same "score window predates a role change" shape).

Six MPs, one batch — this is dense enough to name as its own class alongside the never-sworn and
replacement artifacts, all under the umbrella "the young-term floor is dominated by structural artifacts."
Product implication: `effort_low_score_reason`'s existing `minister`/`deputy_pm`/`prime_minister` values
already cover most of these; Metnar and Urbanová are new instances of `minister`/an uncovered
"institutional promotion" case respectively.

## Money-crossover Opus verification (13 MPs + 1 conflict-of-interest lead)

Routed per the batch-002-established kernel rule: Válková, Foldyna, Teleky, Hladík, Hrnčíř, Bartošek,
Kubíček, Decroix, Pařil, Babiš, Výborný, Vlček, Okleštěk (linkedCompanies>0 or contractCzk above ~1M CZK),
plus Josef Kott (flagged by his own dossier as an Agrofert-group ZZN Pelhřimov employee while Control
Committee vice-chair — outside the mechanical filter but a real conflict-of-interest claim). Full verdict in
§Opus verification below.

**Cross-cutting lead — corrected count per the Opus reflection**: the same suspicious "OSVČ" IČO
`04627695` appears in the `linkedCompanies` data of **10 of the 35 army MPs — 10 of the 13 MPs with ANY
linked company** (Válková, Foldyna, Teleky, Hladík, Kubíček, Decroix, Pařil, Babiš, Vlček, Okleštěk),
independently flagged by 6 of 7 groups; two groups resolved it to mutually inconsistent entities. This is a
systemic entity-resolution defect in Case ①'s `linked_to` ingest and the reflection recommends treating it
as a **hard blocker on any money-crossover product surface** until reconciled against ARES REST directly
(money loop's boundary — escalated in handoff, not touched).

## Build (R=1) — quiet-workhorse surface on /zebricek (O-effort-3)

The existing `effort_workhorse` prop (12 MPs, batch 001/002) was a bare boolean with no flavour. Backfilled
`effort_workhorse_flavour` (legislative|oversight, P31) deterministically from the stable triage lens —
`payloads/batch-003-workhorse-flavour.json`, **15 MPs (11 legislative, 4 oversight), gated 15/15 PASS**.
A departure guard (added after the Opus reflection caught it) drops departed/never_seated MPs from the
backfill — Karel Beran (oversight flavour, resigned 2026-05-29) would otherwise have been badged as a
CURRENT quiet workhorse on /zebricek. Filip Turek's dossier-level "government climate commissioner" role is
an enrichment claim, not a deterministic departure — left in the backfill, flagged for the reviewer in the
handoff.
Shipped: `lib/analysis/workhorse-flavour.ts` (+5 tests, symmetric-treatment assertion), `WorkhorseBadge.tsx`,
wired into `LeaderboardTable.tsx` as a compact per-row badge plus a symmetric two-button filter (each button
only renders if that flavour has ≥1 MP; the whole filter row is hidden if no MP carries the prop — graceful
degradation). Czech-first inline copy (messages/*.json is shared/off-boundary in fleet mode, same precedent
as `LowScoreReasonBadge`/`TrendPanel`); no new colors (reuses the existing `cobalt` token).
`npm run check`: **typecheck ✅ · lint ✅ · tests 176/176 ✅** (up from 166; +10 new — 8 workhorse-flavour
unit tests + 2 from other test-file changes in this session).

## Gate

`gate.ts batch-003-props.json`: **35/35 PASS, 0 DROP** (one round-trip fix: group E's `raw_flag` prop was
mis-namespaced — corrected to `effort_data_flag` in the source file before the final merge). Tenure and
workhorse-flavour payloads also gate clean (207/207, 16/16).

## Fleet note

`git status` at merge time showed unrelated modifications outside this case's boundary
(`features/money/*`, `lib/db/pglite-store.ts`, `lib/db/ddl.ts`, `lib/db/types.ts`, `app/penize/kontrola/`,
`.env.example`) — confirms the money loop is live-concurrent in this same working tree this batch, same as
batch 002's observation. Not touched, not investigated.

## Metrics

| metric | value |
|---|---|
| units done / total | 35 / 207 (batch), 85 / 207 (cumulative, 41.1 %) |
| mean signal (yield proxy) | 0.500 (down from 0.744 — composition: 17/35 high-triage filler vs batch 002's 1/30, see §Army) |
| cost/unit | 7 Sonnet grouped agents (5 MPs each) + 2 Opus calls (money verification + reflection) |
| gate pass rate | 35/35 (100 %), plus 207/207 tenure + 15/15 workhorse-flavour |
| citations | 152 across 35 dossiers |
| new tenure-annotated | 207/207 (193 full_term, 7 replacement, 3 departed, 4 never_seated) |
| componentDivergence sd | 0.098 → 0.323 (3.3×), validated before use |
| new structural class | mid-term role change (6 MPs: Havlíček, Macinka, Schillerová, Babiš, Metnar, Urbanová) — the reflection reframes this as the third sub-case of one meta-class, `role_window_mismatch` (never seated / seated late / role changed mid-term), and excludes Urbanová (a promotion, not an artifact) |
| oversight-flavour quiet workhorses | 5/5 population coverage reached — lens exhausted (4 still serving; Beran departed) |

## Opus money-crossover verification (call 1 of 2, maximum depth) — summary

Full verdicts embedded in `payloads/batch-003-props.json` → `opusMoneyVerification`. The headline result:

**DO NOT persist the money/company sentences as-is.** 6 of 14 verified units carry real errors, and 5 point
the SAME way — **false negatives on personal register roles** (Válková, Hladík, Bartošek, Hrnčíř, Pařil;
Foldyna minor). Root cause is systematic, not individual: the Sonnet groups resolved company ties through
ARES's plain `/ekonomicke-subjekty/` endpoint (or mirrors), **which never contains officers** — so "could
not find a personal link" findings were unverified negatives presented as caution. The Opus pass re-resolved
every tie through `/ekonomicke-subjekty-vr/{ico}` (public-register endpoint with statutory organs and
shareholders) and found, among others: Hladík ON the ARENA BRNO supervisory board 2020-2023 (through the
5.39bn procurement window); Bartošek currently serving in the Nadační fond Nemocnice Dačice statutory organ
since 2013 (pairs with his 433k contractCzk); Hrnčíř still the OWNER of his firm (only the jednatel role
ended 2021); Pařil a current jednatel+společník of both companies his dossier called unconfirmable.
`effort_work_themes` / `effort_bill_focus` / `effort_public_role` are sound throughout and safe to persist.

**Shared-IČO mystery SOLVED**: 04627695 is a real entity — the *Agrární demokratická strana*, whose ARES
`obchodniJmeno` field is literally the junk string "OSVČ". The money loop's ingest exact-name-matches MPs
who declare self-employment ("OSVČ") against ARES and lands on this micro political party — **every
self-employed MP in the graph is falsely linked to it** (10/35 in this batch, therefore repo-wide).
contractCzk 0 so money totals are unharmed, but it is a false accusatory edge class. Fix belongs to the
money loop: blacklist generic tokens before the exact pick, purge existing 04627695 edges.

**Positive verifications**: Kott's Agrofert/Control-Committee conflict-of-interest lead CONFIRMED beyond
Wikipedia (iROZHLAS, NKÚ election verified) — and his `linkedCompanies` is genuinely empty, meaning the
mechanical money-crossover filter really did miss a live COI (claim-type routing vindicated). Vlček's SOMPO
board exit (2025-02-04, pre-term) is resolvable and exculpatory. Babiš, Teleky, Okleštěk CONFIRMED.

**Proposed kernel rule**: never assert ABSENCE of a company tie without an ARES VR lookup — batch 002's
rule guarded over-claiming; batch 003's live failure mode is under-claiming.

## Opus reflection (call 2 of 2, maximum depth) — summary

Full text in `handoff.md`. Verdict highlights:
- **Quality**: baseline discipline held — 152 citations, 35/35 with a psp.cz primary, hedging strong and
  self-initiated, positive symmetry real, zero contradictions with batches 001/002 on cross-referenced
  threads (Kott↔Kotlík, Šichtařová↔Nerušil, Beran↔Forman all reconcile). Four concrete defects: Foldyna's
  headline over-strong on a money figure his own notes explain (batch-002's failure mode recurring);
  Kott's Agrofert/NKÚ conflict claim sourced only to Wikipedia; Výborný's prose asserts "šest autorsky
  vedených tisků" vs 2+1 documented in his own dossier (case gate (e) breach); Bartošek's tenure prose
  contradicts his own tenureDays. **Notably, 2 of the 4 defects are NON-money** — qualifying batch-002's
  "the only weakness class is money" conclusion.
- **Biggest finding reframed**: the shared-IČO contamination is 10/13 money-linked MPs, not 4 — a systemic
  Case-① entity-resolution defect, recommended as a hard blocker on money-crossover surfaces.
- **Q-effort-5**: sound source, but the fromAt-only classifier was materially wrong for departed MPs —
  **fixed in-batch** (see §Q-effort-5); the reflection's predicted corrections (4 never_seated at ~30 days,
  Šichtařová/Beran/Kott as departed) were reproduced exactly by the fixed classifier.
- **Q-effort-6**: real improvement, honest validation, but three residual distortions: the <3 cohort
  fallback goes club-wide for 3/7 replacements (undoing the pairing intent); tiny cohorts are
  self-referential; and the V2 top-of-ranking is now dominated by role/tenure artifacts — it has become an
  artifact detector. Batch-004 steering: raise MIN_COHORT (~8) or pool replacements cross-club, and apply
  the never_cast_ballot + role-change filter to the divergence lens as well.
- **Tiering**: Sonnet-majority justified — no hallucinated ids, no fabricated numbers or time series. The
  cheapest next quality gain is deterministic (a prose-vs-props number cross-check), not more Opus.

## No silent truncation

- Army selection exhausted the coded lens thresholds over the 157-MP pool; the oversight-workhorse lens
  correctly produced 0 picks this batch because its population (5 MPs) was already fully covered across
  batches 001–002 — not a bug, logged explicitly.
- The shared-IČO anomaly across 4 dossiers is logged and routed to Opus verification, not silently resolved
  either way.
- A code bug was caught and fixed DURING this batch's own development (not after the fact): the first draft
  of the tenure-normalized "bottom" lens took the highest-scoring 4 of a widened bottom-8 window instead of
  the true bottom 4 — caught before any dossier work was based on it, by comparing the regenerated army
  list against the original run. See handoff.md §Lessons.
