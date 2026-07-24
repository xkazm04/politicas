# Case ② Effort — Batch 003 handoff (fleet)

For the orchestrator holding the single-writer resources (live `.pglite`, shared vault, git).
Everything below is validated on `.pglite-copy-effort` (disposable — recreate + re-verify with the
commands in §1; the copy used this batch has been deleted at batch end). Batches 001–002 are already
handed off/committed; this handoff is additive on top of that state. Batch 002's own handoff content
(shared-vault additions, CEVYKO IČO TODO) may still be pending orchestrator action — this file replaces
it as the CURRENT handoff, but §6 lists the batch-002 items still open.

---

## 1. Graph payloads (validated; re-verify commands included)

```
cp -r .pglite .pglite-copy-effort
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-003-tenure.json            # expect 207/207 PASS
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-003-workhorse-flavour.json # expect 15/15 PASS
PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/gate.ts batch-003-props.json             # expect 35/35 PASS
```

### 1a. Tenure annotation — ALL 207 MPs (`payloads/batch-003-tenure.json`) — SAFE TO PERSIST
Deterministic (no LLM). `effort_tenure_days` + `effort_tenure_class`
(`full_term`×193 | `replacement`×7 | `departed`×3 | `never_seated`×4) + `effort_tenure_start`
(+ `effort_tenure_end` where the seat was vacated). Source: `membership.fromAt`/`toAt` on organ 174
(the PSP10 chamber). End-date-aware after the Opus reflection caught the fromAt-only version
misclassifying all 7 vacated seats as full_term. **Copy semantics**: `fromAt` is the date the mandate
AROSE (mandát vznikl), NOT the oath date — any UI rendering must say "mandát vznikl".
No contribution_* number touched. Provenance tag on persist:
`{track:"effort", pass:<assigned>, method:"deterministic", ref:"effort-batch-003-tenure", computedAt}`.

### 1b. Workhorse flavour — 15 MPs (`payloads/batch-003-workhorse-flavour.json`) — SAFE TO PERSIST
Deterministic backfill of `effort_workhorse` + `effort_workhorse_flavour` (legislative×11, oversight×4)
for every currently-flagged, still-serving quiet workhorse. Karel Beran (oversight) deliberately DROPPED —
departed 2026-05-29; the badge asserts a current role. **Reviewer note**: Filip Turek stays in (his
"government climate commissioner" role is an enrichment claim, not a deterministic departure from the
chamber) — reviewer may choose to drop him too on the same current-role logic.

### 1c. Army dossiers — 35 MPs (`payloads/batch-003-props.json`) — PERSIST ONLY WITH THE SPLIT BELOW
Merged from 7 group payloads (`batch-003-group-{A..G}.json`), gated 35/35. **The Opus money-crossover
verification (full verdicts embedded in the payload under `opusMoneyVerification`) rules: DO NOT persist
the money/company sentences as-is.** 6 of 14 verified units carry real errors, 5 the same direction —
false negatives on personal register roles, caused by the army resolving ties through ARES's plain
`/ekonomicke-subjekty/` endpoint (never contains officers) instead of `/ekonomicke-subjekty-vr/{ico}`.
Specifically wrong: Válková (active družstvo statutory role since 1994 called a "placeholder"),
Hladík (WAS on ARENA BRNO supervisory board 2020–2023, through the 5.39bn procurement window),
Bartošek (currently serving in Nadační fond Nemocnice Dačice statutory organ since 2013),
Hrnčíř (still OWNS his firm — only the jednatel role ended), Pařil (current jednatel+společník of both
"unconfirmable" companies), Decroix (framing: she herself was jednatelka 2015–2021), Foldyna (minor,
historical KZ role 2004–2006).
**Recommended persist split**: `effort_work_themes` / `effort_bill_focus` / `effort_public_role` are sound
throughout — persist; strip or reviewer-rewrite `effort_notes` money sentences and the four affected
headlines first. Also fix before persist (non-money, from the reflection): Výborný's
"šesti autorsky vedených tisků" (his own dossier documents 2+1 — case gate (e)), Bartošek's tenure prose
("~4 měsíce" vs his actual 293 tenureDays).

