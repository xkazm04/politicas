# Case ③ Law loop — fleet handoff (batch-003, 2026-07-24)

Fleet run, concurrent with money and effort loops in the same repo (confirmed live via `git
status` — case-effort/case-money files modified outside this session). **No live `.pglite`
writes, no commits, no shared-vault edits.** Everything below is for the orchestrator to
serialize. Analysis ran read-only on `.pglite-copy-law` (delete after: `rm -rf
.pglite-copy-law`). Full narrative: `docs/data-analysis/case-law/batch-003.md` (read that first —
this file is the orchestrator action list). Batch-002's handoff is superseded by this file;
`batch-002.md` narrative stays as history, unchanged.

## 1. What ran

- **Q-law-6** — `scripts/case-loops/law/amends-census.ts` (new): full-population (140/141, 1
  skip) real-vs-recorded amended-law citation census. Government-bill mean undercount 4.80 (n=55)
  vs MP-bill 2.10 (n=71) — confirms and quantifies the batch-001/002 lead at population scale.
  Found and fixed a real over-counting bug mid-run (boilerplate amendment-lineage citations
  restating a target law's full history) — validated the fix against known batch-002 ground truth
  (tisk 111→7, tisk 207→8, exact match).
- **Q-law-5** — 12 collision-pair close-reads (2 grouped Sonnet agents' worth, driver-verified by
  direct grep). **3 confirmed-collision** (4↔120, 4↔244 — upgrading 120↔244 to a 3-way §35ba
  cluster; 210↔248 — new, independent §134l clash), **2 coordination-risk** (67↔167, 73↔193), **7
  incidental-overlap** — several explained by a genuine data-quality finding (tisk 248's 5-statute
  omnibus PDF causes spurious §-number matches across bundled statutes).
- **Q-law-7** — 4 new real e-Sbírka §-diffs via `esbirka-sparql-diff.ts` (unchanged tooling):
  §35c/586-1992, §199 & §283/40-2009, §60/427-2011. `paragraphDiffCount` 7→15 bills, verified live
  against `getLawData()`.
- **Army-8** — tisky 112, 132, 143, 210, 146, 28, 181, 24 (next-8 by `triageScoreV2`), all
  severity=low, 0 conflicts, gate 26/26 (18 carried + 8 new).
- **`gate-verdicts.ts` improvements**: (a) new citation-scope check (WARNING) — flags `graph_fact`
  citations against company nodes asserting ownership/status the node's props don't hold; found
  10/26 verdicts with the issue (8 pre-existing from batches 001/002, 2 new); (b) collapsed the
  stale `--wide`/canonical split to one scope matching `kg-forensics.ts`'s live write-time gate.
- **Opus top-signal trigger: NOT fired.** All 26 gated verdicts low severity; the 3 confirmed
  collisions are drafting-numbering conflicts with no sponsor-money channel in either bill of any
  pair, so none meets the armed bar (batch-003.md §7 has the full reasoning). Kept armed for
  batch-004.

## 2. Graph payloads to persist (validated)

**No new nodes/edges.** The 8 new verdicts are prop-merges onto existing bill nodes
(`forensic_*`, `review_state: pending_review`), same pattern as batches 001/002.

```bash
# from repo root, against LIVE .pglite (orchestrator holds the write lock)
# 1. re-verify the gate first (should print 26/26 pass; 10/26 scope WARNINGS expected —
#    review candidates, not hard failures):
npx tsx scripts/case-loops/law/gate-verdicts.ts
# 2. write each of the 8 NEW verdicts as pending_review forensic props:
for t in 112 132 143 210 146 28 181 24; do
  npx tsx scripts/data-analysis/kg-forensics.ts --write \
    --verdicts=docs/data-analysis/case-law/payloads/verdicts/verdict-$t.json --commit
done
```

Expected result: **8 more bills enriched, 0 conflicts detected (all `severity: low`)**.
`forensicCount` on `/zakony` goes 19 → 27. Re-verify with
`PGLITE_PATH=./.pglite npx tsx` against `getLawData` (forensicCount + paragraphDiffCount, should
read 27 and 15 respectively).

**The 4 new §-diff artifacts are NOT graph payloads** — static JSON under
`docs/data-analysis/case-law/payloads/diffs/{40-2009__2021-01-01_2026-01-01__199,
40-2009__2021-01-01_2026-01-01__283, 427-2011__2012-06-28_2026-01-01__60,
586-1992__2021-01-01_2024-01-01__35c}.json`, read directly by `getLawData.ts` — already live in
this working tree, no persist step needed.

**`amended_laws_full` additive proposal is NOT applied this batch** —
`payloads/amended-laws-full-proposal.json` holds the 53-bill proposal for the orchestrator's
review; do not write it without an explicit decision on whether/how to widen the `amends` edge
set (out of this batch's scope by the task brief).

## 3. Shared-file additions (append verbatim — could not edit these in fleet mode)

### → `graph-log.md`
```
## Pass N (track: law) — Case ③ batch-003 forensic verdicts + collision cluster + 4 more §-diffs (2026-07-24)
8 bill nodes enriched with pending_review forensic_* props (kg-forensics --write): tisky 112, 132,
143, 210, 146, 28, 181, 24 — next-8 triage head. All severity=low: 8/8, 0 self-dealing channels
(extends the non-partisan-symmetry finding to 27/141 gated bills, 19.1%, across four batches).
Gate 26/26 (18 carried + 8 new), 10/26 flagged with a new citation-scope WARNING (review
candidate, not a hard failure — 8 pre-existing, 2 new). No new nodes/edges. forensicCount 19→27.
Also shipped: 4 more real e-Sbírka §-diffs on /zakony (§35c/586-1992, §199 & §283/40-2009,
§60/427-2011) — paragraphDiffCount 7→15 bills. No graph change for diffs — static JSON read at
request time.
```

### → `patterns.md`
```
### Law: a pairwise drafting collision can actually be a 3-way (or wider) cluster
batch-001/002 tracked 120↔244 as a pairwise §35ba collision. batch-003's close-read of adjacent
candidates found tisk 4 ALSO restructures the exact same §35ba odst. 1 lettering while pending —
three bills, not two, each assuming a different current state of the same enumerated list and
rewriting it incompatibly. Confirmed by direct grep of each bill's novelization instructions (not
an LLM judgment call). → any collision-tracking should group candidates by (statute, §), not just
by pair, since a real drafting risk can span more than two simultaneously-pending bills; the
existing collision-report.json's pairwise structure undercounted this cluster's true shape.

### Law: full-population deterministic checks quantify what opportunistic sampling only suggests
batch-001/002's amends-undercount lead came from 3 opportunistically-found bills (tisk 4, 111,
207). batch-003's full 140-bill census confirms the SAME pattern at population scale (government
mean undercount 4.80 vs MP 2.10, ~2.3x) and finds a far larger outlier than any prior sample
surfaced (tisk 64: 148 real vs 1 recorded, a genuinely enormous accounting-harmonization omnibus).
→ once an opportunistic finding looks structural (recurs across 2+ independently-found cases), a
full-population deterministic check is worth budgeting before further batches keep relying on the
pattern by inference.

### Law: omnibus bills bundling multiple statutes in one PDF contaminate naive same-§-number collision checks
tisk 248 is a 5-statute omnibus whose "platné znění" PDF concatenates all five laws' text in one
document. A same-paragraph-number pre-check (collision-check.ts) spuriously flagged "collisions"
where matching § numbers actually belong to DIFFERENT statutes bundled in the one PDF (e.g. §30,
§93, §96 matching provisions of 117/1995 or 262/2006, not the statute under comparison). Explains
3/4 of tisk 248's flagged candidate pairs turning out incidental. → a future collision-check
refinement should partition an omnibus bill's §-set by which statute each § actually belongs to
(using Čl. N article boundaries, the same convention Q-law-6's amends-census extraction uses)
before pairwise-matching § numbers across bills.
```

### → `contradictions.md`
```
(none new this batch — no findings contradicted prior-batch conclusions; the 3 confirmed
collisions and the amends-undercount quantification both EXTEND prior findings rather than
conflict with them.)
```

### → `feature-opportunities.md`
```
### /zakony now renders 15 real §-diffs across 5 statute/§ targets (extends batch-002's flagship)
paragraphDiffCount 7→15 bills after batch-003's 4 new SPARQL-sourced diffs (§35c/586-1992,
§199 & §283/40-2009, §60/427-2011), no new infrastructure — confirms batch-002's "one command
each" claim. A bill-detail page (still on the seed backlog, law-loop.md item 2) would let a reader
land directly on the diff for a specific bill rather than browsing the /zakony list.

### Collision-cluster view — the 4↔120↔244 three-way finding argues for a graph-native representation
batch-003 found a real 3-way (not pairwise) drafting collision by manual cross-referencing across
3 close-read pairs. A dedicated "collision cluster" view (grouping by statute+§, not by bill pair)
would surface this class of finding directly instead of requiring a driver to notice 3 confirmed
pairs share 2 bills. Worth scoping as a build-review item once more clusters are found (currently
1 confirmed 3-way cluster + 1 new pairwise 210↔248).
```

### → `frontier.md` (Case ③ section)
```
- 58 of the original 70 unconfirmed collision-report.json pairs remain untouched after batch-003's
  12. Given a 25% confirmed-collision hit rate this batch (3/12, higher than the "mostly
  incidental" baseline expectation), a dedicated close-reading batch on the remainder looks
  higher-value than its position in the general triage queue suggests.
- The citation-scope WARNING (gate-verdicts.ts, new this batch) flags 10/26 verdicts (8
  pre-existing from batches 001/002: tisky 11, 119, 121, 124, 173, 198, 216, 244; 2 new: 28) whose
  graph_fact citations assert company ownership/status substance the graph doesn't hold. These are
  NOT re-tagged or edited (batch-003 deliberately preserved the audit trail, matching batch-002's
  non-edit discipline on the same class of issue found on verdict-11). A human/orchestrator review
  pass to re-tag these citations as kind:"web" with proper URLs is now an open item across 3
  batches' worth of verdicts.
- Is the amends-undercount pattern's ~2.3x government/MP ratio stable if the 1 skipped bill (tisk
  87) is eventually recovered from a different source (its PDF wasn't found in the standard
  index)? Low priority (n=1) but worth closing for a complete population.
- Could the omnibus-bill §-set partitioning (needed to fix the tisk-248-class false positive in
  collision-check.ts) reuse the SAME Čl. N article-boundary parsing Q-law-6's amends-census built
  for the boilerplate-citation fix? If so, both would share one parser module.
```

## 4. Enum / schema proposals

None new this batch. The `amended_laws_full` additive-prop proposal (§2) is NOT a schema change
request — it's a data payload awaiting an orchestrator decision on whether to apply it, using the
EXISTING bill-node prop pattern (no new prop name needs registering; `amended_laws_full` would
sit alongside the existing `amended_laws` array as an array-of-string prop, same type).

## 5. Commit plan (orchestrator; per-case commit inside law boundary)

Files (all within law boundary):
- `docs/data-analysis/case-law/**` (ledger.json, batch-003.md, handoff.md, payloads/**)
- `scripts/case-loops/law/amends-census.ts` (new), `scripts/case-loops/law/gate-verdicts.ts`
  (citation-scope check + --wide/canonical collapse — modified, confirmed in `git status`)
- `features/lawwatch/**` — unchanged this batch (diffs render via the existing generic loader; no
  code edit needed)

Suggested message (Conventional):
```
feat(case-law): batch-003 amends census + collision cluster + 4 more diffs + army-8

Law loop batch-003 — full-population amends-undercount census (140/141 bills, government 2.3x MP
undercount confirmed at scale), 12-pair collision close-read (3 confirmed incl. a new 4-120-244
three-way §35ba cluster and 210-248's independent §134l clash, 2 coordination-risk, 7 incidental),
4 new real e-Sbirka paragraph diffs (paragraphDiffCount 7->15), army of 8 gated Sonnet-only
verdicts (26/26 gate pass, all severity=low, extends non-partisan-symmetry to 27/141 bills), and
two gate-verdicts.ts improvements (citation-scope WARNING check, --wide/canonical collapse).
Verdicts land pending_review via kg-forensics --write (separate persist step, orchestrator-
serialized). npm run check green within law's own boundary (tsc/eslint/vitest scoped to
scripts/case-loops/law, features/lawwatch, app/zakony); full-repo npm run check currently blocked
by unrelated concurrent effort-loop lint errors outside law's boundary.
```
NB: the `kg-forensics --write --commit` calls in §2 are a **separate live-graph step** the
orchestrator runs under the write lock, not part of this working-tree commit.

## 6. Lessons learned (skill/kernel calibration)

1. **Full-population checks are worth their cost once a lead recurs across 2+ independently-found
   cases.** batch-003's 140-bill census turned a 3-bill opportunistic pattern into a quantified,
   population-level finding (4.80 vs 2.10 mean undercount) and found a much larger outlier (tisk
   64: 148 vs 1) than any sample would likely have surfaced. → don't wait for K=3 convergence
   batches to trigger a full-population check on a structural-looking lead; budget it as soon as
   2 independent occurrences appear.
2. **A "collision" can be N-way, not just pairwise — the tracking structure should reflect that.**
   The 4↔120↔244 cluster was only visible by cross-referencing 3 separate pairwise close-reads;
   `collision-report.json`'s pairwise grouping structurally can't represent a 3-way cluster
   directly. Group by (statute, §) going forward, not by bill-pair.
3. **Omnibus bills contaminate their OWN deterministic pre-checks, a distinct failure mode from
   the citation-undercount problem.** tisk 248's 5-statute-bundled PDF caused false-positive
   §-number matches against unrelated statutes. Both this and Q-law-6's boilerplate-citation
   over-count bug stem from the same root cause (Czech legislative drafting conventions that a
   naive regex/pattern doesn't account for) — worth a standing checklist item: any new
   text-extraction script over this corpus should explicitly consider omnibus-bill structure
   before trusting its first-pass output.
4. **Deterministic grep beats a second LLM read for presence/absence claims — reserve the model
   for substantive judgment.** Both confirmed collisions this batch were driver-verified by direct
   grep against cached text, faster and more certain than a second Sonnet close-read would have
   been. The close-read agents are better spent judging whether an overlap SUBSTANTIVELY interacts
   (irreducibly a judgment call) than confirming a string's presence (not one).
5. **Cache-location context needs to be explicit in army/close-read briefs, not assumed.** Both
   army groups initially reported extraction failures despite the target text already sitting on
   disk from an earlier batch's fetch. One extra round-trip per group this batch; batch-004's
   briefs should name the cache path up front.
6. **The Opus trigger held under real pressure this batch, not just an easy default.** 3 confirmed
   collisions (a 25% hit rate on the sample, well above the "mostly incidental" baseline) created
   a genuine temptation to escalate, but none touched sponsor money — the trigger's bar (a real
   self-dealing/conflict channel, not "a notable finding exists") correctly held. Four batches in,
   this is the trigger's third evaluation against real candidate material (tisk 11, 111↔207,
   this batch's collisions), always correctly not-fired — worth citing as evidence the tiering
   policy isn't merely defaulting to "don't spend Opus."
7. **Fleet discipline held under confirmed real concurrency** (not hypothetical this batch — `git
   status` shows simultaneous, uncommitted money and effort loop changes in the same working
   tree). No shared-vault edits, no `.pglite` live writes, no commits, boundary respected
   throughout (only `docs/data-analysis/case-law/**`, `scripts/case-loops/law/**` touched — the
   `gate-verdicts.ts` change is within the law-owned scripts directory).
8. **`npm run check` at repo root is not a reliable law-boundary signal under real fleet
   concurrency.** Full-repo check failed on unrelated effort-loop lint errors this batch (outside
   law's boundary, out of law's control). Scoped checks (`tsc --noEmit` full-repo, `eslint`
   restricted to law's own paths, full `vitest run`) are the correct verification under fleet mode
   — batch-004+ should default to scoped checks and only insist on a clean full-repo `npm run
   check` at the orchestrator's final merge step, not per-case.
