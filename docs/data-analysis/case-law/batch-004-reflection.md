# Case ③ Law loop — batch-004 REFLECTION (Opus, maximum reasoning depth)

**Run:** 2026-07-24 · fleet mode · read-only investigation (no `.pglite` access needed —
everything below is derived from `payloads/**`, `ledger.json`, `features/lawwatch/**` and git
history). One file written (this one). No commits, no shared-vault edits — proposed shared-file
text is in §8, for the orchestrator to append.

This is the second of batch-004's two reserved Opus uses. The first (the amends-regen audit)
found and got fixed a real defect. This pass is not a recap: everything below is a claim I
re-derived from the artifacts, and three of the findings contradict or materially qualify what
the batch-004 payload documents themselves assert.

---

## 0. Headline of the reflection (read this if you read nothing else)

1. **Batch-003's stated reason for not firing the Opus trigger was factually wrong**, though its
   *conclusion* was right. Two of the 141 bills carry `sector_adjacent_conflict` — tisk 120 and
   tisk 121 — and **both are in the confirmed-collision set**, colliding **with each other** on
   586/1992 §35c(1) (a batch-004 pair). Batch-003 wrote "no sponsor-money channel in either bill
   of any pair" while one of its own confirmed pairs (4↔120) contained a flagged bill. → the
   trigger still should NOT have fired (§2), but the check must become deterministic, not a
   driver's impression. **This goes to `contradictions.md`.**
2. **"Collision backlog CLOSED" is true only against the 150-edge topology it was computed on.**
   The same batch's regen takes bill-pairs-sharing-a-statute from **88 → 436** (5×) and
   ≥2-bill statutes from 29 → 75. The two batch-004 workstreams silently invalidate each other's
   framing, and no artifact says so. The backlog is closed *and* about to reopen at 5× size.
3. **The union-vs-replace bug is a symptom of a class, not a one-off** (§3), and Defect 2's
   "0 edge impact today" is **contingent on the missing-law-node gap staying open**. Close the
   gap first (which is the right P1) and Defect 2 becomes a live data-loss bug. Sequencing
   matters; this is the load-bearing operational finding.
4. **The missing-law-node census (188 statutes / 289 citations) is the batch's most important
   finding and is buried.** 289 of 571 real amendment citations — **51%** — cannot become edges
   because the target statute has no node. Every downstream measure (churn ranking, collision
   candidate universe, sector-adjacency, triage) is computed on roughly half the citation base,
   and biased in a knowable direction. Promote to headline.
5. The `kolize tisků` ship decision **was justified** (§5) — but it carries one latent code
   defect (`§35ba` truncates to `35b` in the cluster key) and one schema drift
   (`incidental` vs `incidental-overlap`) that a future exclusion-style filter would trip on.

---

## 1. Cross-batch patterns

### 1.1 The "collision candidates are mostly incidental" baseline was ~2/3 artifact — but not entirely

The question posed is the right one, and the artifacts answer it precisely. Recomputed from
`collision-report-v2.json` + all four batches' close-reads:

| population | confirmed | coordination-risk | incidental |
|---|---|---|---|
| all 72 original candidate pairs | 17 (24%) | 9 (13%) | 8 real + 38 artifact (64%) |
| **34 partition-surviving pairs** | **17 (50%)** | **9 (26%)** | **8 (24%)** |

So: **among candidates that survive the statute-partition, only one in four is incidental.** The
batch-001→003 baseline ("collision candidates are mostly incidental") was *substantially* an
artifact of the omnibus-contamination bug — 38 of 72 candidates, 53%, never existed. But it was
not *purely* an artifact: 8 genuinely incidental pairs survive partitioning, and batch-004 names
the two residual classes honestly (§-numbers cited as cross-references inside a bill's own newly
inserted text; a new standalone act's own §-numbering matched against its secondary "o změně"
target). Those two classes are now the real incidental floor, and both are candidates for a
further deterministic filter (see §7, P3).

Corrected per-batch view: batch-003 read 12 pairs of which **4 later died in the partition**, so
its true denominator was 8 and its adjusted confirmed rate is **3/8 = 37.5%**, not 25%. The
headline jump is therefore 37.5% → 54%, not 25% → 54%. The residual difference is a **selection**
effect, and it is the more interesting half:

### 1.2 Shared-§ count is not a predictor of a real collision — and pre-partition it was an *anti*-predictor

Batch-003 picked pairs by "largest shared-§ count first". Measured against the final
classifications (n from `collision-report-v2.json`):

| classification | n pairs | mean shared § | median | values |
|---|---|---|---|---|
| confirmed-collision | 17 | 7.8 | **4** | 1,1,1,2,3,3,4,4,4,8,9,10,11,13,16,16,26 |
| coordination-risk | 9 | 19.8 | 8 | …,21,109 |
| incidental (survivors) | 8 | ~9 | ~7 | 1,1,1,1,7,14,14,16 |

**Three confirmed collisions had a shared-§ count of exactly 1** (e.g. 85↔88 on 110/2006 §7(2)(h)
— both inserting a new "bod 12" at the same list slot). The largest overlap in the whole set
(n=109) is a coordination-risk, not a collision. Overlap *volume* measures how much text two
bills' PDFs have in common; a drafting collision is a property of a *single* § and its
instructions. Pre-partition, volume was actively correlated with contamination (omnibus PDFs
match everything), so ranking by it selected against the truth. → **P32's "validate discriminative
power before trusting a signal" applies to ranking signals inside a backlog sweep, not only to the
top-level triage score.** New pattern, proposed for `patterns.md`.

