# Case ③ Law loop — batch-003 (amends-census + collision close-reads + real diffs + army-8)

**Run:** 2026-07-24 · fleet mode (law loop; money + effort siblings concurrent per
`docs/case-loops.md` fleet table) · read-only on `.pglite-copy-law` (deleted after this batch),
no live writes, no commits. **Unit:** bill (print). **Batch size:** 8 (army) + 12 (collision
close-read pairs). **Model tiering:** driver + full army = **Sonnet**. Opus top-signal trigger
kept ARMED but NOT fired (see §5).

## Headline

Four scope items, all completed. **Q-law-6** (deterministic amends-census, full 141-bill
population, 140 checked/1 skip): confirms and quantifies the batch-001/002 finding — government
omnibus bills undercount real amended-laws **2.3× more** than MP bills (mean undercount 4.80,
n=55, vs 2.10, n=71). **Q-law-5** (12 collision-pair close-reads): the honest baseline held —
7/12 incidental — but 3 pairs upgraded to **confirmed-collision**, including turning the known
120↔244 pairwise §35ba clash into a **three-way cluster** (4↔120↔244) and a brand-new independent
finding, **210↔248 both inserting an unrelated new §134l** into 256/2004. **Q-law-7**: 4 new real
e-Sbírka §-diffs shipped, `paragraphDiffCount` on `/zakony` rose 7→15 bills. **Army-8**: 8 new
gated verdicts, all severity=low (0 conflicts, extending the non-partisan-symmetry finding to
27 gated bills across four batches). **Gate improvement**: a real citation-scope check now runs
(caught 10/26 existing+new verdicts with an ownership/status claim a `graph_fact` citation
can't actually support) and the stale `--wide`/canonical split is collapsed to one scope.

## 1. Q-law-6 — full-population amends-undercount census

**Script:** `scripts/case-loops/law/amends-census.ts` (new). Reused the collision-check.ts
fetch/cache pipeline verbatim (`.data/law-collision-cache/`, already 71/71 cached from
batch-002; this batch fetched the remaining ~70 bills, 0 net re-fetches for the already-cached
set). **Method note, a real bug found and fixed mid-run**: a first pass extracting every
`č. N/RRRR Sb.` citation from the whole operative bill text massively over-counted (tisk 4
showed 317 "real" laws) — Czech amending clauses restate a target law's FULL historical
amendment lineage as boilerplate ("zákon č. 586/1992 Sb., ve znění zákona č. 35/1993 Sb., zákona
č. 96/1993 Sb., …", dozens of historical citations of the ONE statute being amended, not new
targets). Fixed by extracting only the FIRST citation within each numbered `Čl. N` (Article)
block — Czech omnibus-bill drafting convention is one target statute per article, cited once
near the top. **Validated against known ground truth**: after the fix, tisk 111 → 7 real laws
(batch-002 found 7 vs 1 recorded) and tisk 207 → 8 real laws (batch-002 found 8 vs 1) — exact
match, both independently re-derived by the corrected method.

**Full-population results** (`payloads/amends-census.json`):
- **140/141 bills checked, 1 skip**: tisk 87 (no "Návrh zákona" or "Platné znění" PDF in the
  index — only DZ/summary/veřejnoprávní-povinnosti attachments exist for this print; logged, not
  silently dropped).
- **53/140 bills show any undercount**, summing to **420 unrecorded amended-law citations**
  across the population.
- **Origin correlation HOLDS and is now quantified**: government bills mean undercount
  **4.80** (n=55) vs mp/mp_group **2.10** (n=71) vs senate **0.33** (n=9) vs other **−0.20**
  (n=5, i.e. slightly OVER-recorded, noise at small n). Government bills undercount **~2.3×**
  more than MP bills.
- **Largest single undercount**: tisk 64 (government, accounting-law harmonization omnibus,
  "v souvislosti s přijetím zákona o účetnictví mění některé zákony") — 148 real amended
  statutes vs 1 recorded (160 `Čl.` blocks in the text; a genuinely enormous omnibus, not a
  measurement artifact — spot-checked).
- Top-15 undercounts and every row (real laws, recorded laws, source URL) are in the full JSON —
  no truncation.
- **Additive proposal** written to `payloads/amended-laws-full-proposal.json`: per-bill
  `amended_laws_full` prop for the 53 bills with `undercount > 0`. **Not applied to the graph**
  this batch — an orchestrator decision on whether/how to widen `amends` edges, per the task
  brief's explicit scope limit.

## 2. Q-law-5 — collision close-read (12 pairs)

Three grouped Sonnet agents (4 pairs each), reading the ALREADY-cached bill texts from
`.data/law-collision-cache/` (no re-fetch needed — collision-check.ts's batch-002 fetch covered
all 71 bills in the collision groups). Pairs picked by rank-adjacency to the already-confirmed
111↔207 (largest unconfirmed shared-§ counts first, from `collision-report.json`).

| pairId | law | shared-§ candidates | classification |
|---|---|---|---|
| 143↔248 | 256/2004 | 47 | incidental-overlap (data artifact — see below) |
| 67↔167 | 283/2021 | 21 | coordination-risk |
| 73↔193 | 477/2001 | 19 | coordination-risk |
| 4↔120 | 586/1992 | 16 | **confirmed-collision** |
| 4↔244 | 586/1992 | 16 | **confirmed-collision** (upgrades 120↔244 to a 3-way cluster) |
| 244↔248 | 586/1992 | 16 | incidental-overlap |
| 143↔210 | 256/2004 | 16 | incidental-overlap |
| 120↔248 | 586/1992 | 14 | incidental-overlap |
| 132↔143 | 256/2004 | 14 | incidental-overlap |
| 4↔248 | 586/1992 | 13 | incidental-overlap |
| 210↔248 | 256/2004 | 13 | **confirmed-collision** (new — §134l) |
| 40↔248 | 586/1992 | 11 | incidental-overlap |

**Final distribution: 3 confirmed-collision / 2 coordination-risk / 7 incidental-overlap.**
Honest baseline held — most (7/12) really are incidental, several via a **real data-quality
finding**: tisk 248 is a 5-statute omnibus bill whose "platné znění" PDF bundles ALL five laws'
provisions in one file, so the naive same-paragraph-number regex pre-check spuriously flags
"collisions" where the matching § numbers actually belong to DIFFERENT statutes bundled in the
same document (e.g. "§30", "§93", "§96" matched provisions of 117/1995 or 262/2006, not
256/2004/586/1992). This is a genuine limitation of the deterministic pre-check worth flagging
for any future collision-check re-run on other omnibus-heavy statute groups.

**Driver-verified findings** (grep-level, no LLM needed — stronger than a model read):

- **4↔120↔244, §35ba of 586/1992 — three-way cluster, upgrading the known pairwise 120↔244
  collision.** Direct grep of the cached novelization instructions:
  - tisk 4: `"V § 35ba odst. 1 písmeno a) zní:"` (265051.txt:77) — replaces letter a)'s formula.
  - tisk 120: `"V § 35ba se v odst. 1 zrušuje písm. a) a dosavadní písmena b) až e) se označují
    jako a) až…"` (268221.txt:15) — deletes a), renumbers b)-e) down to a)-d).
  - tisk 244: `"V § 35ba odst. 1 se písmeno b) zrušuje a dosavadní písmena c) až e) se označují
    jako…"` (277769.txt:19) — deletes b), renumbers c)-e) down.
  - Three simultaneously-pending bills each assume a DIFFERENT current lettering of the same
    enumerated list and restructure it incompatibly — tisk 248 confirmed NOT in the cluster (zero
    occurrences of "35ba" in its text).
