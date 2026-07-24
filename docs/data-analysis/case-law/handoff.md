# Case ③ Law loop — fleet handoff (batch-004, 2026-07-24)

Fleet run, concurrent with money and effort loops in the same repo. **No live `.pglite` writes
during analysis, no shared-vault edits, no commits from analysis subagents.** One build-review
commit landed (`a44fe5f`, per Authority — build phases commit autonomously; not pushed). Full
narrative: `docs/data-analysis/case-law/batch-004.md`; the load-bearing critical findings are in
`docs/data-analysis/case-law/batch-004-reflection.md` (Opus, maximum depth — read that before
acting on anything below, it corrects one prior-batch claim and qualifies another). This file
supersedes batch-003's handoff as the orchestrator action list; `batch-003.md`/prior `handoff.md`
content stay as history (batch-003.md unchanged; this file replaces the old handoff.md).

## 1. What ran (see batch-004.md for full detail)

Q-law-8 (amends regen, prepared not applied) + Opus audit (found+fixed a union-vs-replace bug) +
Q-law-10 (collision-check.ts partition fix) + Q-law-9 (24 new close-reads, backlog closed against
the pre-regen topology) + 1 new real §-diff (§88/40-2009) + build-review ("kolize tisků" shipped,
commit `a44fe5f`) + Opus reflection (2 corrections to prior-batch framing, both now in
`contradictions.md`'s proposed text below).

## 2. Graph payloads to persist (validated, NOT yet applied — orchestrator decision required)

**This is a topology change (edge count, not a props-merge), same status as batch-003 left it —
still awaiting an explicit orchestrator decision on whether/how to apply.** The regen is now
corrected (union fix) and validated:

```bash
# from repo root, against LIVE .pglite (orchestrator holds the write lock)
# 1. re-verify the validator first (should print PASS, 282/282, 0 errors):
PGLITE_PATH=./.pglite npx tsx scripts/case-loops/law/validate-amends-regen.ts \
  --payload=docs/data-analysis/case-law/payloads/batch-004-amends-regen.json
# 2. IF the orchestrator decides to apply: this ADDS edges only (0 deletions after the union fix)
#    — but per the reflection (§3/patterns.md), any edge-set regeneration should diff against the
#    LIVE set and require an explicit allowlist for every deletion before writing. No apply
#    script has been written this batch (deliberately — Q-law-11's set-difference trigger and the
#    missing-law-node ingest should land first or with it, per the reflection's sequencing
#    finding, not after).
```

**Read this before deciding to apply:** the reflection's §6 finding — applying the regen
immediately reopens the "CLOSED" collision backlog at ~5× candidate volume (bill-pairs sharing a
statute 88→436) and invalidates the current `triageScoreV2` ordering (churn re-ranks 40/2009 to
#1). Applying it is not a low-risk purely-additive move from a triage-consistency standpoint, even
though the edge-level diff itself is clean.

**Missing-law-node census (188 statutes / 289 citations, 50.6% of real citations) is NOT a graph
change this batch** — `payloads/batch-004-amends-regen.json`'s missing-law-node section holds the
full list (statute, citing-bill-count, sample bills) as a proposed follow-up ingest item. The
reflection recommends this become batch-005's P1: e-Sbírka SPARQL already resolves statute→ELI at
negligible cost (proven 3 batches running via `esbirka-sparql-diff.ts`), and it's inside the
kernel's autonomous-ingest authority for open sources — no orchestrator gate needed to start it,
only sequencing awareness (land Q-law-11's trigger fix first/with it, not after, per §3 below).

**The 24 collision close-reads are NOT graph payloads** — they're forensic-adjacent findings
already rendered on `/zakony/kolize` via static payload JSON (`collision-close-reads-batch004.json`
+ `collision-report-v2.json`), no `.pglite` write needed, no persist step required. The confirmed
classifications are NOT gated `forensic_*` verdicts (that gate is per-bill, not per-collision-pair)
— they're a distinct finding class rendered directly from validated payloads.

**The new §-diff artifact is NOT a graph payload** — static JSON at
`docs/data-analysis/case-law/payloads/diffs/40-2009__2021-01-01_2026-01-01__88.json`, already live
in this working tree via the file-based loader, no persist step needed.

**Zero new `forensic_*` verdicts this batch** — forensic coverage unchanged, 27/141 (19.1%), no
persist action needed for that surface.

## 3. Shared-file additions (append verbatim — could not edit these in fleet mode)

All five blocks below are copied from `batch-004-reflection.md` §8 (the Opus reflection), which
did the actual synthesis work. That file also has the reasoning behind each claim if the
orchestrator wants to verify before appending.

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

## 4. Enum / schema proposals

None new. `amended_laws_full`'s array-of-string prop pattern (proposed batch-003, still not
applied) is unchanged; the regen payload's per-ref `source: census_full | title_fallback` tag is
new metadata WITHIN that same proposal, not a new prop/enum registration.

## 5. Commit plan (orchestrator; per-case commit inside law boundary)

**One commit already landed autonomously this batch** (build-review, per Authority): `a44fe5f`
— `feat(zakony): ship kolize tisků — drafting-collision surface for Case ③`. Not pushed.

**Remaining uncommitted work** (all within law boundary, orchestrator's call on batching):
- `docs/data-analysis/case-law/**` (ledger.json updated, batch-004.md new, batch-004-reflection.md
  new, handoff.md this file, payloads/** — regen payload + audit + collision v2/close-reads +
  new §-diff)
- `scripts/case-loops/law/amends-regen.ts` (new), `validate-amends-regen.ts` (new),
  `collision-check.ts` (modified — `--v2` partition mode)

Suggested message (Conventional), for whatever the orchestrator doesn't fold into the existing
`a44fe5f`:
```
feat(case-law): batch-004 amends regen prep + collision backlog closure + §88 diff

Law loop batch-004 — prepared (not applied) amends edge regeneration (150->282, Opus-audited and
union-bug-fixed, 188 missing law nodes census'd), collision-check.ts partition fix (72 candidate
pairs -> 34 survive omnibus-contamination correction), 24 newly close-read pairs (13 confirmed / 6
coordination-risk / 5 incidental, closing the 72-pair backlog against the pre-regen topology),
1 new real e-Sbirka diff (§88/40-2009). Opus reflection corrects a batch-003 factual claim
(2 confirmed-collision bills DO carry sponsor-money flags; trigger verdict stands on stronger
grounds) and flags that the backlog reopens ~5x once the regen is applied. npm run check green
(the kolize-tisku build-review, commit a44fe5f, already landed this data on /zakony/kolize).
```
NB: the amends-regen apply step (topology change to the live graph) is intentionally NOT part of
any commit plan here — it needs an explicit orchestrator decision, sequenced with Q-law-11's
trigger fix and the missing-law-node ingest per §2/§3 above, not a default "apply it" action.

## 6. Lessons learned (skill/kernel calibration — see batch-004-reflection.md §9 for the full version)

1. **A ranking signal used to decide "what gets read next" inside a backlog sweep needs the same
   discriminative-power validation (P32) as a top-level triage score.** Shared-§ count actively
   selected AGAINST real collisions pre-partition (it correlated with omnibus contamination).
2. **An edge-set regeneration is a write path.** It needs a diff-against-live + deletion-allowlist
   gate, the same discipline the kernel already requires for props-merge writes (P44/D1), just at
   the topology level. `validate-amends-regen.ts` currently cannot see a deletion — general lesson
   for money/effort's analogous regeneration work too, not just law.
3. **A precision fix does not imply a recall fix.** batch-003's amends-census correction was
   validated only on known over-counting cases; its under-counting rate (6.4%) was never measured
   until this batch's reflection derived it from data already on disk.
4. **Two workstreams' outputs can silently contradict each other's framing even when both are
   individually correct** — "backlog CLOSED" and "edge topology regenerated 5×" are both true
   statements that, read together, mean the backlog isn't actually closed. This is specifically
   why the kernel reserves an Opus reflection pass every batch, not just an audit of the riskiest
   single artifact — the batch-004 reflection's highest-value catch was a CROSS-artifact
   inconsistency neither individual artifact's author could have seen.
5. **A driver's prose assertion about a cross-cutting property (e.g. "no money channel in any
   collision") is a claim that decays the moment a LATER batch adds data to either side of it.**
   Cross-workstream claims like this should be scripts joined to the ledger, not paragraphs —
   otherwise every future batch either re-derives it from scratch or repeats it unchecked.
6. **Fleet discipline held under continued real concurrency** — 7 subagents total this batch (3
   analysis, 1 Opus audit, 1 fix, 1 build-review, 1 Opus reflection), no shared-vault edits, no
   live `.pglite` writes outside the DB-copy pattern, boundary respected throughout
   (`docs/data-analysis/case-law/**`, `scripts/case-loops/law/**`, and the build-review's
   `app/zakony/**` + `features/lawwatch/**`, per its explicit build-phase authority).
