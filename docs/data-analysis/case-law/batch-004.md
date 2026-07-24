# Case ③ Law loop — batch-004 (2026-07-24)

Fleet run, concurrent with money and effort loops in the same working tree (confirmed via `git
status` — untracked/modified files outside this session's boundary throughout the run). No live
`.pglite` writes, no commits from analysis subagents, no shared-vault edits during analysis; the
single build-review commit (`a44fe5f`) is the one write this batch made, per Authority ("build
phases... commit to master autonomously"). Full detail in `batch-004-reflection.md` (Opus, read
that for the load-bearing findings); this file is the narrative summary. Orchestrator action list:
`handoff.md`.

## 1. What ran

Four workstreams, dispatched as parallel Sonnet subagents, plus two reserved Opus passes.

- **Q-law-8 — amends edge regeneration (prepared, NOT applied).** `scripts/case-loops/law/
  amends-regen.ts` (new) built the complete regenerated `amends` edge set from the batch-003
  census (`amended_laws_full`, 53 bills) unioned with the existing title-derived `amended_laws`
  (85 bills fall back wholesale, 3 have neither: tisky 87/101/114). Edge count: **150 → 282**.
  Missing-law-node census: **188 distinct statutes / 289 citations (50.6% of 571 real citations)**
  point at a statute with no `law` node in the graph — the batch's most important open finding per
  the reflection (§4), promoted to a P1 frontier item. Churn re-ranking: **40/2009 (trestní
  zákoník) overtakes 586/1992 as #1** most-amended statute; three new top-10 entrants (134/2016,
  2/1969, 89/2012), three dropouts (1/1993, 128/2000, 491/2001). Collision candidate universe
  grows 29→75 statutes with ≥2 amending bills, 88→436 bill-pairs sharing a statute.
  `scripts/case-loops/law/validate-amends-regen.ts` (new) checks id-membership, duplicates, and
  no-fabrication.
- **Opus audit #1 (regen payload).** CONDITIONAL PASS. Found one blocking defect: the original
  regen *replaced* rather than *unioned* recorded citations for census bills, silently dropping
  a live edge (tisk 88 → 360/2025, leaving that law node with zero `amends` edges). Fixed same
  batch (union with per-ref `source: census_full | title_fallback` provenance); re-validated
  **PASS, 282/282, 0 errors**. Also flagged (non-blocking) 3 bills with title/body citation sets
  that disagree completely (tisky 219, 222, 243) — logged as an explicit caveat in the payload,
  not silently fixed; the underlying trigger (count-based `undercount > 0`) still needs a
  set-difference rewrite (Q-law-11, next batch).
- **Q-law-10 — collision-check.ts partition fix.** Added a `--v2` mode: partitions each bill's
  §-set by which statute it targets (using `Čl. N` article-boundary structure in the actual
  amending-instruction document, not the multi-statute "platné znění" dump that caused the
  tisk-248 contamination) before pairwise-matching §-numbers. Re-run over all 71 bills in the 29
  collision groups: **72 candidate pairs → 34 survive partitioning, 38 die as artifacts (53% of
  the original candidate list)**. Original `collision-report.json` untouched;
  `collision-report-v2.json` holds the corrected set with per-pair survival/death reasons.
- **Q-law-9 — close-read all 24 newly-surviving pairs.** 5 grouped Sonnet agents, driver-verified
  by direct grep of cached novelization text (P49) before trusting any classification. Result:
  **13 confirmed / 6 coordination-risk / 5 incidental** — a 54% confirm rate (vs batch-003's
  raw 25%, adjusted 37.5% once the 4 pairs later killed by partitioning are excluded). Two new
  **N-way collision clusters**: 117/1995 §30(1) (the parental-allowance cap, "350 000 Kč") across
  tisky 112/121/198, and 243/2000 §3 (municipal revenue formula) across tisky 28/140/141. The
  existing 586/1992 complex extends to a 4-bill span (§35c(1): tisky 4/120/121/244). **4-batch
  running total: 17 confirmed / 9 coordination-risk / 12 incidental across all 38 pairs read; all
  72 original candidate pairs from `collision-report.json` are now accounted for** — backlog
  closed against the 150-edge topology it was computed on (see reflection §6 for the important
  caveat: it reopens ~5× once the regen is applied).
- **More SPARQL diffs.** `esbirka-sparql-diff.ts` (unchanged tooling, 3rd batch running): **1 new
  real diff — §88/40-2009 (trestní zákoník), 2021→2026, 23 hunks** — confirmed as a genuine
  contested paragraph (batch-002 already corroborated a coordination-risk between tisk 111/207 on
  it). Two other targets honestly yielded nothing rather than being fabricated: a §35ba alternate
  date range produced content byte-identical to the existing artifact (deleted as redundant — no
  information gain, confirms no enacted change 2024→2026); §134l/256-2004 returned "no fragments
  found" at every date tried, because both tisk 210 and 248 propose *inserting* a brand-new
  section that has never been enacted — e-Sbírka only holds enacted text (the "historical"
  pipeline); a real diff for a pending insertion needs the not-yet-built "prospective" pipeline
  (tisk-PDF novelization parsing), a known gap from the law-loop skill doc. `paragraphDiffCount`
  stayed at 15 (§88 belongs to an already-diffed law).