### 1.3 The N-way pattern is not a curiosity — it is the modal shape at high churn

Batch-003 found the first 3-way cluster (§35ba) and proposed grouping by (statute, §). Batch-004
found two more 3-way clusters (117/1995 §30(1); 243/2000 §3) plus a 4-bill complex on 586/1992
§35c(1). **4 of 18 clusters are N-way, and they contain 9 of the 17 confirmed pairs** — i.e.
*more than half of all confirmed collisions live in a cluster the pairwise structure cannot
represent.* Batch-003 phrased this as "worth scoping once more clusters are found"; batch-004
settles it. Grouping by (statute, §) is now the only correct representation, which the shipped
surface already adopts.

There is also a substantive reading here that no artifact states: the three N-way clusters are all
**distributive-parameter fights** — the child tax credit amount (§35c), the parental-allowance cap
(117/1995 §30, "350 000 Kč"), and the municipal tax-revenue formula (243/2000 §3). These are the
provisions where multiple political actors independently propose competing numbers for the *same
literal string*. That is a *predictive* structural rule: **a § containing a bare monetary amount
or an allocation coefficient is a high-prior collision locus.** This is a deterministic,
cheap pre-filter (does the § text contain a `\d[\d\s]*Kč` literal or a percentage/coefficient?)
that could rank the post-regen 436-pair universe without any LLM. See §7 P3.

### 1.4 Compounding infrastructure is real and measurable

`amends-census.ts`'s per-`Čl.` first-citation convention (built in batch-003 to fix an
*over*-counting bug) was reused verbatim in batch-004 for a completely different purpose —
partitioning a bill's §-set by statute — via a shared regex in
`lib/ingest/sources/psp-legislation.ts`. That single parsing convention has now paid off three
times (census de-duplication, collision partitioning, regen extraction). This is the strongest
evidence to date for the kernel's "deterministic code before either model tier" claim: the
partition fix killed 38 candidate pairs that would otherwise have cost ~8 grouped Sonnet agents
to dismiss one at a time.

---

## 2. Does batch-004 contradict a prior-batch conclusion? — YES, one. Verdict on the trigger.

### 2.1 The contradiction

Batch-003's handoff §1 and batch-003.md §7 both assert, as the load-bearing justification for not
firing the Opus trigger:

> "the 3 confirmed collisions are drafting-numbering conflicts with **no sponsor-money channel in
> either bill of any pair**"

**This is false as stated.** From `ledger.json`, exactly **5 of 141 bills** carry
`sectorAdjacency: true` (tisky 120, 121, 11, 201, 154). Cross-referencing against the confirmed
set:

| bill | sponsorContractCzk | sector_adjacent_conflict | adjacent company | in confirmed pairs |
|---|---|---|---|---|
| **120** | 235 543 222 | **yes** | SOMPO, a.s. (economy) — Lukáš Vlček | 120↔244 (b-001), 4↔120 (**b-003**), 121↔120 (b-004) |
| **121** | 5 397 460 397 | **yes** | Teleky Medicus s.r.o. (health) — Róbert Teleky | 112↔121, 121↔198, 4↔121, 121↔120 (all b-004) |

Tisk 120 was in batch-003's *own* confirmed pair 4↔120 and carries the flag. So the blanket claim
was wrong at the time it was written, on data already in the ledger. Additionally, 6 further
confirmed-set bills carry non-trivial `sponsorContractCzk` under `municipal_soe_excluded`
(28: 5.40B; 232: 1.24B; 71, 78, 104, 198), and 216/119/73/67 do so in the coordination-risk set.

Concentration check: 2 of 5 flagged bills (40%) appear in the confirmed set, versus a base rate of
20 confirmed-set bills / 141 (14%). Small n, but the direction is not nothing — and it is exactly
the check a Sonnet pass skips because the collision workstream and the money workstream were
written by different agents into different payload files.

### 2.2 Verdict on the trigger calculus — **EXPLICIT**

**The Opus top-signal trigger should NOT have fired this batch, and should not fire
retroactively for batches 001–003. But batch-003's justification must be corrected, and the check
must be made deterministic before batch-005.**

Reasoning, stated so it can be audited:

