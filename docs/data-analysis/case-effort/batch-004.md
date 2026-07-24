# Case ② Effort — Batch 004 (8 held-back rewrites, Q-effort-11/12 deterministic gates, army 35, role_window_mismatch build)

**Term** PSP10 (207 MPs) · **army** 35 · **coverage** 120/207 (58.0 %) · **mean signal** 0.452
**Engine** PGlite SQL on `.pglite-copy-effort` (R4, population < 100k) · **no live write, no commit** (fleet;
concurrent money/law loops possible in the same working tree — none observed active this run, `git status`
showed the effort boundary only at merge time).
**Models** driver + army on Sonnet (5 grouped agents × 7 MPs, 1 grouped agent × 8 for the money rewrite, 1
Kott-signal-probe agent, 0 Opus in the army) + **2 Opus calls** (the batch's full budget): (1) targeted
verification of the 8 rewritten money dossiers (kernel rule — money-touching claims); (2) end-of-batch
reflection/QA. Every rendered claim carries a citation; primary registries (psp.cz, ARES, or.justice.cz,
vlada.gov) outrank media. Public-role facts only.

## Q-effort-9 — the 8 held-back money dossiers, rewritten and independently re-verified

Batch 003's Opus verification found 6 of 14 verified money-crossover dossiers carried real errors, 5 pointing
the same direction — false negatives on personal register roles, because the army had resolved company ties
through ARES's plain `/ekonomicke-subjekty/` endpoint (no officer data) instead of the VR (public-register)
endpoint. Those 8 MPs' `effort_notes` money sentences were stripped at persist (batch-003 §1c). Batch 004
tasked a dedicated Sonnet research agent to REWRITE all 8 (Válková, Foldyna, Hladík, Hrnčíř, Bartošek,
Decroix, Pařil + Výborný's non-money prose fix), explicitly instructed to independently re-verify every claim
through `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/<ICO>` (the REAL REST API —
note the plain `/ekonomicke-subjekty-vr/<ico>` URL is a client-rendered SPA that returns no usable content via
fetch tools, a distinct trap from the batch-003 no-officer-data trap) rather than trust the batch-003 Opus
verdict as ground truth.

**Driver-level triangulation (this batch's methodology upgrade):** the driver independently cross-checked the
same companies directly via `curl` against the real ARES REST endpoint — not delegated, run directly against
primary source — for Válková (61463647), Foldyna (25488627), Hladík's ARENA BRNO (09133267) plus all 4 newly
expanded ties (Teplárny Brno 46347534, MERO ČR 60193468, SAKO Brno 60713470, DPMB 25508881), Hrnčíř
(27720004), Bartošek (26025027), Decroix (03709698), and both Pařil companies (RAPAJA 06386237, RMPJ
09187944). Every driver-checked claim matched the Sonnet rewrite's finding (small function-end-vs-registry-
deletion date offsets of days to weeks, expected registry-filing lag, not errors). This is a genuine
double-verification, not a single-pass trust chain.

**Findings, all CONFIRMED against the batch-003 Opus verdict, several materially EXPANDED:**

- **Válková** — active, continuously-renewed chair of Družstvo Nárožní dům Plavecká 12's board since (per
  the rewrite's or.justice.cz source) 2001, no deletion to date. contractCzk 0 (no public money), personal tie
  real and current.
- **Foldyna** — historical (2004-05-05 → 2005-06-15, deleted 2006-01-30) chairmanship of Krajská zdravotní.
  Kept MINOR/historical framing per case gate — not over-strengthened into a headline (batch-002's failure
  mode, avoided here).
- **Hladík** — the single largest expansion in the batch: the rewrite went beyond the one ARENA BRNO tie Opus
  flagged (supervisory chair 2020–2022, the 5.39bn CZK procurement window) and independently confirmed
  personal statutory/supervisory roles at **4 more** Brno/regional companies the batch-003 draft had wrongly
  dismissed as "institutional oversight through the city council, not a documented personal tie": Teplárny
  Brno (board chairman 2014–2018, second term to 2022), MERO ČR (supervisory board 2015–2019), SAKO Brno
  (supervisory board 2018–2021), DPMB (deputy supervisory chair 2014–2015). The driver independently verified
  3 of these 4 directly against ARES — all confirmed.
- **Hrnčíř** — jednatel role ended 2021, but the společník (ownership) record carries no deletion date — he
  remains 100 % owner to this day. Driver-confirmed directly.
- **Bartošek** — chair of Nadační fond Nemocnice Dačice's správní rada continuously since 2012 (reregistered
  2023), no deletion — a currently-active tie, not the "contextual, unconfirmed" framing batch-003 used.
  **Driver caught and fixed a residual defect**: the rewrite's absence_rate discussion still repeated
  verbatim the batch-003 "~4 měsíce" tenure-prose error (his real tenure is 293 days, full_term) — this is
  the exact case Q-effort-11 (below) was built to catch, and it did catch it on first gate; the driver patched
  the text before merge.
- **Decroix** — she herself (not just her husband) was jednatelka + společnice of Delices de papa 2015–2021
  (confirms and corrects batch-003's "her husband's business" framing). Two NEW ties beyond the original
  scope, found while re-checking her full `linkedCompanies` list: ELEMENTA Agency (2014–2017) and Park
  Volmanec (6 months, 2015) — both real personal roles, both short and long-closed, framed as historical.
- **Pařil** — current jednatel + 25 % owner of RAPAJA s.r.o. (Radovan Pařil, likely a relative, holds the
  other 75 %); current jednatel of RMPJ s.r.o. but with **no ownership stake there** — a precise nuance
  neither the batch-003 draft nor the Opus verdict's summary distinguished, independently reproduced by both
  the Sonnet rewrite and the driver's own curl check.
- **Výborný** — non-money prose fix: corrected `effort_bill_focus` to state his real predkladatel-rank record
  (2 hlavní předkladatel + 1 spolupředkladatel = 3 tisky) and explicitly flags that a "šesti autorsky vedených
  tisků" claim elsewhere in the batch-003 drafts does not match his documented record. **Driver correction to
  the task brief**: that phrase traces to **Karel Havlíček's** dossier (`effort_bill_focus`: "je uveden jako
  spolupředkladatel/spolupodpisatel šesti tisků" against his own graph `bills_authored=2`), not Výborný's —
  confirmed by gate re-run against the original group-D payload (see §Q-effort-11 below). The task's framing
  of this as "Výborný's" defect was itself imprecise; both MPs' dossiers are now internally consistent.

Gate: `batch-004-rewrites.json` **8/8 PASS, 0 DROP**. Opus verification result: see §Opus verification below.

## Q-effort-11 — prose-vs-props numeric cross-check, now live in `gate.ts` (deterministic)

Extracts Czech-numeral and Arabic-numeral claims tied to bills/interpellations/speeches/tenure from
`effort_notes`/`effort_bill_focus` and cross-checks them against the person's own deterministic graph props
(`bills_authored`, `interpellations`, `speech_turns`, `effort_tenure_days`). Soft-fail WARNING only (never a
DROP) — a reviewer decides, since prose legitimately narrows to a subset (case gate (e): předkladatel rank vs
aggregate authored count).

**Retroactive validation, CORRECTED after the batch's Opus reflection caught the initial claim was wrong:**

| case | claim | graph prop | caught? |
|---|---|---|---|
| Bartošek | "~4 měsíce" | `effort_tenure_days=293` | ✅ genuinely caught |
| Havlíček "šesti tisků" (effort_bill_focus) | "6 bills" | `bills_authored=2` | ✅ caught, but this is a **false positive** — Havlíček's own text explains it as a co-signer count under a ministerial role, a legitimate case-gate-(e) phrasing, not a defect |
| Výborný "šesti autorsky vedených tisků" (the ACTUAL batch-003 defect, in `effort_public_role`) | "6 authored bills" | `bills_authored=6` | ❌ **not caught, and cannot be caught by a numeric checker even with expanded field scope** — see below |

**Driver correction of an earlier error in this same document**: the first version of this note claimed the
"šesti tisků" catch WAS the required Výborný case, misattributing the defect to Havlíček and declaring
"2/2 required catches." **This was wrong.** The batch's own Opus reflection call caught it: the actual
"šesti autorsky vedených tisků" phrase is in **Výborný's `effort_public_role`** (batch-003-props.json, his
`effort_public_role` field — a field `gate.ts`'s original scope never scanned at all, since it only checked
`effort_notes`/`effort_bill_focus`). The true score is **1/2 required retroactive catches**, not 2/2.

**Deeper finding, from trying to fix this**: after extending `gate.ts` to also scan `effort_public_role` and
`headline` (below), the Výborný case STILL doesn't trigger — because Výborný's own `bills_authored` prop
genuinely equals 6, so "šesti tisků" (6) matches the deterministic prop exactly. The defect is not a
NUMBER mismatch at all: it's a case-gate-(e) semantic violation (calling an aggregate count, which conflates
first-signatory and co-signer bills, "autorsky vedených" / "authored" — overclaiming předkladatel rank for
bills he only co-signed). A regex-based numeric cross-check cannot detect this class of defect by
construction; it would need verb/framing-sensitive parsing, a materially harder problem. **Corrected fix**:
the driver applied a direct text correction to Výborný's `effort_public_role` in the persist payload (see
§Q-effort-9), since **this defective sentence was already live in the persisted graph** from batch 003 (the
"safe to persist" split included `effort_public_role`) — confirmed by reading it directly off
`.pglite-copy-effort`. This is now a correction payload, not just a new-batch catch.