- **Build-review (R=1, batch-003 shipped): "kolize tisků" surface, SHIPPED.** `/zakony/kolize`
  (commit `a44fe5f`) groups all confirmed + coordination-risk findings by (statute, §) rather than
  by bill-pair — the representation batch-003's own handoff recommended once N-way clusters
  appeared. 18 clusters, 4 spanning ≥3 bills. `features/lawwatch/getCollisionData.ts` (server
  loader, found and fixed a real bug mid-build: payload bill numbers are the public tisk `cislo`,
  not the `bill:tisk:<id>` node-id suffix) + `CollisionsPage.tsx` (confirmed=signal token,
  coordination-risk=ochre token, SourceNote per pair, framed explicitly as drafting-coordination
  findings, never as wrongdoing verdicts) + `app/zakony/kolize/page.tsx`. `npm run check` green:
  194/194 tests, 0 lint errors. All 29 payload-sourced pairs carry verbatim grep-verified
  excerpts with file+line; the 2 narrated batch-001/002 pairs (120↔244, 111↔207) are honestly
  rendered without invented quotes, a distinct SourceNote, and a degraded UI label.
- **Opus reflection #2 (batch-004-reflection.md).** Genuine critical synthesis, not a recap — full
  detail in that file. Three load-bearing findings: (1) batch-003's "no sponsor-money channel in
  any confirmed collision" claim was **factually wrong** (tisky 120 and 121 both carry
  `sector_adjacent_conflict` AND are in the confirmed-collision set, colliding with each other on
  §35c(1)) — the trigger's not-fire verdict still holds, but on corrected grounds (the collision
  loci are universal-benefit parameters not appropriable by the flagged companies, and both
  adjacency flags are the known-degenerate sector-bucket-tautology class); (2) "backlog CLOSED" is
  topology-scoped, not headline-true — the same batch's regen invalidates the 150-edge topology
  the v2 pre-check ran against, reopening the candidate universe at ~5×; (3) the amends-regen
  union bug is a class, not a one-off (title-derived and body-derived citation sets should always
  be unioned with provenance, never treated as exclusive alternatives), with an unmeasured 6.4%
  recall gap whose current harmlessness is contingent on the missing-law-node gap staying open —
  a real sequencing constraint for batch-005.

## 2. Forensic coverage

**Unchanged at 27/141 (19.1%), 0 new verdicts this batch** — a defensible allocation (the batch
prioritized infrastructure: regen prep, collision-backlog closure, and a build-review), but the
reflection flags two consecutive flat batches as a coverage-stall risk, and notes the current
triage head is now stale (churn re-ranking flips #1 to 40/2009) — re-triage is a precondition for
the next army, not an optional refinement.

## 3. Opus top-signal trigger

**NOT fired**, same as batches 001–003 — but for the first time on corrected, cross-checked
grounds rather than an unverified "no money channel" assertion (see reflection §2). Record: five
evaluations against real candidate material, correctly not-fired five times.

## 4. Batch-005 priorities (set by the reflection, §7)

1. Ingest the 188 missing law nodes (e-Sbírka SPARQL), sequenced with the Q-law-11 set-difference
   trigger fix landing first/simultaneously — never after node ingest, per the reflection's
   sequencing finding — then apply the regen with a new no-live-edge-dropped validator check.
2. Q-law-11: set-difference trigger + deletion-diff gate in the validator; measure amends-census
   recall (currently unmeasured, ~6.4% estimated false-negative rate).
3. Re-triage, then re-screen the reopened collision backlog (~436 candidate pairs) with a
   deterministic pre-rank (same-§ amending instruction + § text contains a monetary literal or
   allocation coefficient) — NOT shared-§ count, which this batch showed is not predictive.
4. §-level sector-adjacency + a `collision-money-crosscheck.ts` script (turns the trigger decision
   into evidence, not prose).
5. Resume the army (army-9, 8 units) off the re-triaged head.
6. Cleanups: `primaryParagraph()` regex truncation (`35ba`→`35b` key collision risk), normalize
   `incidental`/`incidental-overlap` label drift, backfill the 2 narrated pairs' excerpts.
7. **Decision point, not deferrable again**: the citation-scope WARNING re-tagging (10/26
   verdicts) has now rolled through three build-reviews — commit to a human review pass or retire
   per the kernel's Authority section.