- **The collision loci are universal-benefit tax and allocation parameters, not private channels.**
  586/1992 §35c(1) is the per-child tax credit (15 204 Kč → 22 320 / 22 380 Kč). 117/1995 §30(1)
  is the parental-allowance total (350 000 → 370 000 / 400 000 Kč). 243/2000 §3 is the municipal
  RUD formula. No mechanism exists by which a change to any of these reaches SOMPO, a.s. (a
  municipally-owned waste utility, itself already on tisk 120's `municipalExcludedCompanies`
  logic class) or Teleky Medicus s.r.o. (a physician's practice) other than as a citizen/taxpayer.
  A conflict channel requires the provision's benefit to be *appropriable* by the tie; a universal
  per-child credit is definitionally not.
- **The adjacency flags themselves are the known-degenerate class.** SOMPO's sector is the
  "economy" catch-all matched against the income-tax act — i.e. adjacency by tautology (every
  commercial entity is "adjacent" to 586/1992). Teleky Medicus/health fired against 187/2006
  (sickness insurance), while the *collision* is in 586/1992 and 117/1995. This is precisely the
  batch-002 tisk-11 result ("coincidental economy-bucket match, no real channel"), reproduced.
- **Verification-theater test.** Every confirmed pair is grep-verified verbatim from cached
  novelization instructions. Opus cannot make a deterministic string-presence finding more true
  (P49). The trigger exists for *judgment under ambiguity about a money channel*, and there is no
  ambiguity here to resolve.

**But two things must change:**

1. **`sector-adjacency is computed against the amended STATUTE, and that is too coarse.`** 586/1992
   as a statute is adjacent to every commercial sector; §35c (child credit) is adjacent to none.
   Now that collision close-reads and §-diffs give us **§-level** targets for a growing set of
   bills, adjacency should be evaluated at §-level for those bills. This is the natural next
   iteration of the P32 fix — the same "the signal saturates, densify its basis" move, one level
   finer. **This is the single highest-value triage improvement available.**
2. **The money×collision cross-check must be a script, not a paragraph.** Add
   `scripts/case-loops/law/collision-money-crosscheck.ts`: for every confirmed/coordination pair,
   join both bills to `ledger.json` flags and emit a table. Five minutes of code; it is the
   *evidence* for the trigger decision instead of an assertion about it. Batch-003 asserted; I had
   to re-derive. That asymmetry is the defect, not the conclusion.

**Net:** the trigger's record is now "evaluated 5 times against real candidate material, correctly
not fired 5 times" — but for the first time the not-firing rests on a *substantive* argument
(non-appropriability of a universal benefit) rather than on an absence of flags, because the
absence of flags was not real. That is a stronger record, honestly stated, and it belongs in any
public methodology note in exactly that form.

---

## 3. The amends-regen defect — systematic blind spot? **VERDICT: YES, mild-to-moderate — and its urgency is a function of ordering, not of size.**

**Explicit verdict: the union-vs-replace bug was NOT a one-off. It is one instance of a class:
the pipeline treats the title-derived and body-derived citation sets as mutually exclusive
alternatives selected by a scalar trigger, when they are two independently-noisy observations of
one underlying truth that should be unioned with per-ref provenance.** The Opus audit's fix
(union, with `source: census_full | title_fallback` tagging) is the structurally correct remedy,
not a patch — but it was applied only to the 53 bills that pass the count-based `undercount > 0`
gate, so the class remains half-open.

Sizing the class, re-derived from `amends-census.json` across all 140 checked bills:

- **9 bills (6.4%) have at least one title-derived statute the body extraction misses** — tisky
  88, 219, 222, 243 (undercount ≥ 0) and 36, 42, 107, 124, 153 (undercount = −1). **All nine of
  those missed statutes DO have law nodes** (I checked each against the regen's node set: 360/2025,
  301/1992, 134/2016, 223/2016, 89/2012, 416/2009, 159/1999, 300/2025, 468/1991). Tisk 88 was
  merely the only one that *also* passed the `undercount > 0` gate, which is why it was the only
  one that lost an edge. The other 8 are protected today purely by the accident that they fall to
  `title_fallback` wholesale.
- **3 bills (219, 222, 243) have title and body sets that are completely disjoint** — the two
  extraction methods disagree about *everything* the bill amends. That is not a rounding error;
  it is a signal that one of the two is wrong on those bills, and nobody knows which.
- **The 6.4% figure is a usable recall metric nobody has computed**: the P48 per-`Čl.`
  first-citation rule has a **~6% false-negative rate** measured against title-derived refs as
  ground truth. Worth stating plainly — the batch-003 census's validation was *precision*-focused
  (it fixed a 10–100× over-count and validated against two known-good bills); its **recall was
  never measured**. A one-sided validation is the actual systematic blind spot here.
  Testable hypothesis for the miss mechanism: a `Čl.` block whose *first* citation is not its
  target — most plausibly repeal articles ("...a zrušuje se zákon č. X Sb.") and articles that
  open by citing a law they cross-reference rather than amend.

**Is Defect 2 low-priority, as the fixing agent assessed? Conditionally yes — and the condition is
about to be removed.** Defect 2 costs 0 edges *today* solely because the three missed body-side
statutes (354/2019, 9/2002, 240/2000) have no law node. My §4 recommendation is to ingest the 188
missing law nodes. **The moment that lands, Defect 2 becomes a live data-loss bug** and those three
bills' real amendment targets stay invisible. This is the sequencing finding:

> **Q-law-11 (proposed, real urgency, but ordering-urgency not size-urgency): make the regen
> trigger set-difference-based, and land it BEFORE or IN THE SAME CHANGE as the missing-law-node
> ingest — never after.**

Two supporting items, both cheap:

- **The validator's blind spot is the more general lesson.** `validate-amends-regen.ts` is entirely
  forward-facing (id membership, duplicates, no fabrication) and structurally cannot see a
  deletion. **This is P44/D1 in a new costume**: the kernel already says "when reviewing ANY
  write-path build, ask what ELSE writes to this field" — the topology analogue is "**any
  regeneration of an edge set must diff against the live set and require an explicit allowlist for
  every deletion**". That should be a standing gate rule for all three case loops, not a law-local
  fix. Proposed for `patterns.md`.
- **The 289-unresolved figure is disclosed in aggregate but not per bill.** Any narrative pairing
  "tisk 64 = 148 real statutes vs 1 recorded" with the regen must say **35 edges**, not 148. The
  audit flags this; I am re-flagging it because the impact doc's headline table still invites the
  misreading, and it will land in a public-facing surface eventually.

---

## 4. The missing-law-node census — **yes, this is the batch's most important open finding, and it is understated**

**Recommendation: promote to headline finding and batch-005 P1.**

The facts, from `batch-004-amends-regen.json → stats`: 571 citations considered, **282 resolve,
289 do not** — **50.6% of all real amendment citations in the PSP10 population point at a statute
the graph does not contain.** 188 distinct statutes. The `law` layer has 101 nodes; the corpus
actually cited is ~289 statutes. The graph knows about **35% of the legislative surface these
bills touch.**

Why this outranks everything else in the batch:

1. **It is a measurement-validity finding, not a coverage to-do.** Every law-case metric is
   computed over the resolvable half: churn ranking, the collision candidate universe, the
   most-amended-statute leaderboard, `maxTargetChurn` (the PRIMARY triage term). None of them is
   wrong *arithmetically*; all of them are conditioned on an unstated filter.
2. **The bias has a knowable direction.** The 101 law nodes exist because they were named in bill
   *titles*. The 188 missing ones are disproportionately statutes touched only in *bodies* — i.e.
   the government-omnibus tail, precisely the class batch-003 proved undercounts 2.3× worse.
   **The graph systematically under-represents exactly the legislative activity the loop identified
   as most opaque.** That is not a neutral gap; it is a gap aligned with the case's own thesis.
3. **It gates the loop's most valuable unbuilt product.** "Which statutes does this parliament
   quietly rewrite most?" is answerable only over resolvable statutes. The impact doc's own missing
   table shows 424/1991 (political parties financing), 21/1992 (banks), 256/2000 (SZIF/agricultural
   subsidies), 365/2000 (public-administration IS), 49/1997 (civil aviation) each cited by 3–4
   bills with **no node at all** — 424/1991 in particular (party financing, cited by tisky 6, 7,
   64, 77) is squarely on this platform's mission and currently invisible.
4. **It is cheap and inside existing autonomy.** e-Sbírka SPARQL already resolves statute → title →
   ELI at negligible bandwidth (`esbirka-sparql-diff.ts` proves the access path, three batches
   running). The kernel's Authority section grants autonomous ingest for open sources. This is a
   bounded, deterministic, one-script job — no LLM in the loop.

Being in a payload file is the wrong altitude for this. It should be in the batch note headline,
the ledger metrics block, and the frontier as a named question.

---

## 5. Sanity-check of the `kolize tisků` ship decision (a44fe5f)

**Verdict: the ship bar was met and the surface does not overclaim.** Verified independently, not
from the commit message:

- **Cluster arithmetic reproduces exactly.** I re-ran the loader's union-find logic over
  `PRIOR_PAIRS` + both close-read payloads: **18 clusters, 4 with ≥3 bills, 17 confirmed pairs, 9
  coordination-risk.** Matches the commit claim.
- **The "≥3 confirmed with clean data" bar** is comfortably met: 13 of the 17 confirmed pairs were
  produced *after* the partition fix, on partitioned candidates, each grep-verified against cached
  psp.cz novelization text.
- **The grep-excerpt promise is NOT undermined.** All **29** payload-sourced non-incidental pairs
  carry verbatim `billAExcerpt`/`billBExcerpt` with file path and line numbers. Only the 2
  narrated prior pairs (120↔244, 111↔207) have `evidence: null`, and the code handles this
  honestly and visibly: a documented comment refusing to invent quotes, a *different* `SourceNote`
  ("narrated, batch-001/002" vs "deterministic partitioned pre-check (--v2) + LLM close-read,
  grep-verified"), and a toggle label that degrades from "citace a plné odůvodnění +" to "plné
  odůvodnění +". A reader can tell which pairs are quoted and which are narrated. **That is the
  correct handling of a real gap, not a gap that undermines the promise.** (It would be nicer
  still to backfill both — 2 greps against the existing cache, ~10 minutes, listed as a batch-005
  cleanup.)
- **Rendered as derived, gated, and non-accusatory** — confirmed/coordination tokens only,
  `SourceNote` per pair, and a framing line stating that parallel drafting is normal in a
  legislature and not evidence of impropriety. Correct for this class of finding.

**Two defects found in the shipped code (neither is an overclaim; both are latent):**

1. **`primaryParagraph()` truncates multi-letter § suffixes.** `/^(\d+[a-z]?)/` maps
   `"35ba odst. 1"` → key `35b`. Harmless today (the §35ba and §35c clusters still separate, and
   the displayed label uses the full `sharedParagraph` string, so nothing user-visible is wrong)
   — but 586/1992 genuinely contains **§35b, §35ba, §35bb, §35bc**, so the first future §35b or
   §35bb pair will **silently merge into the §35ba cluster** and mislabel it. Fix:
   `/^(\d+[a-z]*)/`. One character.
2. **Classification-label schema drift**: batch-003's payload uses `incidental-overlap`,
   batch-004's uses `incidental`. The loader filters by *inclusion* so it is correct today — but I
   empirically tripped on it while auditing (an exclusion-style filter returns 29 pairs instead of
   24). Normalize to one value in the payload schema before a third variant appears.

**One framing caution, not a code bug:** the commit message says "586/1992 §35c/§35ba now spans 4
bills". The UI correctly renders these as two separate clusters (§35ba: 4/120/244; §35c: 4/120/121/244).
Any public copy should follow the UI, not the commit message.

---

## 6. The finding no artifact states: the two workstreams invalidate each other's framing

`collision-batch004-summary.md` declares **"Backlog status: CLOSED"**. The same batch's
`batch-004-amends-regen-audit.md` reports that applying the regen takes **bill-pairs sharing a
statute from 88 → 436**, statutes with ≥2 amending bills from **29 → 75**, and with ≥3 from
**10 → 42**.

The collision v2 pre-check ran against `collision-groups.json` — the **29-group, 150-edge**
topology. So:

> **The collision backlog is closed against a topology that batch-004 itself replaced.** Once the
> regen is applied, the candidate universe is ~5× larger and has never been pre-checked.

This is not a criticism of either workstream — both are correct in their own scope — it is the
kind of cross-workstream interaction that only appears when someone reads all the artifacts
together, which is the entire justification for a reflection pass. Two consequences:

- **"CLOSED" must be restated as "closed against the 150-edge topology; reopens at ~5× candidate
  volume when Q-law-8 is applied."** Otherwise the ledger records a closed backlog that is not
  closed, and batch-005 triage will under-rank it.
- **Rough sizing for batch-005:** 436 candidate bill-pairs → apply the observed §-matching and
  partition-survival rates (72/88 then 34/72, i.e. ~39% of pairs sharing a statute survive to
  close-read) → **~170 survivors**, at the observed 50% confirm rate → **~85 further confirmed
  collisions**, against 17 today. Temper the estimate: the new edges are dominated by omnibus
  bills making small technical touches, where genuine incompatibility is likelier rare, and the
  two residual artifact classes will eat some. But even a 3× haircut leaves the discovered set
  roughly doubling. **This is the largest single pool of undiscovered real findings in the case.**
  It also means brute-force close-reading is no longer affordable — hence the amount-literal
  pre-ranking heuristic in §1.3 / §7 P3.

Also worth recording: **batch-004 produced zero new forensic verdicts** (26 verdict files, same as
batch-003). Forensic coverage has been flat at 27/141 (19.1%) for a full batch. That was a
defensible allocation — infrastructure and backlog closure compound — but two consecutive flat
batches would be a coverage stall, and the churn re-ranking below means the army cannot simply
resume where it stopped.

**The regen also invalidates the triage ranking itself.** `batch002TriagePolicy` is "churn
PRIMARY". The regen flips #1 (40/2009 6→12 overtakes 586/1992), promotes three new entrants
(134/2016, 2/1969, 89/2012) and drops three (1/1993, 128/2000, 491/2001). Every row's
`maxTargetChurn` — and therefore `triageScoreV2` — is stale. **Re-triage is a precondition for the
next army, not a nice-to-have**; running army-9 off the current ledger order would violate the
kernel's "the army processes in VALUE ORDER" guarantee. Related: naively recomputing
sector-adjacency over the regenerated edge set will **re-degenerate that signal** (tisk 64 goes
from 1 to 35 amended statutes; adjacency against *any* amended statute will fire on nearly every
omnibus). Predicted, so it can be checked: post-regen naive adjacency hits will jump well above 5
and be dominated by omnibus bills. Move adjacency to §-level (§2.2) *before* recomputing, not after.

---

## 7. Steering for batch-005 — prioritized

**P1 — Ingest the 188 missing law nodes (e-Sbírka SPARQL), then apply the regen.** Deterministic,
inside existing ingest authority, unblocks the whole measurement layer. Order within P1 matters:
(a) land the set-difference trigger fix (Q-law-11, below) **first or simultaneously**; (b) ingest
nodes; (c) apply the unioned regen; (d) re-run `validate-amends-regen.ts` **with a new
no-live-edge-dropped check**. Doing (b) before (a) converts Defect 2 from benign to live.

**P2 — Q-law-11: set-difference trigger + a deletion-diff gate.** Replace `undercount > 0` with
`realLaws ≠ recordedLaws`, keep the union, and add "no live edge deleted without an explicit
allowlist" to the validator. Then measure the census's **recall** (currently unmeasured; ~6%
false-negative rate estimated in §3) and test the repeal-article hypothesis on the 9 known misses.
Small, bounded, and it closes the class rather than the instance.

**P3 — Re-triage, then re-run the collision pre-check on the post-regen topology with a ranking
heuristic, not brute force.** ~436 candidate pairs cannot be close-read pair-by-pair. Rank by:
(i) both bills issue an *amending instruction* on the same § (already available from the v2
partition); (ii) **the § text contains a bare monetary amount or an allocation coefficient** —
all three N-way clusters are distributive-parameter fights (§1.3); (iii) *ignore* shared-§ count,
which §1.2 shows is not predictive. Add a deterministic filter for the two named residual
artifact classes (cross-reference-inside-new-text; a new act's own §-numbering). Target: read the
top ~40, not 170.

**P4 — §-level sector-adjacency + the money×collision cross-check script.** Both from §2.2. The
cross-check script is ~30 lines and turns the trigger decision into evidence. §-level adjacency is
the highest-value triage improvement available and is now feasible for the growing set of bills
with known § targets. **Do not recompute adjacency naively over the regenerated edges.**

**P5 — Resume the army (army-9, 8 units) off the RE-TRIAGED head.** Coverage 27/141 is flat;
the head has changed (40/2009-touching bills now lead). Brief agents with the cache path up front
(batch-003 lesson 5, still the standing fix) and with the confirmed-collision table, so a bill in a
known cluster gets that context in its verdict.

**P6 — Cleanups, batchable into any of the above:** fix `primaryParagraph` to `/^(\d+[a-z]*)/`;
normalize `incidental` / `incidental-overlap`; backfill grep excerpts for the 2 narrated prior
pairs; log the two §-diff targets that honestly yielded no artifact (§35ba alt-range, §134l /
256-2004) in the batch note, since "no silent truncation" requires the batch note, not only an
agent report; write the still-missing `batch-004.md` narrative.

**Not now, explicitly:** the 10/26 citation-scope WARNING re-tagging has now rolled through
**three** build-reviews. Per the kernel's Authority section, "deferred-three-batches is a decision
point" — batch-005 must either commit it to a human review pass or retire it. It cannot be
deferred a fourth time.

---

## 8. Metrics row + proposed shared-file additions

### Metrics row (for `ledger.md`)

| metric | batch-004 | vs batch-003 |
|---|---|---|
| units processed | 24 collision close-reads + 141-bill regen (138 with data, 3 no-data) + 3 §-diff targets attempted | b-003: 8 army + 12 close-reads + 140 census |
| army/forensic units | **0** (coverage flat at 27/141 = 19.1%) | 8 |
| new signals | 19 collision signals (13 confirmed + 6 coordination) + 2 new 3-way clusters + missing-law-node census + churn #1 flip + 2 pipeline defects = **24** | 10 |
| **signal yield** (new signals ÷ close-read units) | **0.79** (confirmed-only 13/24 = **0.54**) | 0.42 (confirmed-only 0.25; **0.375 adjusted** for the 4 pairs later killed by partitioning) |
| pre-check precision after partition fix | 34/72 survive (**53% of the original candidate list was artifact**) | n/a |
| §-diffs | 1 new (§88/40-2009, 23 hunks); 2 targets honestly yielded nothing | 4 new |
| gate | 26/26 carried, 0 new verdicts | 26/26 |
| reuse rate | **3 of 4 workstreams built on prior-batch tooling** — `Čl.`-boundary parser (b-003 census) → v2 partition; `esbirka-sparql-diff.ts` unchanged for a 3rd batch; cache 71/71 bills, 0 re-fetches; ARMY-CONTRACT group-inputs pattern (5 groups). New code: `amends-regen.ts`, `validate-amends-regen.ts` only | 2 of 4 |
| cost/efficiency | 5 grouped Sonnet agents for 24 pairs (4.8 pairs/agent vs 4.0 in b-003); **collision workstream needed no `.pglite` copy at all** (reads payloads + cache); 2 Opus uses, both yielding real defects (union-vs-replace fix; this pass's trigger-justification contradiction) | — |
| fleet discipline | held — no live `.pglite` writes, no shared-vault edits, no commits from the case run; boundary respected | held |

### → `contradictions.md`

```
### Law: batch-003's "no sponsor-money channel in any confirmed collision" was factually wrong (conclusion stood, reasoning did not)
batch-003.md §7 and handoff.md §1 justified not firing the Opus trigger with "the 3 confirmed
collisions are drafting-numbering conflicts with no sponsor-money channel in either bill of any
pair." Re-checked against ledger.json in batch-004: exactly 5 of 141 bills carry
sector_adjacent_conflict (tisky 120, 121, 11, 201, 154), and TWO of them — 120 (SOMPO, a.s.,
235.5M CZK, sponsor Lukáš Vlček) and 121 (Teleky Medicus s.r.o., 5.40B CZK, sponsor Róbert
Teleky) — are in the confirmed-collision set. Tisk 120 was in batch-003's OWN confirmed pair
4↔120. batch-004 then confirmed 121↔120 directly, putting the only two sector-adjacency-flagged
bills in the case into a collision with each other on 586/1992 §35c(1). The trigger decision
still stands, but on a DIFFERENT and stronger ground: the collision loci (§35c child tax credit,
117/1995 §30 parental-allowance cap, 243/2000 §3 RUD formula) are universal-benefit parameters
whose benefit is not appropriable by a waste utility or a physician's practice, and both
adjacency flags are the known-degenerate sector-bucket class (economy-vs-income-tax tautology;
health flagged against 187/2006 while the collision is in 586/1992). → a money×collision
cross-reference must be a deterministic script joined to ledger.json flags, never a driver's
prose assertion; two workstreams writing to different payload files will not cross-check
themselves.

### Law: "collision backlog CLOSED" (batch-004) is scoped-true, headline-false
collision-batch004-summary.md declares the 72-pair backlog CLOSED, but the v2 pre-check ran on
the 29-group / 150-edge topology that the SAME batch's amends-regen replaces (bill-pairs sharing
a statute 88→436, statutes with ≥2 amending bills 29→75, ≥3 bills 10→42). The backlog is closed
against a topology that no longer exists once Q-law-8 is applied; the candidate universe reopens
at ~5× and has never been pre-checked. → restate as "closed against the 150-edge topology;
reopens on regen apply." Estimated ~170 partition-surviving pairs at the observed rates, of which
~half historically confirm.
```

### → `patterns.md`

```
### A ranking signal inside a backlog sweep needs the same discriminative-power validation as a triage signal (P32, one level down)
batch-003 ordered its collision close-reads by "largest shared-§ count first". Measured against
the final 4-batch classifications, shared-§ count does not discriminate: confirmed collisions have
a MEDIAN of 4 shared §s and three had exactly 1 (e.g. 85↔88, both inserting a new "bod 12" into
110/2006 §7(2)(h)), while the largest overlap in the whole set (109) is only a coordination-risk.
Pre-partition it was actively an ANTI-predictor, because omnibus-PDF contamination inflates
overlap volume — so the ranking selected for the artifact class. Overlap VOLUME measures shared
text; a drafting collision is a property of one § and its instructions. → P32's "validate before
you trust" applies to any ordering signal that decides what gets read, not only to the top-level
triage score.

### Regenerating an edge set is a write path: diff against the live set, allowlist every deletion
batch-004's amends regen replaced title-derived citations with body-derived ones for 53 bills and
silently dropped a live edge (tisk 88 → 360/2025), leaving law node 360/2025 with zero amends
edges; the headline said "+131" when the truth was "+132 added, −1 dropped." validate-amends-
regen.ts could not catch it — every check it runs (id membership, duplicates, no fabrication) is
forward-facing and structurally blind to deletion. This is P44/D1 in topology form: the kernel
already requires asking "what ELSE writes to this field" on write-path builds; the analogue for
edges is "what does this regeneration REMOVE". → any edge-set regeneration must diff against live
edges and require an explicit allowlist for each deletion, before applying. Root cause was
treating title-derived and body-derived citation sets as mutually exclusive alternatives chosen
by a scalar trigger, rather than as two noisy observations of one truth to be UNIONED with
per-ref provenance — the union fix generalizes, the trigger fix (count-based → set-difference)
does not yet exist.

### Law: N-way collision clusters are the modal shape at high churn, and they cluster on distributive parameters
Across four batches, 4 of 18 (statute, §) clusters are N-way and they contain 9 of the 17
confirmed pairs — more than half of all confirmed collisions live in a shape the pairwise
structure cannot represent. All three N-way clusters are fights over a distributive parameter
stated as a literal in the text: 586/1992 §35c(1) child tax credit ("15 204 Kč"), 117/1995 §30(1)
parental-allowance cap ("350 000 Kč"), 243/2000 §3 municipal revenue formula. Multiple actors
independently propose competing numbers for the SAME literal string. → a § containing a bare
monetary amount or an allocation coefficient is a high-prior collision locus; that is a cheap
deterministic pre-rank for a candidate universe too large to close-read exhaustively.

### A validation that only measures precision leaves recall unknown — and recall is where silent loss lives
batch-003's amends-census fix was validated against two known-good bills (tisk 111→7, 207→8,
exact match) — a precision check on an over-counting bug. Its RECALL was never measured. batch-004
data gives it: 9 of 140 bills (6.4%) have at least one title-derived statute the per-Čl.
first-citation extraction misses, and all 9 of those statutes have law nodes. → whenever a
deterministic extractor is fixed for over-counting, measure the under-counting side in the same
pass; the cheap ground truth is usually the OTHER extraction method already in the pipeline.
```

### → `feature-opportunities.md`

```
### The law graph resolves only ~35% of the statutes these bills actually amend — a bounded, deterministic ingest closes it
batch-004's regen shows 571 real amendment citations across PSP10, of which 289 (50.6%) point at
one of 188 statutes with NO law node (101 nodes exist). The gap is directionally biased: the 101
existing nodes come from bill TITLES, so the missing 188 are disproportionately body-only
citations — the government-omnibus tail that batch-003 proved undercounts 2.3× worse. Statutes
currently invisible include 424/1991 (financing of political parties, cited by 4 bills),
21/1992 (banks), 256/2000 (SZIF), 365/2000 (public-administration information systems),
49/1997 (civil aviation). e-Sbírka SPARQL already resolves statute → title → ELI at negligible
bandwidth (esbirka-sparql-diff.ts, three batches running), and the kernel grants autonomous
ingest for open sources — so this is one deterministic script, no LLM in the loop. It unblocks a
genuinely new product surface ("which statutes does this parliament quietly rewrite most?") that
cannot be honest while half the citation base is unresolvable.

### /zakony/kolize shipped — 18 (statute, §) clusters, 4 N-way, 26 rendered pairs with verbatim excerpts
The collision-cluster view proposed in batch-003's handoff is live (a44fe5f): grouping by
(statute, §) rather than bill-pair, confirmed vs coordination-risk tone tokens, SourceNote per
pair, framed as drafting-coordination findings rather than wrongdoing. 24 of 26 rendered pairs
carry grep-verified verbatim excerpts with file+line provenance; the 2 batch-001/002 pairs
predate the machine payload shape and are honestly labelled as narrated with no invented quotes.
Next increments: backfill those 2 excerpts (2 greps against the existing cache), and link each
cluster to the §-diff artifact where one exists (§35c and §60 already have real diffs, so the
reader could see the enacted text the colliding bills are fighting over).
```

### → `frontier.md` (Case ③ section)

```
- The collision backlog is closed only against the 150-edge topology. Applying Q-law-8's regen
  takes bill-pairs sharing a statute 88→436 and ≥3-bill statutes 10→42; at the observed
  §-matching and partition-survival rates that is ~170 pairs to re-screen, and the confirmed rate
  among partition-survivors is 50%. Brute-force close-reading is no longer affordable — needs a
  deterministic pre-rank (both bills issue an amending instruction on the same §; the § text
  contains a monetary literal or an allocation coefficient; explicitly NOT shared-§ count, which
  batch-004 showed is not predictive).
- Applying the regen also invalidates the triage ranking itself (churn is PRIMARY in
  batch002TriagePolicy; 40/2009 overtakes 586/1992 at #1, three new statutes enter the top 10,
  three leave). Every row's maxTargetChurn and triageScoreV2 is stale — re-triage is a
  PRECONDITION for army-9, not a refinement.
- Sector-adjacency is computed against the amended STATUTE, which is too coarse: 586/1992 is
  adjacent to every commercial sector, but §35c (child tax credit) is adjacent to none. Both
  sector-flagged bills in the confirmed-collision set (120, 121) are adjacency-by-tautology cases.
  With §-level targets now available from collision close-reads and §-diffs, adjacency should be
  evaluated at §-level for those bills. Corollary warning: recomputing adjacency NAIVELY over the
  regenerated edge set will re-degenerate it (tisk 64 goes from 1 to 35 amended statutes) — the
  exact P32 failure mode, one level up.
- Q-law-11: the regen's census_full trigger is count-based (undercount > 0), so 3 bills whose
  title and body citation sets are COMPLETELY DISJOINT (tisk 219: 301/1992 vs 354/2019; 222:
  134/2016 vs 9/2002; 243: 223/2016 vs 240/2000) never enter the proposal. Zero edge impact TODAY
  only because 354/2019, 9/2002 and 240/2000 have no law nodes — i.e. its harmlessness is
  contingent on the missing-law-node gap staying open. Land the set-difference trigger BEFORE or
  WITH the 188-node ingest, never after.
- The per-Čl. first-citation extraction (P48) has an unmeasured recall side: 9 of 140 bills
  (6.4%) miss a title-derived statute that DOES have a law node (tisky 88, 219, 222, 243, 36, 42,
  107, 124, 153). Hypothesis worth one cheap test: the rule fails on Čl. blocks whose first
  citation is not the target — most plausibly repeal articles ("zrušuje se zákon č. X Sb.") and
  articles opening with a cross-referenced statute.
- The citation-scope WARNING re-tagging (10/26 verdicts) has now rolled through three
  build-reviews. Per the kernel's Authority section, deferred-three-batches is a decision point:
  batch-005 must commit it to a human review pass or retire it.
```

### → `graph-log.md`

```
## Pass N (track: law) — Case ③ batch-004: amends topology regen prepared (NOT yet applied), collision backlog closed, kolize tisků shipped (2026-07-24)
No graph writes this batch. Prepared (awaiting orchestrator apply under the write lock):
amends edge regeneration 150 → 282 edges (+132 added, 0 dropped after the Opus audit's
union-vs-replace fix; validate-amends-regen.ts PASS, 282 edges, 0 errors). 53 bills switch to
census-body-derived targets unioned with their title-derived prop, 85 keep title fallback, 3 have
neither (tisky 87/101/114, logged). Applying it re-ranks churn (40/2009 6→12 takes #1 from
586/1992; new top-10 entrants 134/2016, 2/1969, 89/2012; dropouts 1/1993, 128/2000, 491/2001) and
therefore INVALIDATES the current triageScoreV2 ordering — re-triage before the next army.
Structural finding recorded with the payload: 289 of 571 real amendment citations (50.6%) point
at one of 188 statutes with no law node; the graph's law layer covers ~35% of the legislative
surface these bills touch. Also: collision candidate topology grows 29→75 statutes with ≥2
amending bills and 88→436 bill-pairs sharing a statute once applied. Analysis-side (no graph
change): 24 collision close-reads (13 confirmed / 6 coordination-risk / 5 incidental), 4-batch
totals 17 confirmed / 9 coordination-risk / 12 incidental over 38 close-reads, all 72 original
candidate pairs accounted for; 1 new e-Sbírka §-diff (§88/40-2009, 23 hunks). Forensic coverage
unchanged at 27/141 (19.1%), 0 new verdicts this batch.
```

---

## 9. What this reflection would have missed at Sonnet depth (calibration note)

Recorded so the tiering policy stays evidence-based rather than assumed:

- The money×collision cross-reference (§2) required joining two payload families to `ledger.json`
  and knowing that `sectorAdjacency` exists as a per-row field — a summary-level pass reads the
  collision summary, sees "no money channel" in batch-003's handoff, and repeats it.
- The regen-vs-backlog interaction (§6) requires holding two workstreams' numbers at once; each
  artifact is internally correct.
- The Defect-2 sequencing inversion (§3) requires noticing that its harmlessness depends on the
  gap that §4 recommends closing.
- The shared-§-count anti-correlation (§1.2) and the §35ba→`35b` key truncation (§5) both needed
  re-derivation from raw data and source, not from narrative.

Four batches, four Opus passes, four real catches. The pattern holds.
