# Case ③ Law loop — batch-002 (re-weighted triage + collision systematization)

**Run:** 2026-07-24 · fleet mode (law loop; money + effort siblings concurrent per
`docs/case-loops.md` fleet table) · read-only on `.pglite-copy-law`, no live writes, no
commits. **Unit:** bill (print). **Batch size:** 10. **Model tiering:** driver + full army =
**Sonnet** (no override). Opus reserved for the reflection only — the conditional top-signal
verdict was NOT dispatched (see §4).

## Headline

**10/10 new verdicts → 0 detected self-dealing conflicts** (all `severity: low`,
`pending_review`), extending batch-001's finding to a churn-led + sector-adjacency-tested head.
Cumulative forensic-covered: **19/141 (13.5%)**, all low severity — three batches in, the
absence of conflict is now a *stable, calibrated* finding for general PSP10 legislation, not a
fluke of one triage cut. The batch's real yield is (again) cross-cutting: a **second corroborated
sibling-collision candidate, softer than 120↔244** (tisk 111↔207 — both independently amend the
same §88 odst. 2 písm. c), confirmed by the deterministic pre-check with no LLM in the loop, but
touching *different substrings* of that clause rather than clashing on the same text — a
coordination risk, not a guaranteed drafting error; see §3/§6 for the Opus-audited distinction), a
**much larger
amends-undercount** than batch-001 found (1 recorded vs 7–8 real statutes), a **systematic
collision pre-check** across all 141 bills (24/29 same-statute groups show a §-overlap
candidate), and — the batch's biggest surprise — a **real, working historical §-diff**, achieved
by a different method than the one batch-001 scoped and shelved.

## 1. Re-weighted triage (`scripts/case-loops/law/triage-002.ts`)

Steering from batch-001: rank by churn (repeat-amendment targets) PRIMARY, conflict by
**sector-adjacency** SECONDARY (not raw `sponsor_contract_czk`, which saturated on
municipal/SOE board roles), money log-scaled TERTIARY, amends-count last.

**New heuristic module** `scripts/case-loops/law/company-sectors.ts`: the graph carries no
NACE/sector code on company nodes (money-feed.ts joins Hlídač+ARES+Registr smluv, no business-
activity classification), so this is a bounded, reviewable, name-based heuristic over the 157
companies actually tied to sponsors of the 65 flagged bills — a keyword+explicit-list municipal/
SOE exclusion, and a small explicit sector map for companies a name-regex can't classify (the
AGROFERT chemical/food subsidiaries, CS Cabot, Robert Bosch, etc.), documented as a pre-filter,
not a claim of completeness.