### 1d. IČO 04627695 — SOLVED, money-loop action required (their boundary, not touched here)
The "OSVČ" IČO flagged independently by 6 of 7 groups across 10 of the 13 money-linked army MPs is the
**Agrární demokratická strana** — a real registered micro political party whose ARES `obchodniJmeno` field
is literally the string "OSVČ". The money ingest's exact-name ARES pick matches every MP who declares
self-employment ("OSVČ") to this party → a repo-wide false-edge class (contractCzk 0, so no money-total
damage, but it is a false accusatory edge). **Money-loop fix**: blacklist generic tokens
("OSVČ", "advokát", …) before the exact-name pick in the money ingest; purge existing 04627695
`linked_to` edges. Until then this is a hard blocker on any money-crossover product surface.

### 1e. Kott conflict-of-interest lead — CONFIRMED, needs a home
Josef Kott: Agrofert-group (ZZN Pelhřimov) employee while Control Committee vice-chair, then elected to
NKÚ May 2026 (verified beyond Wikipedia: iROZHLAS + NKÚ). His `linkedCompanies` is EMPTY — the mechanical
money-crossover filter (linkedCompanies>0 / contractCzk threshold) structurally cannot catch
employment-based COI. Kernel implication: Opus routing must stay claim-type-based, not flag-based.

---

## 2. Shared-vault additions (exact text to append — not edited from this boundary)

### → `frontier.md` (Case ② section)
```
- [effort] ARES endpoint doctrine: never assert ABSENCE of a company tie without a
  /ekonomicke-subjekty-vr/{ico} (public-register) lookup — the plain /ekonomicke-subjekty/ endpoint never
  contains officers. Batch 003's Opus verification found 5 false-negative errors from exactly this gap
  (Válková, Hladík, Bartošek, Hrnčíř, Pařil). Proposed as a kernel-level web-research rule, not just an
  effort-loop one. (opened 2026-07-24, batch 003)
- [effort→money] IČO 04627695 ("OSVČ" = Agrární demokratická strana): the money ingest's exact-name ARES
  pick falsely links every self-employed MP to this micro party — 10/35 army MPs affected in batch 003,
  repo-wide by construction. Money loop to blacklist generic name tokens + purge these edges. HARD BLOCKER
  on money-crossover surfaces until fixed. (opened 2026-07-24, batch 003)
- [effort] employment-based conflict-of-interest is invisible to the linkedCompanies/contractCzk
  crossover filter (Kott/Agrofert/Control Committee, confirmed batch 003) — is there a deterministic
  employment signal (e.g. udalosti "Soukromá pracovní" without an IČO match) worth adding to triage?
  (opened 2026-07-24, batch 003)
- [effort] componentDivergence V2 residual distortions (batch-003 reflection): <3-cohort fallback goes
  club-wide for 3/7 replacements (undoing the participation-pairing intent); tiny cohorts are
  self-referential; V2 top-of-ranking is artifact-dominated (phantoms + ministers). Batch 004: raise
  MIN_COHORT (~8) or pool replacements cross-club; filter never_cast_ballot + role-change out of the
  divergence lens. (opened 2026-07-24, batch 003)
- [effort] `role_window_mismatch` meta-class proposal (batch-003 reflection): unify the three young-term
  floor artifacts — never seated / seated late (replacement) / role changed mid-term (minister, PM,
  Deputy Speaker…) — as sub-cases of one documented class instead of three ad-hoc patterns.
```

### → `patterns.md`
```
- [effort, 2026-07-24, batch 003] MID-TERM ROLE CHANGE is the third young-term floor-artifact sub-case
  (after never-seated and replacement): 6 army MPs (Havlíček→1st Deputy PM, Macinka→Deputy PM/MZV,
  Schillerová→Finance, Babiš→PM, Metnar→Interior, Urbanová→Deputy Speaker) all took a bigger job
  Dec 2025–Jun 2026; their low plenary props are the score-window artifact, not disengagement. The
  reflection reframes all three sub-cases as one meta-class: role_window_mismatch. (Urbanová is boundary —
  a promotion raising the role, not lowering the score.)
- [effort, 2026-07-24, batch 003] SONNET'S MONEY FAILURE MODE INVERTED: batch 002 found over-claiming;
  batch 003's Opus verification found systematic UNDER-claiming — unverified negatives ("no personal link
  found") asserted via the officer-less ARES endpoint, which reads as caution but factually cleared four
  MPs of documented (some currently-active) register roles. Opus routing by claim type is vindicated, but
  the cheap fix is deterministic: the VR-endpoint doctrine + a prose-vs-props number cross-check.
- [effort, 2026-07-24, batch 003] LENS EXHAUSTION IS OBSERVABLE: oversight-flavour quiet workhorses hit
  5/5 population coverage (lens correctly returned 0 picks); high-triage filler grew 1/30 → 17/35. Mean
  signal dropping 0.744 → 0.500 is composition, not decay — the loop is visibly converging on the
  high-value head, exactly as the triage design intends.
```