- **210↔248, new §134l of 256/2004 — a fresh, independently-found collision.** Direct grep:
  tisk 248 `"Za § 134k se vkládá nový § 134l"` (277937.txt:133 — a Dlouhodobý investiční produkt
  state-contribution provision), tisk 210 inserts `§ 134l–134p` (271236.txt:93+ — EU Directive
  2022/2381 board-gender-balance definitions). Two currently-pending bills each independently
  originate brand-new, unrelated content at the identical virgin section number — same failure
  mode as 120↔244, found this batch with zero prior signal pointing at it.
- **67↔167 (283/2021, §334b odst. 1) — coordination-risk.** Both amend different numerals in the
  same sentence (deadline extensions: 2027→2030 vs 2026→2027); combinable, not a literal clash,
  but tisk 167's own explanatory report names tisk 67 by number as the reason it exists.
- **73↔193 (477/2001, §16/§21) — coordination-risk.** Independently-drafted edits to the same
  operative text, verified via each bill's actual Čl. I instructions.

**None of the 3 confirmed collisions are self-dealing/conflict-of-interest findings** — they are
legislative-drafting-error risks (incompatible section numbering across concurrently-pending
bills), not a channel benefiting any sponsor's private interest. This matters for the Opus
trigger decision (§5).

## 3. Q-law-7 — 4 new real e-Sbírka §-diffs