**A real bug found and fixed en route:** the first pass of the sector-adjacency signal returned
26/141 hits — implausibly high. Root cause: `THEME_KEYWORDS` domain matching (inherited from
batch-001's routing-anomaly signal) used naive `.includes()` substring matching. Czech boilerplate
"…na **vydání** zákona…" ("for the issuance of a law," in nearly every MP bill title) contains
"**daní**" (genitive of daň/tax) as a mid-word substring, so **every** bill false-positive-matched
the "economy" domain regardless of subject. Fixed with word-boundary regex
(`(?<![\p{L}])keyword`); hits dropped to a calibrated 6, then 5 after a second real gap the army
found live (below). **This is very likely a material contributor to batch-001's reported 89%
routing-anomaly over-fire rate**, which used the same `THEME_KEYWORDS` + `.includes()` pattern —
flagged for a follow-up fix to `triage.ts`'s routing-anomaly signal in batch-003.

**Sector-adjacency, corrected: 5/141 companies-tied-to-bills hit** (tisk 121 — already gated
batch-001 low; tisk 120 — already gated batch-001 low; tisk 11, 201 — pending). Batch head swapped
tisk 112 → **tisk 11** (5 private real-estate/investment-holding ties — Hartenberg Holding, IMOBA,
IF Holding, IF FACILITY — vs 589/1992 social-insurance-premium law) as this batch's deliberate
empirical test of the corrected signal. **Result: no real channel** (§4) — the *second*
independent triage method (after raw money in batch-001) to find zero conflicts on general
legislation, a materially stronger non-partisan-symmetry claim than either method alone.

**A second real gap, found live by the army, fixed after the fact**: tisk 11's dossier
independently confirmed **CHOMUTOVSKÁ BYTOVÁ a.s. is 100% city-of-Chomutov owned** — the
municipal-exclusion keyword net missed it because "Chomutovská" (derived from the city name
Chomutov) doesn't contain the substring "měst". Added to the explicit exclusion list; city-name-
derived adjectives are a durable blind spot for keyword-only municipal detection (documented in
`company-sectors.ts`).

**Opus's audit (§6) flags a third, unfixed gap**: the "economy" bucket is still semi-degenerate —
`SECTOR_KEYWORDS.economy` (holding/invest/facility/reality/stavební/finan) matches nearly any
private holding company, and `THEME_KEYWORDS.economy` (daň/daní/pojist/cena…) fires on nearly any
tax/insurance bill, so an economy×economy match (exactly what fired on tisk 11) is close to
uninformative on its own — the 5/141 hit rate is low mainly because the municipal/SOE exclusion
does the real filtering, not because the sector match discriminates well. A durable fix needs
narrower sub-buckets (e.g. split "insurance" from generic "economy") or an ARES-ownership check
in place of the label-keyword municipal net — both deferred to batch-003.

**Batch-002 head (churn-led + 1 sector-adjacency test)**: tisk 173, 216, 196, 111, 207 (all amend
40/2009, trestní zákoník, churn=6 — the term's busiest statute this round), 124, 198, 71, 86, 11.

## 2. Systematic sibling-collision pre-check (Q-law-4)

Two-part, per the steering: (a) **grouping** — deterministic, free, from the `amends` edge join:
**29 statutes are amended by >1 pending bill (71 distinct bills)**, written to
`payloads/collision-groups.json`. (b) **§-level confirmation** — a background subagent built
`scripts/case-loops/law/collision-check.ts`: fetches every one of the 71 bills' actual text from
psp.cz (the "Platné znění s vyznačením změn" document when available — shows exactly which §s
change — else the bill text trimmed to before "DŮVODOVÁ ZPRÁVA"), regex-extracts base-§
references, and computes pairwise overlap within each group. **All 71/71 bills fetched and
parsed — 0 skips** (17 transient fetch failures under 4-way concurrency were retried and cleared,
logged not silently dropped). **Sanity check passed**: tisk 120↔244 reproduces the known
batch-001 collision (§35ba + 25 more shared §s from the broader income-tax cluster).

**Result: 24/29 groups have ≥1 shared-§ candidate pair — 61 distinct bills, 72 pairs**
(`payloads/collision-report.json`). Honest calibration, stated in the report itself: raw base-§
overlap across a whole "Platné znění" excerpt is a **coarse candidate signal**, not a confirmed
drafting conflict — many pairs share only generic/definitional §s, or co-occur because the
excerpt includes neighboring untouched provisions for context. Two pairs stand above the rest by
close reading this batch: **120↔244** (batch-001, CONFIRMED — clashing renumbering on the exact
same text) and **111↔207** (new, §3/§6 below — CORROBORATED but softer: both bills touch the same
clause §88 odst. 2 písm. c), but on *different substrings* for unrelated reasons, so it's a
coordination risk rather than a guaranteed drafting error). The other 70 pairs are a ranked triage
list for future close-reading passes, not verdicts — consistent with
the kernel's "no LLM judgment in comparison logic" guardrail (the comparison is pure set overlap;
confirming an ACTUAL conflict needs a human/LLM to read the instructions). Notable candidate
worth flagging for batch-003: tisk 111↔207 also share **91 §s** total (likely near-full-statute
overlap — both are large omnibus criminal-code bills) — the 72-pair list is ranked by shared-§
count in the report for exactly this kind of triage.

## 3. Army — 10 verdicts, four stages, Sonnet only