### → `contradictions.md`
```
(none with prior batches — Kott↔Kotlík, Šichtařová↔Nerušil, Beran↔Forman all reconcile across batches
001–003, now with deterministic tenure dates corroborating the enrichment-era claims. Within-batch
contradictions found by the Opus calls — Výborný's bill-count prose vs his own dossier, Bartošek's tenure
prose vs his tenureDays — are logged in the payload verification block and batch-003.md, not persisted.)
```

### → `graph-log.md`
```
- pass <assigned> (effort track, batch 003): effort_tenure_* on 207 person nodes (deterministic,
  end-date-aware; 193 full_term / 7 replacement / 3 departed / 4 never_seated);
  effort_workhorse_flavour on 15 (departure-guarded); effort_* enrichment props on 35 army MPs
  (money sentences held back per the Opus verification — see effort handoff §1c). componentDivergence
  retuned to (club × tenure_class)-cohort z-scores, validated sd 0.098→0.323 before ranking use.
  No new node kinds / edge rels.
```

### → `feature-opportunities.md`
```
- [effort · batch 003] SHIPPED (build, this batch): quiet-workhorse flavour surface on /zebricek —
  lib/analysis/workhorse-flavour.ts (pure, 5 tests) + WorkhorseBadge.tsx + symmetric two-flavour filter in
  LeaderboardTable.tsx, reading effort_workhorse + effort_workhorse_flavour; hidden entirely when no MP
  carries the props. Czech-first inline copy (i18n keys proposed in handoff §3).
- [effort · batch 003, open] Tenure-aware profile copy: effort_tenure_class is now on all 207 nodes —
  /poslanec could render "mandát vznikl <date>" + replacement/departed context (LowScoreReasonBadge
  precedent), and TrendPanel could suppress rate comparisons for tenure_days < ~90.
- [effort · batch 003, open] role_window_mismatch badge: the minister/PM/deputy-speaker mid-term role
  changes (6 instances this batch) deserve the same honest-correction treatment the low-score-reason badge
  gives — most values already exist in the vocabulary; "institutional promotion" (Urbanová) does not.
```

---

## 3. Proposed enum / schema changes

1. **`effort_tenure_class`** — new closed vocabulary `{full_term, replacement, departed, never_seated}`
   (deterministic, gate-checkable; recommend adding to `gate.ts` like `effort_low_score_reason`).
2. **`effort_workhorse_flavour`** — new closed vocabulary `{legislative, oversight}` (same recommendation).
3. **`effort_data_flag`** — free-text data-quality note prop, introduced when group E's `raw_flag` was
   caught mis-namespaced by the gate; recommend documenting as the canonical place for dossier-level
   data-quality observations.