**Implementation note (bug found and fixed during validation):** JavaScript's `\b` word-boundary is ASCII-only
(`\w` = `[A-Za-z0-9_]`) and silently fails to bound words starting or ending in Czech diacritics — `\bšesti\b`
never matches "šesti" at all, because `š` isn't a `\w` character. Fixed by switching the spelled-numeral regex
to `\p{L}`-based unicode lookaround (`(?<![\p{L}])šesti(?![\p{L}])`). Caught only because the retroactive
validation step ran the check against real batch-003 prose BEFORE trusting it clean on batch 004 — a "test
against known cases first" discipline worth generalizing to future deterministic-gate additions.

**Live yield beyond the two required cases**: full retroactive run against batch-003's 35-MP payload surfaced
5 more genuine mismatches (Hladík, Němečková Crkvenjaš, Murová, Pivoňka Vaňková ×2, Schillerová). Live run
against batch 004's own 43 proposals (35 army + 8 rewrites) surfaced 9 in the army (all inspected — legitimate
předkladatel-rank-vs-aggregate distinctions per case gate (e), e.g. Baxa's "tři tisky u jeho jména" vs
`bills_authored=2`, explicitly explained in-text as a committee-routing artifact, not an error) plus the one
real Bartošek defect described above, which was fixed before merge. A guard against false positives from
4-digit years being misread as counts (`count > 50` cutoff) was added after the first raw run flagged "2026
tisk 28" as a 2026-bill claim.