Three grouped Sonnet agents (3–4 bills each), full ARMY-CONTRACT stages (clean/enrich/wire/
signal), every DZ/bill-text PDF actually fetched (WebFetch + local `pdftotext` where WebFetch
couldn't parse a PDF directly — logged per-bill). **Gate: 18/18 pass `--wide`, 17/18 pass
canonical** (the sole canonical failure is batch-001's already-documented tisk 248 case — every
one of the 10 NEW batch-002 verdicts passes the CANONICAL gate cleanly, no widening needed —
see §5 for the quality comparison this implies).

| tisk | origin | amends (real) | severity | conf | what it actually changes |
|---|---|---|---|---|---|
| 173 | mp_group (Babiš/Okamura/…) | 40/2009 | low | 4 | raises min. sentences for cohabitant mistreatment (§199) and animal cruelty (§302/303), new §302(2) offense for killing a pet from reprehensible motive |
| 216 | mp_group (Malá/Babiš/…) | 40/2009 | low | 4 | new §175a "drink spiking" offense + conforming drug-trafficking amendments; drafted broadly enough to sweep in low-harm conduct (materiality, not seriousness, threshold) — flagged, not alleged |
| 196 | government (Tejc) | 104/2013, 141/1961, 40/2009 | low | 4 | pure EU transposition (Reg. 2024/3011, cross-border criminal-proceedings transfer) + EAW infringement-gap fix; no sponsor money ties exist to assess |
| 111 | government | **40/2009 + 6 more (7 real vs 1 recorded)** | low | 5 | Ministry of Justice EU-transposition bill; **§88 coordination risk with tisk 207** (below, softer than a collision — different substrings of the same clause); biggest amends-undercount this batch |
| 207 | government | **40/2009 + 7 more (8 real vs 1 recorded)** | low | 5 | environmental-crime EU-transposition bill submitted **after its own transposition deadline** (own DZ admits it); **§88 coordination risk with tisk 111** |
| 124 | mp (Juchelka) | 117/1995 + 2 more | low | 5 | — |
| 198 | government | 117/1995 | low | 5 | — |
| 71 | mp_group (Richterová/Pirates) | 427/2011 | low | 5 | cuts pension-fund fees (mgmt 1%→0.4%, perf. 15%→10%); anti-industry direction, stalled pre-1st-reading |
| 86 | mp_group (Pirates) | 427/2011 | low | 5 | liberalizes investment rules (equities in mandatory conservative fund, up to 10% PE/VC); govt "nesouhlas", stalled — **checked against sibling 71: zero provision overlap, clean split of one reform agenda into two bills** |
| 11 | mp_group (ANO/SPD, incl. Babiš) | 589/1992 | low | 5 | **sector-adjacency test case** — freezes OSVČ minimum pension-insurance base at 35% (cancels scheduled rise to 40%); touches only self-employed persons' own contribution, never employer-side — the "economy" sector match on sponsors' real-estate/holding companies is **confirmed coincidental, not a real channel** |

## 4. The sector-adjacency verdict (the batch's calibration question)

tisk 11 was deliberately swapped into the head to test whether a sector-MATCHED conflict signal
(not raw money) finds something batch-001's money signal couldn't. **It didn't.** The bill only
touches the self-employed's own minimum assessment base — never an employer obligation, which is
the only channel through which a real-estate/property-management holding company's business could
plausibly connect. The army's verdict: "economy" bucket match is coincidental (same broad-bucket
imprecision documented in §1), not a substantive fit. **Per the batch's own charter, this means
the conditional Opus top-signal verdict was NOT dispatched** — the calibrated bar ("expect none")
held for a second, independently-designed signal. This is the batch's most important finding:
**two structurally different conflict signals (raw money, sector-adjacency) now agree on zero
real conflicts across 19 gated bills spanning three batches** — a materially stronger
non-partisan-symmetry claim than either alone.

## 5. Sonnet-army quality vs batch-001 (Opus/Sonnet mix)

| | batch-001 (3 Opus + 5 Sonnet) | batch-002 (10 Sonnet, driver Sonnet) |
|---|---|---|
| Gate pass (wide) | 8/8 | 18/18 (10 new + 8 carried) |
| Gate pass (canonical) | 7/8 (87.5%) | 17/18 — **10/10 of the NEW verdicts pass canonical cleanly** |
| Honest-low rate | 8/8 low, incl. the sharpest case (Babiš/tisk 115) | 10/10 low, incl. the deliberately adversarial sector-adjacency test (tisk 11) |
| DZ/bill-text fetch discipline | 8/8 real PDFs (pdftotext) | 10/10 real PDFs/text (WebFetch + local pdftotext fallback, logged per-bill) |
| Sibling-collision discovery | 1 (120↔244, "found by luck") | 1 new **corroborated** pair (111↔207, found independently by 2 of 3 grouped agents reading the same two bills) + a systematic 71-bill pre-check |
| Data-quality (amends-undercount) yield | 1 bill, 4 vs 1 | 2 bills, 7 vs 1 and 8 vs 1 — **larger and now confirmed systematic** for omnibus "a další související zákony" government bills |