4. **`effort_low_score_reason` vocabulary**: consider an `institutional_promotion` value (Urbanová
   doesn't fit `minister`/`deputy_pm`; the reflection explicitly excludes her from the artifact class).
5. **Proposed i18n keys** (messages/*.json is fleet-shared): `civicscore.workhorseFilterLabel`
   ("Tiší pracanti:"), plus the badge/detail pairs from `lib/analysis/workhorse-flavour.ts`
   (already pure-function-testable Czech copy — mechanical fold-in).
6. **Kernel doctrine addition** (docs/case-loops.md, Web-research doctrine): "Never assert absence of a
   company tie without an ARES VR (/ekonomicke-subjekty-vr) lookup." Batch-002's money rule guarded
   over-claiming; batch-003 shows under-claiming is the live failure mode.

## 4. Commit plan (per-case; suggested)

One atomic Conventional commit inside the effort boundary:

**Files (all inside boundary):**
- `docs/data-analysis/case-effort/` — ledger.md, ledger.json, batch-003.md, handoff.md, triage.json,
  dossier-inputs.json, payloads/batch-003-{props,tenure,workhorse-flavour,divergence-validation}.json,
  payloads/batch-003-group-{A..G}.json, payloads/batch-003-group-{A..G}-input.json
- `lib/analysis/workhorse-flavour.ts` + `workhorse-flavour.test.ts` (new; same boundary note as
  batch 002's low-score-reason.ts — conceptually effort-owned under lib/analysis/)
- `features/civicscore/getLeaderboardData.ts` (effortWorkhorse/effortWorkhorseFlavour on LeaderboardEntry)
- `features/civicscore/components/LeaderboardTable.tsx` (flavour filter + compact badge)
- `features/civicscore/components/WorkhorseBadge.tsx` (new)
- `scripts/case-loops/effort/` — triage.ts (tenure + divergence V2), tenure.ts (new), divergence-retune.ts
  (new), workhorse-flavour.ts (new), merge-batch.ts (new), extract-dossiers.ts (tenure/flavour fields)

**Suggested message:**
```
feat(effort): batch 003 — end-date-aware tenure annotation, divergence retune, Opus money verification

Q-effort-5: deterministic effort_tenure_* for all 207 MPs from membership.fromAt/toAt on the chamber
organ (193 full_term / 7 replacement / 3 departed / 4 never_seated) — annotation only, computeContribution
untouched. Q-effort-6: componentDivergence retuned to (club × tenure_class)-cohort z-scores; validated
sd 0.098→0.323 (3.3×) before any ranking use. 35-MP Sonnet army (7×5 groups, 152 citations, gate 35/35)
plus the batch's 2 Opus calls: a money-crossover verification that found a systematic ARES-endpoint
false-negative gap (money sentences held back from persist; shared "OSVČ" IČO solved as an ingest-level
false-edge class, escalated to the money loop) and a reflection that caught two shipped-in-batch fixes
(tenure end dates, workhorse departure guard). Ships the quiet-workhorse flavour surface on /zebricek
(O-effort-3): symmetric legislative/oversight badge + filter, graceful when props absent. npm run check
green (176/176 tests, +10).
```
**Do NOT commit** `.pglite-copy-effort` (already deleted). The working tree also carries unrelated
money-loop changes (`features/money/*`, `lib/db/*`, `app/penize/kontrola/`, `.env.example`) — live
fleet concurrency, do not fold into this commit.

## 5. Lessons learned (tiering + process)

- **Opus-by-claim-type is now double-confirmed but re-specified.** Batch 002: money claims fail by
  over-claiming. Batch 003: money claims fail by UNDER-claiming (unverified negatives from the wrong ARES
  endpoint). Both Opus calls this batch found real, actionable defects Sonnet had accepted — the
  money-verification call alone flipped 5 "no tie found" statements into documented register roles, and
  the reflection caught 2 shipped-code bugs (tenure end dates, badge departure guard) plus 2 non-money
  prose/props contradictions. Verdict: keep the 2-call Opus budget exactly as scoped; both calls paid.
- **The cheapest quality upgrades are deterministic, not model-tier**: (a) the VR-endpoint doctrine (one
  URL template change), (b) a prose-vs-props number cross-check before gating (would have caught Výborný
  and Bartošek in code), (c) the departure guard pattern — "badges assert current roles" generalizes.
- **Driver-level bug caught by regeneration-diffing**: the first tenure-normalized bottom lens draft took
  the highest 4 of a bottom-8 window (slice-then-filter error). Caught by re-running triage and diffing
  the army list against the pre-change output before any dossier work depended on it. Regenerate-and-diff
  is cheap insurance for any lens change.
- **Sonnet army mechanics held**: 7 groups × 5 MPs, ≤6 concurrent launches, zero agents opening the DB
  copy (pre-extraction), one gate round-trip (mis-namespaced prop) fixed at source. 152 citations/35
  dossiers, zero hallucinated ids, zero fabricated time series.
- **Independent cross-flagging works**: 6 of 7 isolated groups independently flagged the same anomalous
  IČO — the merge step is where cross-unit signal becomes visible; keep the merge-then-verify order.

## 6. Batch-002 handoff items still open (carried forward)

- Niemiec CEVYKO IČO discrepancy (08599254 vs 72160340) — still needs ARES reconciliation pre-persist.
- Batch-002 shared-vault additions + i18n keys for LowScoreReasonBadge — if not yet folded in by the
  orchestrator, both batches' additions can be applied together.