Using `scripts/case-loops/law/esbirka-sparql-diff.ts` unchanged (no new infrastructure needed —
confirms batch-002's "one command each" claim):

| law | § | from → to | hunks | picked because |
|---|---|---|---|---|
| 586/1992 | § 35c | 2021-01-01 → 2024-01-01 | 2 modified | queued from batch-002 (child tax credit); cross-checked against tisk 121's dossier (see caveat below) |
| 40/2009 | § 199 | 2021-01-01 → 2026-01-01 | 3 (2 modified, 1 added) | top-touched § in the criminal-code collision group (3 bills: 111,115,173) — directly relevant to already-gated verdict-173 |
| 40/2009 | § 283 | 2021-01-01 → 2026-01-01 | 26 (3 modified, 23 added) | second top-touched § in the same group; the diff surfaces a new §283a (23 added fragments) — real substantial new drug-trafficking-adjacent provisions |
| 427/2011 | § 60 | 2012-06-28 → 2026-01-01 | 5 modified | census-informed: 427/2011 is a churn-6 statute (tisk 71/86/119/248); §60 (management/performance fee) is exactly the provision tisk 71/86's pending reform proposals target |

**Honest caveat on §35c**: this is a HISTORICAL diff (2021 enacted → 2024 enacted), useful
context for tisk 121's PENDING proposal (which projects a further 2026 rise) but does NOT itself
validate tisk 121's proposed numbers, since those aren't enacted yet — e-Sbírka only holds
enacted text. The two-pipeline distinction (historical vs prospective) flagged in the law-loop
skill doc holds; no fabrication occurred (both fetched hunks are verbatim, correctly labeled with
their real 2021/2024 dates), but the cross-check against tisk 121's dossier is necessarily
partial for this reason — recorded plainly, not smoothed over.

**Render verification** (via `getLawData()`, live query against `.pglite-copy-law`, not assumed):
`paragraphDiffCount` **7 → 15 bills** (up from batch-002's 7). 15 bills now carry ≥1 real
paragraph diff: tisk 121, 115, 119, 71, 86, 120, 173, 216, 244, 248, 196, 4, 40, 111, 207.
`npm run check`-equivalent pieces (typecheck, law-boundary lint, full test suite) all green (§6).

## 4. Army — 8 new verdicts

Two grouped Sonnet agents (4 bills each), full ARMY-CONTRACT stages. Targets: **112, 132, 143,
210, 146, 28, 181, 24** — next-8 by `triageScoreV2` not yet verdicted (excludes the 18 tisky
listed as already-verdicted plus tisk 58's batch-001 baseline).

**Course-correction mid-batch**: both groups' first pass reported PDF-extraction failures on
psp.cz bill texts and defaulted to confidence ≤3, based on stated reasoning drawn from
title/metadata only. The driver caught this — the bill texts were ALREADY extracted to plain
UTF-8 text on disk from the batch-002 collision-check fetch (`.data/law-collision-cache/`) — and
sent both groups a follow-up pointing them at the cached files. Both groups re-read the actual
důvodová zpráva text and updated all 8 verdicts in place, raising confidence to 4-5 across the
board with real stated-reasoning summaries grounded in the fetched text. **Lesson for batch-004**:
brief army agents on the cache location up front — this cost one extra round-trip per group.

| tisk | origin | real amends (census) | severity | conf | what it actually changes |
|---|---|---|---|---|---|
| 112 | mp | 1 (0 undercount) | low | 4 | removes 120h/month preschool-attendance cap on parental-benefit eligibility, raises benefit cap 350k→370k Kč, adds CPI indexation (new §31a) |
| 132 | senate | 1 (0 undercount) | low | 4 | narrow technical fix to §32 ZPKT correcting ČNB's over-broad MiFID-II delegated-regulation application to small investment intermediaries |
| 143 | government | 6 (5 undercount) | low | 4 | EU Listing Act transposition (CELEX 32024L2810/2811/2994); collision-close-read confirmed genuine multi-statute scope |
| 210 | government | 3 (2 undercount) | low | 4 | EU Directive 2022/2381 board-gender-balance transposition (40%/33% thresholds, verbatim scope match); **§134l collision with tisk 248** (§2) |
| 146 | mp_group | 3 (0 undercount) | low | 4 | councilor-remuneration provisions across obce/kraje/Praha self-government acts; government formally opposed, committee recommended proceeding |
| 28 | mp_group | 2 (1 undercount) | low | 4 | amends RUD (municipal tax-revenue allocation formula, 243/2000); census-flagged unrecorded touch on the 2023 consolidation-package law |
| 181 | mp_group | 1 (0 undercount) | low | 4 | municipal-council-elections act amendment; the Jakob/Operátor ICT digitalization question was explicitly checked and settled — no, the bill does not touch election digitalization |
| 24 | mp_group | 10 (9 undercount) | low | 4 | obce act + 9 more statutes (largest undercount in this batch's 8 — confirmed against the actual text, a genuine municipal-cooperation-institute expansion) |

**All 8: severity=low, 0 conflicts.** None of the 8 sponsors carry graph money ties that plausibly
connect to what these bills change (several have no recorded ties at all: 112, 132; the flagged-
conflict ones — 146/28/181/24 — trace to state-owned-enterprise/municipal governance seats held
ex officio, the same municipal/SOE pattern batch-001/002 already found saturates raw money
signal). **Extends the non-partisan-symmetry finding to 27/141 gated bills (19.1%) across four
batches, still 0 real self-dealing channels.**

**Gate: 26/26 pass** (18 carried + 8 new — see §5 for the collapsed scope). All 26 verdicts
severity=low.

## 5. Gate improvements (`gate-verdicts.ts`)

Two changes, both requested by the batch brief:

1. **Citation-scope check (new)**: for any `graph_fact` citation pointing at a `company:*` id,
   flags (WARNING, not hard failure) claim text containing ownership/public-private-status
   keywords (vlastn-, podíl, soukrom-, veřejn-, měst-, kraj-, owned, private, public, municipal,
   state-owned…) — because company nodes verified to hold ONLY `{ico, subsidies_count,
   subsidies_total_czk}` as props, never ownership/status data. This is exactly the batch-002
   Opus-audit gap (verdict-11's CHOMUTOVSKÁ BYTOVÁ ownership claim) — batch-002 found it but
   explicitly did not fix the gate or retroactively edit the verdict. **Run against ALL 26
   verdicts (not just the 8 new), the check surfaces 10/26 with a real scope issue** — 8 from
   already-persisted batch-001/002 verdicts (11, 119, 121, 124, 173, 198, 216, 244) plus 2 new
   (28's Petr Hladík ARENA BRNO claim). **Deliberately a WARNING, not a hard gate failure** — a
   heuristic keyword check will have false positives, and retroactively invalidating
   already-persisted batch-001/002 verdicts would blur the audit trail (same non-edit discipline
   batch-002 established). The driver did NOT edit any existing verdict JSON to fix these —
   flagged for a human/orchestrator review pass, consistent with the kernel's "the human gate is
   never delegated."
2. **`--wide`/canonical collapse**: removed the flag; the gate now always uses the wide id-kind
   scope (company/person/law/bill/organ), matching the live write-time gate in `kg-forensics.ts`
   exactly (which has been fully-wide since batch-001 commit 24bfdbf) — the narrower "canonical"
   scope hadn't measured anything meaningful since then.

## 6. `npm run check`

**PARTIAL — fails, but not on anything this batch touched.** `npm run check` (typecheck + lint +
test) fails on 8 pre-existing lint errors in `features/civicscore/components/LeaderboardTable.tsx`
and `scripts/case-loops/effort/divergence-retune.ts` — both files show as modified/new in
`git status` from **concurrent fleet work on the effort case loop**, outside law's boundary
(`lib/db/*` and other cases' features are explicitly off-limits per the fleet rules). Verified
independently, scoped to the law boundary:
- `npx tsc --noEmit` (full repo typecheck): **green**.
- `npx eslint scripts/case-loops/law features/lawwatch app/zakony` (law boundary only): **green,
  0 errors**.
- `npm run test` (full vitest suite): **176/176 tests pass, 20/20 files**.

No law-boundary regression. The orchestrator should re-run `npm run check` after the effort
loop's concurrent changes land or are reverted — this batch cannot fix files outside its
boundary.

## 7. Opus top-signal trigger — NOT fired

Kept armed throughout per kernel policy; evaluated against both this batch's live-severity
sources (the 12 collision close-reads and the 8 new verdicts). **Decision: did not fire.**
Reasoning: all 26 gated verdicts (18 carried + 8 new) are severity=low with 0 self-dealing
channels — no candidate there. The collision close-read DID surface 3 confirmed-collisions
(stronger than expected — the honest baseline was "mostly incidental," and 3/12 confirmed is a
non-trivial hit rate), but **none of the three is a self-dealing/conflict-of-interest finding** —
they are legislative-drafting-error risks (two or more concurrently-pending bills independently
assuming incompatible section content/numbering), verified by direct grep of the actual
novelization instructions in the cached bill texts (not an LLM judgment call at all — the driver
confirmed both the 4↔120↔244 cluster and the 210↔248 §134l clash deterministically). The kernel's
trigger condition is explicitly "a genuine severity signal (a real sector-adjacency channel that
survives the municipal/SOE filter, or a bill whose provisions plausibly reach a sponsor's private
business) — not merely 'a test case exists.'" A drafting-numbering collision between two
government/opposition bills, with no sponsor money tie in either bill (210's collision-close-read
found no money tie in either verdict-210 or verdict-248), does not meet that bar. Re-confirming
a well-evidenced drafting-conflict finding with Opus would have been pure verification-theater
here — the deterministic grep already IS the strongest possible verification for this class of
claim.

## 8. Coverage

- Units this batch: **8/141 army-verdicted (5.7%)**. Cumulative forensic-covered:
  **27/141 (19.1%)**, all low severity — four batches in, zero real conflicts, now a stable
  cross-batch finding tested by two structurally different conflict signals (raw money,
  sector-adjacency) and 8 origin-diverse bills this batch alone.
- Collision close-reads this batch: 12/70 remaining unconfirmed pairs (58 still untouched —
  honest triage backlog for batch-004+).
- §-diffs this batch: 4 new artifacts, 5 total live (incl. batch-002's §35ba), 15/141 bills now
  render a real paragraph diff on `/zakony`.
- Skips/truncation: amends-census 1/141 (tisk 87, no PDF — logged, not dropped). Collision
  close-read: 0 (all 12 pairs' cached texts were readable). Army: 0 (all 8 processed, with one
  mid-batch course-correction, not a skip).

## Lessons learned (for batch-004)

1. **Boilerplate amendment-history citations are a distinct over-counting failure mode from
   the batch-001/002 `.includes()` substring bug** — worth naming as its own pattern class.
   Naive "every citation in the operative text" extraction over-counts by 10-100× on some bills
   because Czech drafting restates a target law's full historical amendment lineage
   ("ve znění zákona č. X Sb., zákona č. Y Sb., …") as boilerplate. The fix (first citation per
   numbered `Čl. N` article block) is specific to Czech omnibus-bill structure — any future
   body-text law-citation extraction in this codebase should reuse this per-article convention,
   not a blanket citation regex.
2. **Pre-extracted cache reuse needs an explicit pointer, not an assumption agents will find
   it.** Both army groups this batch initially reported PDF-extraction failures despite the exact
   text sitting on disk as plain UTF-8 from an earlier pass. Cost one round-trip per group. →
   batch-004+ army briefs should explicitly state the cache path and file-naming convention up
   front, not just "fetch what you can."
3. **Deterministic verification beats a model re-read for text-presence claims.** Both confirmed
   collisions this batch (4↔120↔244 cluster, 210↔248 §134l) were verified by the driver with a
   single `grep` against the cached texts — faster, cheaper, and more certain than a second LLM
   read would have been. When a collision claim is literally "does string X appear in both
   documents," grep IS the strongest available verification; reserve LLM close-reads for judging
   whether an overlap is SUBSTANTIVELY interacting (the actual hard part), and reach for grep to
   settle simple presence/absence questions.
4. **Omnibus bills contaminate the deterministic collision pre-check for OTHER pairs.** tisk 248
   (5-statute omnibus) caused 3/4 of its flagged pairs to be spurious — paragraph numbers
   coincidentally repeating across the bundled statutes' text in one PDF. A future refinement to
   `collision-check.ts` could partition an omnibus bill's extracted §-set by which statute each
   § actually belongs to (using the `Čl. N` article boundaries from Q-law-6's extraction), rather
   than treating the whole document as one undifferentiated §-set — would eliminate this class of
   false positive before the army even sees it.
5. **The Opus trigger's bar is working as calibrated, not just conservative by default.** This
   batch had genuine severity-adjacent findings (3 confirmed drafting collisions, a large
   government-omnibus undercount) that a looser trigger condition might have escalated — but
   none touched sponsor money, so none qualified. Four batches in, the trigger has been evaluated
   against real candidate material each time (tisk 11's sector test, this batch's collisions) and
   correctly held. Worth explicitly stating in any public methodology note: the trigger is
   evidence-tested, not merely unused.
6. **58 of the 70 originally-unconfirmed collision pairs remain untouched** — a real, sizeable
   backlog. Given this batch's 3/12 confirmed-collision hit rate (25%, higher than the "mostly
   incidental" baseline expectation), a dedicated close-reading batch on the remainder is
   probably higher-value than its position in the general triage queue would suggest — worth
   surfacing to the frontier explicitly (see handoff.md).