**Important scope caveat on this table (Opus's §6 audit)**: this batch's 10 bills were all
general legislation whose honest answer was low — even the deliberately adversarial tisk 11
resolved to low. batch-001's tisk 115 (Babiš + criminal code + subsidy-fraud history) was a live
MEDIUM-candidate that drew Opus; batch-002 had no equivalent. The precise claim this table
supports is: **all-Sonnet matches Opus-assisted quality on the ~90% low-signal case; batch-002
provides no evidence either way on the high-signal case** the conditional-Opus trigger exists
for. Full Opus-authored synthesis of this comparison in §6 (dispatched at maximum-depth reasoning
per the batch-002 model-tiering policy).

## 6. Opus reflection

Reflection dispatched at maximum-depth reasoning per the batch-002 model-tiering policy. I read all
ten new verdict JSONs, the eight batch-001 verdicts, the collision report, and the two triage modules
directly — this is a skeptical audit, not a rubber stamp.

### 1. Citation discipline

Strong overall, with one recurring kind-mislabel. Law numbers are used precisely and are all real,
thematically coherent statutes: verdict-207's eight amended laws (40/2009, 141/1961, 359/1999, 273/2008
Policie, 341/2011 GIBS, 17/2012 Celní správa, 300/2013 Vojenská policie, 59/2017) are exactly the
security-force "jedy → jedy/rtuť" terminology-threading targets a mercury directive would touch — that
internal coherence is itself evidence the text was read, not confabulated. `č. N/RRRR Sb.` hinges are
used correctly throughout; `graph_fact` ids point to real `company:ico:*` nodes.

The one weak pattern: several `graph_fact` citations attach a **web-derived** claim to a company URN.
verdict-11 tags "CHOMUTOVSKÁ BYTOVÁ a.s. is 100%-owned by Statutární město Chomutov" and
"Hartenberg/IMOBA are genuinely private" as `kind:"graph_fact"` with a `company:ico:*` source — but the
graph only holds the *tie*; the ownership/private-business substance is web research. The right encoding
is `kind:"web"` with the verifying URL. The graph_fact (the tie exists) is real; the *substantive claim*
bolted onto it is not what the id supports. Minor, but it's a citation supporting a narrower fact than
the one it's attached to — worth a gate note for batch-003.

### 2. Honest-LOW calibration

No manufactured scandal anywhere; no obvious under-call. **tisk 216** is the sharpest UNSTATED-EFFECT and
it is well-grounded and proportionate: it correctly notes §130 tr. zák. defines "návyková látka" to
include ordinary alcohol, that §175a uses a *materiality* not *seriousness* threshold, and that "a prank
strengthening a friend's drink" could nominally fall in — then explicitly frames it "flagged, not
alleged" and observes the DZ is silent on subsidiarity. That is exactly the register the doctrine wants.
If anything it slightly *under*-weights ultima ratio (§12(2) tr. zák. would filter most such cases in
practice), i.e. the risk is real but somewhat more mitigated than stated — an over-call would have been
the failure mode, and it didn't happen. **tisk 207**'s missed-deadline effect is airtight: the DZ admits
it in a quoted Czech passage, and 28 May submission vs 21 May deadline is arithmetic; scoped as "possible
EU infringement exposure … not a self-dealing signal." The recurring "opening the criminal code creates a
vehicle for germane amendments at committee stage" watch-item (115/173/216) is appropriately hedged but
is now near-boilerplate across three verdicts — calibrated, but formulaic.

### 3. The tisk 111↔207 collision claim

This survives the systematic-agreement-without-evidence test, on the strength of a source the summary
table undersells: the **deterministic** collision-check independently flagged §88 in this exact pair
(`collision-report.json` l.1735–1737) — the section header "§ 88 Podmíněné propuštění z výkonu trestu
odnětí svobody" appears verbatim in *both* bills' fetched "platné znění" excerpts, from pure regex set
overlap with no LLM in the loop. That is the real corroboration, stronger than two agents agreeing. The
two verdicts then supply **distinct, non-copyable** specifics — verdict-111: §88 renumbers the *§168*
cross-ref "4, 5"→"5, 6"; verdict-207: §88 renumbers the *§283* cross-ref "odst. 4"→"odst. 5" and inserts
rtuť language — each keyed to its own bill's restructuring. Convergence-on-shared-framing would have
produced the *same* detail twice; instead each agent named the reference specific to the bill it read.
That is the signature of independent verification, not echo.