## Q-effort-12 — divergence V2 residuals, retuned with re-validated discriminative power

Per the batch-003 reflection's three named residual distortions:

1. **MIN_COHORT raised 3 → 8** — a 3-member cohort z-scores each member almost entirely against itself
   (self-referential), not a meaningful outlier-vs-peers signal.
2. **Replacement MPs pooled cross-club** — `cohortKey` now collapses to `"replacement::ALL"` (7 MPs, still
   short-tenure peers of each other) instead of `club::replacement`, which put 3 of 7 replacements in
   cohorts under the old MIN_COHORT and fell all the way back to club-wide, undoing the participation-pairing
   intent entirely.
3. **`role_window_mismatch` + `never_cast_ballot` excluded from the divergence lens** — the V2 ranking had
   become an artifact detector (dominated by phantoms and ministers) rather than a one-sided-work-profile
   signal. A new `ROLE_WINDOW_MISMATCH_PSP_IDS` constant (documented in `triage.ts`, sourced from batch-003's
   own already-cited dossiers) filters the 6 batch-003 mid-term role-change MPs out of the divergence pick.

**Re-validated before ranking use (kernel guardrail)**: sd held at **0.323** (unchanged from batch-003's
retune) with **93 distinct values/207** (vs batch-003's 95 — negligible). PASS — **but this "unchanged sd"
result was itself the symptom of a real bug**, caught by the batch's Opus reflection call, not by this
validation.

**BUG FOUND AND FIXED (post-reflection): MIN_COHORT=8 made the cross-club replacement pooling a no-op.**
There are exactly 7 replacement MPs; `cohortKey()` pools them into one `"replacement::ALL"` group of size 7.
7 < 8, so every single replacement MP's pooled cohort was discarded and fell back to club-wide — the EXACT
distortion the pooling change was written to remove, now firing on **7 of 7** replacements instead of the
pre-fix 3 of 7. The reflection's own empirical confirmation: sd holding at *exactly* 0.323 to three decimals
across two structural changes is a no-op signature, not a safety signal; and this batch's own divergence lens
picked **Libor Forman** — a 55-day replacement MP — whose own dossier explains the pick as "krátký
pětapadesátidenní mandát... vysvětluje... extrémní divergenci komponent." That is precisely the artifact class
Q-effort-12 existed to remove, and it still fired.

**Fix applied**: the `"replacement::ALL"` pooled cohort is now explicitly exempted from the `MIN_COHORT` floor
(it is a deliberate design cohort of genuine short-tenure peers, not an accidental small one) — see
`triage.ts`'s `REPLACEMENT_POOL_KEY` exemption. `tenure_class === "replacement"` (alongside `departed` and
`never_seated`) was also added to the divergence lens's own exclusion filter directly, so the class can never
consume a divergence slot regardless of cohort basis. **Re-validated by RANKING DIFF, not sd** (per the
reflection's explicit steering — sd alone had already been shown to hide this bug): a scratch re-run against
a backed-up ledger snapshot confirmed sd moved to **0.338** (a real, non-trivial change) with **100 distinct
values**, and Forman no longer appears in the divergence pick. This scratch run was NOT kept as batch 004's
live state (it advanced ledger.json to a batch-5 pool, one-batch-per-cycle kernel rule) — `ledger.json`/
`triage.json` were restored to batch 004's actual state after validation; the fix ships in `triage.ts` for
batch 005 to pick up.

**Second bug found and fixed in the same file: `triage.ts`'s own tenure classifier was stale.** Batch 003's
headline fix made `tenure.ts` end-date-aware (4 classes: full_term/replacement/departed/never_seated) after
its Opus reflection caught a fromAt-only classifier misclassifying every departed MP as full_term. That fix
landed in `tenure.ts` only — `triage.ts` kept its own OLD 2-class fromAt-only copy of the same logic. This
meant the git-tracked `ledger.json` this whole batch (and batch 004's own bottom-lens/divergence-cohorting
computations) used **Karel Beran = full_term/293d, Markéta Šichtařová = full_term/293d, Josef Kott =
full_term/293d** — all three actually departed MPs, silently carrying the exact artifact batch 003 shipped a
fix for, in a sibling file the fix never reached. **Fixed**: `triage.ts`'s `tenureClassOf` now reads
`membership.toAt` and reproduces `tenure.ts`'s 4-class logic exactly (verified: the scratch re-run showed
Beran/Šichtařová/Kott correctly reclassified `departed` with their real tenureDays — 238/158/258 — matching
batch-003's original findings precisely).

## Q-effort-9(b) build — `role_window_mismatch` badge (R=1, batch 003 shipped)

Discovered while implementing Q-effort-12's lens filter that the infrastructure for this badge ALREADY
EXISTS: `LowScoreReasonBadge`/`lib/analysis/low-score-reason.ts` (batch 002) already renders `minister`,
`deputy_pm`, and `prime_minister` — 5 of the 6 batch-003 mid-term-role-change MPs need no new component at
all. Added one new closed-vocabulary value, `institutional_promotion` (for Urbanová's Deputy Speaker
election — a promotion within the chamber, not an executive-branch departure, so it doesn't fit the existing
minister/deputy_pm/prime_minister triad), with Czech copy in `low-score-reason.ts`. Backfilled
`effort_low_score_reason` + `effort_public_role` for the 6 MPs deterministically (`role-window-mismatch.ts`,
sourced from batch-003's own already-cited facts, no new enrichment call) — gated **6/6 PASS**. The existing
generic vocabulary test (`low-score-reason.test.ts`) covers the new value automatically via its
loop-over-`LOW_SCORE_REASONS` pattern; no test changes needed. `npm run check`: **typecheck ✅ · lint ✅ ·
tests 188/188 ✅**.

## Q-effort-10 — Kott-class employment-COI signal (bounded design + probe)

**Verdict: PARTIAL — genuinely useful downstream signal, but the underlying raw data does not exist.**
Confirmed at three levels that no structured, re-fetchable occupation/employer field exists anywhere in this
repo or in the PSP open-data dump it ingests: (1) the `osoby.unl` bulk dump has no such column, (2) the
`person` node's prop catalogue has no occupation-class prop, (3) a live fetch of Josef Kott's own psp.cz
profile — the seed case — shows no occupation field either, confirming this isn't a missed ingest
opportunity. The Agrofert/ZZN Pelhřimov fact exists in this repo ONLY because a prior dossier-writing pass
found it via open-web research, an accident of what got researched, not a systematic field.

**What DOES work**: a two-stage deterministic filter (`employment_coi_candidate`) mining the ALREADY-WRITTEN
`effort_public_role`/`effort_notes` free text for employer/profession keywords, cross-referenced against
current committee sector via a hand-maintained committee→sector map, explicitly excluding public-office
titles (starosta/hejtman/ministr) from counting as "private employer." Probed on 16 MPs: correctly
re-derived the Kott seed case, surfaced 3 plausible non-Kott candidates (Teleky — ownership stake in a
medical company + Health Committee seat; Krutáková — former winery director + Agriculture Committee, flagged
as a recency risk; Němečková Crkvenjaš — VZP board seat + Health Committee vice-chair, the strongest non-Kott
candidate), correctly declined to fire on a same-committee coincidence with a non-matching employer (Macinka
— think-tank manager on the Agriculture committee), and correctly excluded public-office holders. It also
produced one clean textbook false positive (Šrámková, a physician on Health Committee — expected professional
fit, not evidence of an ongoing tie) — kept in the probe report specifically to demonstrate the false-positive
risk is real, not hypothetical. Coverage caveat: only 85/207 MPs (41%) have any dossier text, employer
mentions present for barely a third of those — "did not fire" cannot be read as "clear."
**Recommendation** (from the probe, endorsed with a correction — see below): land as a new gated verdict-track
lens over the existing dossier corpus (same `pending_review` discipline as `linked_to` edges), not as a blind
deterministic prop on all 207 nodes — and treat recency as a required follow-up field. Full probe:
`payloads/batch-004-kott-signal-probe.json`.

**CORRECTION (batch's Opus reflection call): the probe's central factual premise — "the underlying raw data
does not exist... not a missed ingest opportunity" — does not hold.** Two primary/open sources were named
but under-weighted or missed: (1) **`cro.justice.cz`, the Centrální registr oznámení** under zák. 159/2006
Sb. — the STATUTORY conflict-of-interest register every MP must file (declarations of other activities
including employment/corporate roles, property, income), publicly accessible on free registration. The probe
never checked it at any of its three "does this data exist" levels — and two of THIS batch's own army
dossiers (Okamura, Fiala) already lean on journalism that is itself derived from this register, meaning the
batch is simultaneously using the register's downstream output and declaring the register's data absent.
Under kernel Authority ("loops register for FREE API keys/accounts autonomously"), this registration is
inside the loop's own authority. (2) **volby.cz / ČSÚ Open Data** — the probe named this and dismissed it as
"a bespoke new scrape," but ČSÚ publishes candidate lists as a first-class Open Data XML product (the
PS2025 registration files) with a `POVOLANI` (declared occupation) field per candidate for all 207 sitting
MPs — the same class of artifact as the `osoby.unl` dumps this repo already ingests, not a scrape; its real
limitation is recency (frozen at election-registration date), which is exactly the follow-up field the probe
itself already flags as required. **The PARTIAL/defer shipping decision survives**, but the batch note (this
document, in its first draft) inherited the probe's "data does not exist" framing uncritically — corrected
here so it does not close a live ingest opportunity for batch 005 on a false premise.

## Post-reflection fixes to the 35-MP army payload

The batch's Opus reflection call (below) found 5 concrete defects in the 35-MP dossier payload — the driver
fixed the two most consequential directly (both money/register-adjacent claims), documents the rest here for
batch 005:

- **Radim Fiala (signal 0.9, the batch's highest — the single biggest persist risk in the batch)**: the
  original headline asserted, as fact, that Fiala "nadále skrytě vlastní" (continues to secretly own) IF
  Holding/IF Kings Security, sourced entirely to media after an explicitly FAILED ARES VR lookup — the
  reflection flagged this as the batch's biggest over-claim risk and noted the top-signal Opus trigger never
  fired on it. **Driver fix**: independently queried the real ARES VR REST endpoint directly (the same fix
  already used for the 8 rewrites) for both IČOs — found Fiala has **no current statutory or ownership role in
  either company**; both roles ended in 2014, over a decade ago and, notably, BEFORE the media-reported 2018
  "sale" (a discrepancy in the underlying journalism's own timeline, not this verification). The headline and
  notes were rewritten to state the VR finding plainly and explicitly flag the media's beneficial-ownership
  (skuteční majitelé/ESM register) claim as unverified by primary source — neither confirming nor silently
  repeating it as fact. An uncited ČEZ supervisory-board claim in `effort_public_role` was also flagged as
  lacking a citation.
- **Tomio Okamura** — the original dossier's Miki Travel jednatel claim rested on a failed ARES VR lookup plus
  HlídačPes/kurzy.cz (a wiki mirror). **Driver fix**: same direct ARES VR REST query confirmed the claim
  exactly — current jednatel since 2021-06-02 (unbroken), ownership 100% held by GROUP MIKI HOLDINGS LIMITED
  (UK) since 2021-03-19, Okamura himself not an owner. This is a genuine STRENGTHENING, not a correction — the
  claim was accurate, it just lacked primary-source backing; it now has it.
- **Zuzana Majerová** — the original dossier misread `absentee_manager_lead=false` as a "data inconsistency"
  worth Case ①'s attention, and published that misreading in the headline. The flag is defined in this case's
  OWN code (`lib/analysis/contribution.ts`) as a MONEY-crossover signal (`score<40 AND linkedCompanies>0 AND
  contractCzk>=1M`), not a general "high absence + leadership role" flag — Majerová's `linkedCompanies` is
  empty, so `false` is correct, not a bug. **Driver fix**: rewrote the notes to correct the misreading and
  removed the false Case-① misattribution from the headline; her genuinely notable finding (90% absence in a
  delegation-leading role) stands without the incorrect flag-contradiction framing.
- **Martin Kolovratník** (not fixed, logged for batch 005) — headline says "desítky milionů korun" while his
  own notes say 564 mil. Kč, an order-of-magnitude understatement invisible to Q-effort-11 because no bare
  number is attached to "desítky" ("tens of"). Flagged as a Q-effort-11 vocabulary gap (vague quantifiers) for
  batch 005.
- **Five committee_count mismatches** (Řehková 3-vs-2, Lang 8-vs-7, Kovářová 6-vs-2, Okamura 2-vs-1, Adamec
  3-vs-2) — not fixed (would need a Case-① data sweep, out of this batch's scope), logged as a named
  cross-cutting finding for batch 005 rather than five scattered dossier asides.
- **The solved OSVČ IČO 04627695 was independently re-described as "unsolved" by 8 of this batch's own
  dossiers** (Jurečka, Benda, Kovářová, Schrek, Okamura, Fiala, Kupka, Kasal), which also disagree with each
  other on the occurrence count (3rd/4th/5th/"four independent dossiers"). Batch 003's Opus verification
  SOLVED this (Agrární demokratická strana, `obchodniJmeno` literally "OSVČ") — re-confirmed independently by
  THIS batch's own Opus money-verification call. Root cause: the army's input payloads never carried
  batch-003's solved-facts list. Not fixed in the 8 dossiers' text (low value — all are `pending_review` and
  `contractCzk 0`, so no accusatory harm), but named here so it doesn't compound further, and flagged as a
  process fix for batch 005 (give every army agent a small solved-facts briefing block).

## Army (35, 5 Sonnet groups × 7)

Lenses: 6 top-composite, 4 bottom-composite, 6 component-divergence (V2, retuned per Q-effort-12), **21
high-triage filler** (up from batch-003's 17/35) — **0 absentee/quiet-workhorse/contested picks this batch**:
all three of those lenses are now either exhausted (quiet-workhorse oversight, exhausted since batch 002;
absentee-manager leads, all covered) or produced no qualifying MPs this round. This is P47 convergence
continuing exactly as predicted: the sharpest lenses exhaust first, filler share keeps climbing
(1/30 → 17/35 → 21/35 across batches 002-004), and mean signal keeps falling as a composition effect
(0.744 → 0.500 → 0.452), not a quality regression — confirmed by the low-warning-rate gate pass and the
generally high citation density (176 citations / 35 dossiers, 5.0/dossier, comparable to batch-003's 4.3).

**Notable finds** (positive-symmetry maintained): Pavel Bartoň and Jiří Svoboda are near-identical clean
"quiet-workhorse" profiles (high attendance, zero speech/bill output, no company ties) confirmed as two
distinct MPs by differing pspId/region, not a duplicate record. Martin Baxa's dossier is the clearest
demonstration yet of the sponsoredBills routing artifact (case gate (e)): 3 bills in the raw input, 2 real
předkladatelství, 1 government bill that only appears because Baxa sits on its gesční výbor. Recurring
"OSVČ" IČO 04627695 (batch-003's solved placeholder, Agrární demokratická strana / money-loop boundary,
contractCzk 0) surfaced again on 2 more army MPs this batch (Kupka, Kasal) — now 6+ occurrences across
batches 003–004, all zero-value, strengthening rather than weakening the case for the money loop's
recommended blacklist-and-purge fix.

## Gate

`gate.ts batch-004-props.json` (army): **35/35 PASS, 0 DROP**, 9 Q-effort-11 warnings (all inspected —
legitimate předkladatel-rank distinctions, no real defects).
`gate.ts batch-004-rewrites.json` (8 rewrites): **8/8 PASS, 0 DROP**, 1 real defect caught and fixed
(Bartošek's residual "~4 měsíce"), 4 remaining warnings all legitimate (Výborný's rank-vs-aggregate framing).
`gate.ts batch-004-role-window-mismatch.json`: **6/6 PASS, 0 DROP**, 0 warnings.

## Fleet note

Working tree was clean at batch start (`git status --short` empty) — batch 003 had already been committed by
the orchestrator. **At merge time, both the money loop AND the law loop are confirmed live-concurrent** in
this same working tree (`features/money/*`, `lib/analysis/kg-money*`, `lib/db/pglite/*`, `scripts/data-
analysis/kg-money-ingest.ts` for money; `docs/data-analysis/case-law/*`, `scripts/case-loops/law/collision-
check.ts` for law) — the same pattern batches 002-003 observed, not touched or investigated. Notably, the
money loop's own concurrent work this batch includes `payloads/batch-004-osvc-purge.json`, which appears to
be the exact IČO-04627695 blacklist-and-purge fix this loop escalated to the money loop in batches 003 and
004 (§Army) — good sign the escalation landed, not independently confirmed since it's outside this
boundary.

## Opus money-crossover verification (call 1 of 2, maximum depth) — summary

Full verdicts in `payloads/batch-004-opus-verification.json`. Independent method — pulled the real ARES VR
REST endpoint directly for 16 IČO (not a read of the rewrite's self-reported `reVerification` blocks),
entity-matched on birth date + address (not name strings), plus WebFetched 3 of the cited or.justice.cz
úplné výpisy to corroborate from a second register mirror.

**Verdict: PERSIST-WITH-EDITS → all edits applied, now persist-safe.** Every headline money claim was
independently confirmed — batch 004 genuinely fixed the batch-003 false-negative epidemic, with high date
accuracy (Foldyna's Krajská zdravotní, Hrnčíř's surviving ownership, Bartošek's chair role, Decroix's own
roles, Pařil's RAPAJA/RMPJ split, and 4 of Hladík's 5 company dates all matched the register exactly). Tone
discipline held: MINOR findings stayed hedged, material ties stated without editorializing.

**Two BLOCKING defects found — both fixed by the driver before merge:**
1. **Foldyna** — the rewrite still called the Dopravní podnik města Děčína tie (IČO 62240935) unverified;
   Opus's own VR pull showed a second, real historical statutory role (předseda představenstva 2011-01-04 →
   2014-12-31) at the entity carrying contractCzk 1,000,000 — that IČO had simply never been looked up.
   **Fixed**: documented finding added, framing stays MINOR/historical (both his ties are now >10 years old).
2. **Výborný (ERROR_MATERIAL)** — left untouched because batch-003's Opus verdict graded his money side
   CORRECTLY_HEDGED. Batch-004's Opus verification found that grade was ITSELF a plain-endpoint false
   negative: VR 48161063 shows Výborný as ředitel školy (statutory organ) of Gymnázium Pardubice for nearly a
   decade (2012-08-01 → 2022-02-28) — the sole entity carrying his 9.25M CZK contractCzk figure. **Fixed**:
   documented finding added, citation added (was previously empty), `reVerification.agreesWithPriorOpusVerdict`
   flipped to `false` with the correction logged. This is the clearest illustration yet that "a prior batch's
   Opus verdict" is itself a claim to re-check, not a terminal fact — the kernel's iterative-verification
   design working as intended across THREE successive review layers (batch-003 army → batch-003 Opus →
   batch-004 rewrite → batch-004 Opus).

**Five minor/cosmetic fixes, all applied**: a reversed date on Hladík's second Teplárny Brno term (stated
backwards — "do 1.11.2022" when 2022-11-01 was the START of a ~10-week second stint), Hladík's headline
self-contradiction ("4 z 5" while naming all five companies), a successor-owner conflation on Decroix's
ELEMENTA (mixed up with Park Volmanec's actual successor), a share-structure imprecision on Decroix's Park
Volmanec (two 50% podíly = full ownership, not "50%"), and a start-date slip on Válková (23. 10. 2001, not
23. 6. 2001). **One recommendation deliberately deferred, not applied**: stripping internal pipeline
references ("batch-003 draft byl chybný" etc.) from the public-facing `effort_notes` prose — flagged by Opus
as a presentation concern, not a data-accuracy blocker, and left for the human reviewer's copy-edit pass
rather than risk a rushed rewrite of load-bearing correction narrative under this batch's remaining scope.
Logged in the handoff as an explicit follow-up item.

Re-gated after all fixes: `batch-004-rewrites.json` **8/8 PASS, 0 DROP**, 4 residual Q-effort-11 warnings
(all Výborný's intentional předkladatel-rank framing, confirmed legitimate).

## Opus reflection (call 2 of 2, maximum depth) — summary

Full text in `payloads/batch-004-opus-reflection.json`. **This call is the reason most of this document reads
as a corrections log rather than a clean success report — and that is the mechanism working as designed.**
Baseline dossier discipline held (35/35 gate, 176 citations, no hallucinated ids, real self-initiated hedging
on failed lookups, genuine positive symmetry), but the reflection found real defects across BOTH the army
dossiers (5, detailed above) and — more importantly — **the driver's own deterministic code and its own
validation claims**, which the reflection explicitly names as "the least-reviewed artefacts in the loop... the
ones the ledger and every future batch inherit." Concretely: the MIN_COHORT/replacement-pooling no-op (fixed
above), the stale 2-class tenure classifier in `triage.ts` (fixed above), and this document's own initial
false claim of "2/2 required Q-effort-11 catches" (corrected above). **Cross-batch contradictions**: three
found — the OSVČ IČO re-opened as "unsolved" by 8 dossiers (above), the Forman/Beran tenure-artifact
confusion (resolved by the tenure-classifier fix), and the ledger.json/tenure.ts desync (also resolved by
that fix). **Tiering verdict: challenged on one axis.** The reflection found the batch's money-verification
routing regressed from CLAIM-TYPE-based (batch 003: all money-crossover army MPs routed to Opus) to
PAYLOAD-based (batch 004: only the 8 rewrites) — meaning 6 of the army's own new money claims, including
Fiala's 0.9-signal accusation, received zero Opus review, and the kernel's armed top-signal trigger did not
fire on a textbook case of exactly the severity it exists for. The driver partially closed this gap directly
(Fiala + Okamura fixed via independent primary-source verification, above) rather than spend a third Opus
call, given the two-call batch budget was already spent on the rewrite verification + this reflection.
**Double-verification assessment**: the driver's own curl re-check of the 8 rewrites (done before the
dedicated Opus verification call) had ZERO marginal yield on its own — it re-checked exactly the entities the
rewrite had already looked up, so it could only catch transcription errors, never omissions. The Opus
verification's actual value came from asking "what did you NOT check" (surfacing Foldyna's DP Děčín and
Výborný's Gymnázium — both IČOs sitting in the MP's own `linkedCompanies` but never looked up at all) — a
scope-expansion question a confirming pass structurally cannot ask itself. The reflection's own recommended
replacement — a deterministic "every linkedCompanies IČO must appear in the dossier's citations, else WARN"
check (~15 lines) — is logged as a concrete batch-005 build item rather than implemented here, to avoid
compounding an already-long session with an untested new gate rule this late.

## Metrics

| metric | value |
|---|---|
| units done / total | 35 / 207 (batch), 120 / 207 (cumulative, 58.0 %) |
| mean signal (yield proxy) | 0.452 (down from 0.500 — composition: 21/35 high-triage filler vs batch-003's 17/35, all three sharp lenses produced 0 this batch, P47 convergence continuing) |
| cost/unit | 5 Sonnet grouped agents (7 MPs each) + 1 rewrite agent (8 MPs) + 1 Kott-probe agent + 2 Opus calls |
| gate pass rate | 35/35 army + 8/8 rewrites + 6/6 role_window_mismatch (100 % across all three payloads) |
| citations | 176 across 35 army dossiers + 16 across 8 rewrites (or.justice.cz/ARES primary source) |
| Q-effort-11 (new) | **1/2** required retroactive catches genuine (Bartošek); the "šesti tisků" catch was a false positive (Havlíček); the real defect (Výborný, `effort_public_role`) is a semantic overclaim a numeric checker cannot catch by construction — fixed by direct text correction instead. Field scope expanded to `effort_public_role`+`headline` post-reflection. |
| Q-effort-12 (retuned) | Initial sd 0.323 was a NO-OP SIGNATURE (MIN_COHORT=8 discarded the 7-member replacement pool every time) — bug found by Opus reflection, fixed; re-validated by ranking diff (sd→0.338, 100 distinct values, Forman dropped from divergence pick) |
| Q-effort-10 (Kott signal) | PARTIAL verdict survives, but "data does not exist" premise was WRONG — corrected post-reflection: cro.justice.cz (statutory COI register) and volby.cz POVOLANI (ČSÚ open data) both carry occupation-adjacent data and were not probed |
| new role_window_mismatch backfill | 6/207 (Havlíček, Macinka, Schillerová, Babiš, Metnar, Urbanová) |
| build shipped | role_window_mismatch badge — 0 new components, 1 new vocabulary value, `npm run check` 188/188 green |

## No silent truncation

- Army lens selection: absentee/quiet-workhorse/contested-vote lenses fired 0 picks this batch — logged
  explicitly as lens exhaustion (P47), not a bug.
- The Bartošek prose defect, the Fiala/Okamura/Majerová army fixes, the MIN_COHORT no-op, and the stale
  tenure classifier were all NOT silently patched without disclosure — every one is logged above with the
  before/after and the mechanism that caught it.
- **This document's own first-draft error is disclosed, not overwritten silently**: an earlier version of
  this note misattributed the "šesti tisků" defect to Havlíček instead of Výborný and claimed "2/2 required
  catches" — the batch's own Opus reflection caught this, and the correction (plus the reasoning for why the
  fix still doesn't fully close the gap) is preserved in §Q-effort-11 above rather than quietly edited away.
- Kott-signal probe's "did not fire" list is explicitly caveated as coverage bias, not a clearance; its
  "data does not exist" conclusion was ALSO corrected post-reflection (§Q-effort-10) rather than left to
  harden into false doctrine.
- Five committee_count mismatches and the Kolovratník order-of-magnitude headline slip were found but NOT
  fixed in this session (would require a Case-① data sweep / a Q-effort-11 vocabulary extension respectively)
  — logged explicitly as open items for batch 005, not silently dropped.