One honest downgrade the summary should inherit from the verdicts themselves: both call it a
"coordination risk rather than a guaranteed drafting error," because the two edits touch *different
substrings* of §88(2)(c) and can both apply — materially weaker than 120↔244, which struck the *same*
provision with clashing renumbering. §88's presence in both excerpts is a *candidate* (it may be
neighboring context in a marked-changes doc), and only the LLM asserts "odst. 2 písm. c)" as the locus.
So "**confirmed** sibling-collision pair" in the headline slightly over-hardens what is really a confirmed
*same-section touch* + a plausible-but-softer coordination risk. Downgrade the word "confirmed" to
"corroborated (softer than 120↔244)".

### 4. DZ/bill-text fetch discipline

Genuine fetching, no sign of paraphrase-without-fetch. Every verdict cites a specific
`orig2.sqw?idd=N` with a distinct id (265076, 266283, 266990, 267623, 271152, 269587, 270351, 271414,
268364, 270530, 268020), and each carries the fingerprints of real extraction — exact Kč deltas (30,840;
1,172,000/yr from a nine-year caseload table in 196), precise § lists, NS judgment `8 Tdo 1415/2013-176`
in 216, the quoted Czech deadline admission in 207. The collision report's independently-fetched excerpts
(real legal Czech) corroborate the same texts. The agents discovered the `orig2.sqw?idd=` redirect
pattern without being handed it — verdict-173/216/196's route through the `tiskt.sqw` index to the
`duvodovaZpravaUrl` is described explicitly. Fetch discipline matches batch-001's pdftotext bar.

### 5. Cost/unit

**Not precisely determinable from what's recorded.** The handoff carries batch-001's ≈60–130k tokens/unit,
~5 min/unit; there is **no** batch-002 token/wall figure in any committed file (ledger.json, handoff.md,
or batch-002.md §8, which self-assesses signal yield and explicitly notes the per-bill SIGNAL line was
superseded). To state a real number I'd need the per-subagent completion token counts the driver holds
out-of-band. Best-evidenced estimate: batch-001 ran 3/8 units on Opus; at Opus≈5× Sonnet's per-token
price, its blended verdict-production cost was ≈2.5× a Sonnet-only run of equal token volume. Grouped
3–4-bill agents re-read some shared context, nudging tokens/unit up, but pre-extracted `batch-002-targets.json`
inputs bound that. Net: all-Sonnet is very likely **~2–2.5× cheaper per unit** on the verdict step — but
that is an inference from the tiering ratio, not a measurement, and should be labeled as such.

### 6. Net verdict + batch-003 policy

**On this batch's population, all-Sonnet matches Opus-assisted quality — and out-yields it on cross-cutting
findings.** The 10 new verdicts pass the *canonical* gate 10/10 (vs batch-001's 7/8); the adversarial
tisk 11 was reasoned correctly on a legally precise distinction (individual OSVČ assessment base vs
employer-side obligation — the *only* channel a property holding could touch); the batch added a
systematic 71-bill collision pre-check, a larger and now-*systematic* amends-undercount (7-vs-1, 8-vs-1),
and — uniquely — verdict-124 caught the **opposite** failure mode (a false-positive over-count where
300/2025 rode in via a nested "ve znění" citation), a subtle catch that signals real reading, not
pattern-matching. verdict-198's "government captured the popular headline number from a rival bill it had
formally opposed, and out-paced it to the Senate" is a genuinely sharp Opus-grade political-process read
produced by Sonnet.

**Important caveat the driver must weigh:** this batch did **not** stress-test Sonnet on the case Opus
most exists for. All 10 were general legislation whose honest answer was *low*; even the "adversarial"
tisk 11 resolved to low. batch-001's tisk 115 (Babiš + criminal code + subsidy-fraud history) was a live
MEDIUM-candidate where the temptation to *manufacture or miss* a conflict was real — and it drew Opus.
batch-002 had no equivalent. So the finding is precise: **all-Sonnet matches Opus on the ~90% low-signal
case; batch-002 provides no evidence either way on the high-signal case.**

Policy for batch-003: **keep the tiering as-is** — Sonnet army + Opus for reflection and top-signal
verdicts only. Do **not** expand Opus into the routine army; Sonnet cleared the bar decisively. But keep
the conditional-Opus trigger armed, and make its firing condition a *genuine severity signal* (a real
sector-adjacency channel that survives the municipal/SOE filter, or a bill whose provisions plausibly
reach a sponsor's private business), **not** merely "a test case exists." Not dispatching Opus on tisk 11
was the **right call**: the army's reasoning was sound, the deterministic signal was coincidental, and
re-confirming a well-argued low with Opus would have been pure waste — I would have made the same
judgment from the same evidence.

### Secondary — `company-sectors.ts` methodology + blind spots

The heuristic is sound *as a documented pre-filter* (bounded to 157 real companies, name-based, `null` on
unrecognized rather than misclassified), and the substring→word-boundary fix is both correct and the
batch's most valuable engineering find (it plausibly explains batch-001's 89% routing over-fire — a
real deferred fix for `triage.ts`). Blind spots I can see in the code:

- **Municipal detection is whack-a-mole.** The Chomutovská catch proves city-name-derived adjectives
  (Chomutovská, Brněnské, Ostravské…) evade the `měst` net; the explicit list patched *one*. A durable
  fix cross-checks ARES ownership (majitel = obec/město/kraj/stát), not the label. The blind spot is
  acknowledged but not systematically closed.
- **The "economy" cell is semi-degenerate.** `SECTOR_KEYWORDS.economy` (holding|invest|facility|reality|
  stavební|finan) catches nearly any private holding, and `THEME_KEYWORDS.economy` (daň|daní|pojist|cena…)
  fires on nearly any tax/insurance bill — so economy×economy adjacency is near-uninformative. That is
  precisely what happened on tisk 11 (real-estate holdings → economy; 589/1992 → economy via "pojist").
  The 5/141 hit-rate is low mostly because the *municipal/SOE exclusion* does the real filtering, not
  because the sector match discriminates. Flag economy×economy as the weak cell for batch-003.
- **Single-bucket collapse of conglomerates.** AGROFERT is `agriculture` while its chemical subsidiaries
  are `environment`; `sectorOf` returns the first dict match only. A chemical-regulation conflict routed
  through AGROFERT-the-parent (bucketed agriculture) would be missed. Fine for a coarse pre-filter,
  but not a completeness claim — as the module already states.

## 7. Historical §-diff PROOF — a different, better method than the one scoped

See `docs/data-analysis/case-law/handoff.md` §7 for the full technical account. Headline: instead
of the bulk-download plan (dataset 001, 176 MB, ~1 MB/min observed in batch-001 — infeasible as a
batch subtask), this batch discovered e-Sbírka exposes a **public SPARQL endpoint**
(`opendata.eselpoint.gov.cz/sparql`) with **point-query** access to every enacted version and
every §-level fragment's real text, at negligible bandwidth. Built
`scripts/case-loops/law/esbirka-sparql-diff.ts`; produced ONE real, verified diff:
**§35ba of 586/1992 (income tax — spousal/basic tax credit), 2021-01-01 → 2024-01-01, 8 real
hunks** (5 modified, 3 removed — the "sleva na manžela"/spousal-credit definition was shortened
and partially relocated between these versions; the basic credit rose 27,840→30,840 Kč). Directly
relevant to this batch's collision context: §35ba is exactly the provision tisk 120 and 244
(batch-001) collide on. Wired end-to-end: `getLawData.ts` loads diff artifacts and attaches them
to every bill that amends the matching statute; `LawWatchPage.tsx` renders real before/after text
(HTML-stripped for display, raw fetched value kept in the artifact file as the anti-fabrication
source of truth). Verified live against the real graph (7 bills — the whole 586/1992 group —
now carry the diff) and `npm run check` (typecheck + lint + 166 tests) is green.

## 8. Coverage

- Units this batch: **10/141** (7.1%). Cumulative forensic-covered: **19/141 (13.5%)**.
- Severity histogram (cumulative, 19 gated): low 18 (of the 18 we have full JSON for; tisk 58's
  baseline verdict is not in this payload set but was also low per batch-001's baseline note) — 0
  medium, 0 high.
- Signal yield: self-assessed by the driver from agent reports (ARMY-CONTRACT's per-bill SIGNAL
  line was superseded by a custom grouped-report format this batch — noted as a process deviation,
  see lessons) — approx 2.3/unit (2 units at signal=3 for the confirmed collision pair + sector-
  adjacency test, 8 at signal=2).
- Skips/truncation: none in the army (10/10 processed) or the collision-check (71/71 fetched).
