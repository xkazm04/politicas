# Case ③ Law loop — fleet handoff (batch-006, 2026-07-25)

Fleet run, concurrent with money/effort/kiosek-dataor loops in the same repo. **No live `.pglite`
writes during analysis, no shared-vault edits, no commits.** Full narrative: `batch-006.md` (read
that first — this file is the orchestrator action list plus the verbatim audit report). This
supersedes batch-005's `handoff.md` as the action list; `batch-005.md`/batch-005's `handoff.md`
stay as history.

## 0. The independent audit — verbatim (P1a)

Dispatched to a background Opus subagent (maximum reasoning depth), instructed to check the
CURRENT post-remediation state fresh against all 11 original defects plus an open search for new
issues, and to cite file+line or payload-field evidence for every finding rather than trust the
driver's remediation prose. Full report, unedited:

<details>
<summary>Independent re-audit — batch-005 payloads (post-remediation), full text</summary>

Read-only. No files modified, no live `.pglite` opened. All findings are from static analysis of
the payloads, the scripts, and the cached bill text under `.data/law-collision-cache/`.

### Part 1 — Verdicts on D1–D11

**D1 (high, precision never measured) — PARTIALLY FIXED, and the residual is worse than the
caveat states.** The three hand-proven cases verified fixed at the data level (tisk 219 → correctly
301/1992, tisk 243 → no body citation, title fallback covers it; tisk 222 → improves to 176/2008,
still wrong but caught by the D8 act-type gate). The caveat text is honest about the un-remeasured
6.3%. But the auditor ran the proxy anyway (all 567 edges, citation ±2500 chars vs `se
mění|se ruší|se vkládá|se nahrazuje|zní:`): 549 clean / 16 no-verb / 2 citation-absent = 3.2%
flagged, hand-classified all 18. The proxy is weak in both directions — false-alarms on
title-confirmed real amendments buried behind boilerplate amendment-history lineage text, and
misses real false positives where transitional provisions contain amending verbs. See N1/N2 — the
actual false-positive population is a different, structural class the proxy cannot see.

**D2 (high, `Sb. m. s.` treaty collision) — CONFIRMED FIXED.** The negative-lookahead regex in
`lib/ingest/sources/psp-legislation.ts:40` is correctly placed and does not affect plain `Sb.`
matches. Payload check: `law:sb:64-2017`/`55-2006`/`108-2004` appear as `to` on 0 edges.
Corpus-wide check found one remaining number-collision (tisk 46 / 104/2013) and it is a TRUE
positive (tisk 46's own title cites it), not a defect. Caveat: tisk 63's treaty edge was removed,
but the edge that replaced it is itself false — see N2.

**D3 (high, no apply path) — CONFIRMED NOT FIXED (correctly deferred).**
`scripts/case-loops/persist-batch.ts` (124 lines) still hard-refuses inserts on both node and edge
paths; neither payload's shape matches its schema.

**D4 (high, union-vs-replace / provenance overwrite) — PARTIALLY FIXED; the gap is real and open.**
`diff-amends-regen-deletions.ts:33,36` builds its key sets from `(src,dst)`/`(from,to)` only —
confirmed key-only, nothing reads `props`/`provenance`. The overwrite risk is real at the storage
layer: `lib/db/pglite/repositories/kg.ts:25`'s upsert does
`on conflict (src, rel, dst) do update set weight = excluded.weight, props = excluded.props,
provenance = excluded.provenance` — a blind upsert of the payload would wholesale-replace both
columns on the 150 pre-existing keys. No apply script for edges existed at audit time (D3), so
nothing yet preserves them. The "edges now carry an explicit pass field" claim is only half-true —
see N3.

**D5 (medium, invented firstSeenPass) — CONFIRMED FIXED.**
`_apply-missing-law-nodes-copy.ts:42-45` computes `max(graph)+1`, logged as explicitly
provisional. No literal remains.

**D6 (medium, no durability contract) — CONFIRMED NOT FIXED.**
`scripts/data-analysis/kg-legislation-ingest.ts:167` builds `law` node props from scratch (no
`...existing.props` spread), written via a wholesale-replacing upsert. **Scope is wider than the
handoff states**: line 168 also rebuilds `amends` edges with `props: {}` from title-derived refs
only — a re-run would additionally erase the `source` tag and batch-005 provenance from every
overlapping edge, not just the node props the handoff named. Contrast: `esbirka-laws.ts:82`
correctly does `props: { ...n.props, … }` — the fix pattern already exists elsewhere in the repo.

**D7 (medium, stale payload self-description) — PARTIALLY FIXED.** `method`/`boundary`/`caveats`
in `batch-005-amends-regen.json` are accurate against the post-remediation state, with two
exceptions: `method` says "191 law nodes" but the node payload ships 187 (not a data problem — the
edge set has no dangling targets — but the prose is wrong); and the impact sidecar
(`batch-005-amends-regen-impact.md`) was NOT fixed, contrary to the §3 remediation claim — line 1
still reads "batch-004, prepare only" and mislabels the 4 D8-excluded refs as a "missing law nodes
… proposed follow-up census."

**D8 (medium, non-act nodes as amends targets) — FIXED for this run; gate design is fail-open.**
Logic check confirms `isAmendableAct` (`amends-regen-005.ts:111-116,157-164`) reads
`esbirka_title` off the correct resolved target node, and the 5-prefix blacklist is correct on
both directions checked (Ústavní zákon correctly kept, Zákonné opatření Senátu correctly kept).
Full 567-edge scan: 284 distinct targets, 183 resolve into the new node payload and every one of
those 183 has an `esbirka_title` starting with "Zákon"; the remaining 101 targets are exactly
batch-004's pre-existing target set. Zero dangling/non-act targets. Residual design weakness → N6.

**D9 (low/medium, truncated titles) — CONFIRMED STILL OPEN, worse than reported.** 37 of 187 (not
28) `label` fields truncate mid-word at ~120 chars; `props.esbirka_title` is intact in every case
(display-only defect).

**D10 (low, naive PGLITE_PATH guard) — CONFIRMED FIXED.** Absolute-path comparison verified at
`_apply-missing-law-nodes-copy.ts:17-22`.

**D11 (sequencing) — CONFIRMED CORRECTLY STATED.** Nodes-before-edges, same write-lock window,
accurately documented in both `handoff.md` §2 and `batch-005.md` §6.3.

### Part 2 — New defects

**N1 (HIGH, new) — the census extractor is structurally blind to `ČÁST`/`§`-organized bills; "0
missing statutes / citation universe closed" is materially false.** `extractRealAmendedLaws`
(`amends-census.ts:169-206`) splits only on `Čl. N` article markers. 21 of 140 census bills have
zero `Čl.` markers and fall into the single-subject fallback (first non-footnote citation, ONE
edge, full stop). 7 of those 21 carry explicit `Změna zákona …` part headings and each produced
exactly one edge: tisk 250 (10 real amending parts → 1 edge), tisk 69 (7→1), tisk 10 (4→1), tisk 54
(4→1), tisk 113 (4→1), tisk 189 (4→1), tisk 228 (3→1). ≈29 true amending targets missing,
concentrated in exactly the government omnibus bills that matter most for churn ranking and
collision detection. This directly contradicts `stats.distinctMissingLawStatutes: 0` and the
graph-log's "closes essentially the full citation universe" framing.

**N2 (HIGH, new) — 6 confirmed false edges survive in the 567**, verified by reading the cached
text at the cited line for each: tisk 63→`law:sb:21-1992` (new Accounting Act; the citation is a
substantive cross-reference, `tisk-63/266144.txt:5126`); tisk 69→`law:sb:381-1991` (multi-line
footnote continuation `isFootnoteLine` inspects only the match's own line and missed,
`tisk-69/266214.txt:146-147`; the bill's real target appears to be 531/1990, not wired by any edge);
tisk 6→`law:sb:424-1991` (transitional provision about a predecessor institution, not an amendment,
`tisk-6/265061.txt:288` — the real 424/1991 amendment is in companion tisk 7); tisk 55→
`law:sb:194-2017`, tisk 76→`law:sb:234-2014`, tisk 144→`law:sb:326-1999` (all three: REPEAL clauses
misread as amendments — a relation the extractor cannot distinguish from `amends`,
`tisk-55/266009.txt:494`, `tisk-76/266517.txt:1607`, `tisk-144/268804.txt:14176`/28176).

**N3 (MEDIUM, new) — the "5-field kernel provenance contract" claim is false in both payloads.**
Edge provenance `{track, pass, method, ref}` is missing `computedAt` on all 567 edges
(`amends-regen-005.ts:176`). Node provenance `{track, method, ref, computedAt}` is missing `pass`
on all 187 nodes (only injected at apply time by the copy script). `validate-amends-regen-005.ts`
never inspects provenance shape at all, and the act-type gate is generator-only — the validator
would pass a non-act edge.

**N4 (MEDIUM, new) — `isFootnoteLine` is single-line and cuts both ways.** Confirmed under-skip on
multi-line footnote blocks (tisk 69, N2) — the driver observed this class on tisk 222 and
documented it as "still-imperfect" but did not generalize the fix. A theoretical over-skip risk on
a genuine `1) V § 3 …` amending instruction was identified but not observed firing in this corpus —
an unmeasured recall hazard on top of N1.

**N5 (LOW/MEDIUM, new) — stale prose in 3 more generated artifacts**: the "191 vs 187" node-count
typo (D7 residual); `collision-groups-005.json` and `collision-report-v2-005.json` both still say
"574 amends edges" in their `method` string even though the underlying numbers (verified:
`distinctAmendedLaws: 284`) were correctly regenerated from the final 567-edge set — only the
strings are stale, the data is not affected.

**N6 (LOW, new) — the D8 gate is a blacklist and fails open** when `esbirka_title` is empty ("do
not gate what we can't classify"). No live impact on this batch's data (100% of 187 titles are
`Zákon`-prefixed), but an allowlist (`Zákon`/`Ústavní zákon`/`Zákonné opatření`) would be strictly
safer and produces the identical result on this data.

### Part 3 — checks that came back clean

Count consistency across `edges.length`/`stats`/`perBillLog` with no drift; no duplicate edge keys;
no dangling targets (183 new + 101 pre-existing, set-equal to batch-004's target set);
`churnRanking.afterTop10` recomputes exactly from the edge array (40/2009 = 12, confirming the
"#1" claim is real); the 3 original hand-proven-false pairs confirmed absent
(`43341→law:sb:354-2019`, `43344→law:sb:9-2002`, `43365→law:sb:240-2000`); the `90-221` close-read
correction verified character-for-character against the source excerpt in
`collision-report-v2-005.json`; no fabricated law numbers found (every `ref` traces to a real
source).

### Not verified (stated for the record)

Did not open any `.pglite` (so the 101 pre-existing law nodes' `esbirka_title` coverage, and thus
whether D8's gate is live or fail-open for them, is unconfirmed); did not re-run
`validate-amends-regen-005.ts`/`diff-amends-regen-deletions.ts` (both need a store); of the 567
edges, hand-read cached source text for ~30 (the 18 proxy-flagged plus the 12 single-fallback
bills) — the remaining ~537 checked only structurally (source-tag traceability, target act-type,
dedup, target existence) and by the amending-verb proxy.

### Overall verdict

**NOT READY TO APPLY** for `batch-005-amends-regen.json` — not because of the original 11 (that
remediation is largely genuine), but because N1+N2 are a new, unremediated defect of the same
severity as D1, in a class neither the first audit nor the remediation examined: the extractor's
`Čl.`-only article splitter silently degrades every `ČÁST`/`§`-structured bill to a single, often
wrong, citation. Applying this set writes a graph that is wrong about tisk 63/69/6/55/76/144 and
blind to most of what tisk 250/69/10/54/113/189/228 actually amend, while the payload's own
`stats.distinctMissingLawStatutes: 0` would read as a certified-complete citation universe.

Minimum to reach READY: (1) extend `extractRealAmendedLaws` to split on `ČÁST …`/`Změna …`
headings and `§`-numbered amending blocks; (2) generalize `isFootnoteLine` to footnote blocks, not
lines; (3) decide the repeal-vs-amend modeling question explicitly; (4) add the missing provenance
fields and have the validator gate provenance shape + independently re-check the act-type gate;
(5) fix the stale prose strings.

**`batch-005-missing-law-nodes.json` on its own: READY WITH CAVEATS.** All 183 wired targets are
`Zákon`-prefixed acts, all 4 non-acts correctly quarantined, `unresolvable` genuinely empty, no
target dangles. Caveats: 37 truncated `label`s should regenerate from the intact
`props.esbirka_title` before apply; the real `pass` must be assigned by the write-lock holder; D6
remains open.

</details>

## 1. What ran this batch (see batch-006.md for full detail)

P1a (independent Opus audit, above) + P1b (full-population precision measurement,
`measure-precision-006.ts` — 561/567 high-confidence, 6/567 low-confidence, corrected to match the
audit's N2 finding) + P1c (durable insert-capable apply script, `apply-amends-regen.ts`, verified
end-to-end on an isolated copy including a real `--commit` test) + honest recommendation (§4 of
batch-006.md: **do not apply the edge regen this batch**) + `npm run check` (typecheck/tests
green, lint clean on this batch's own 2 new files; 3 pre-existing errors in a concurrent
executor's unrelated file, not touched).

Re-triage and the remaining collision-pair army wave (batch-005 priorities 4–5) were **not
started** this batch — both are contingent on the edge regen actually applying, which the audit
found it should not, this batch.

## 2. Graph payloads — STILL NOT applied (orchestrator decision required, contingent on a fix + third audit)

```bash
# Re-verify (unchanged from batch-005, still valid):
cp -r .pglite .pglite-copy-law-verify
PGLITE_PATH=./.pglite-copy-law-verify npx tsx scripts/case-loops/law/_apply-missing-law-nodes-copy.ts
PGLITE_PATH=./.pglite-copy-law-verify npx tsx scripts/case-loops/law/validate-amends-regen-005.ts

# batch-006's apply script (dry-run default; DO NOT --commit against live yet):
PGLITE_PATH=./.pglite-copy-law-verify npx tsx scripts/case-loops/law/apply-amends-regen.ts
# expect: 187/187 new nodes, 561/567 edges applied (6 excluded, 411 new + 150 merged), 0 unallowlisted deletions
```

**Note on this script's own QA**: a second Opus call (batch reflection, distinct from the P1a
audit above) found that 3 of the 6 exclusion entries originally carried the wrong bill-node id and
silently no-op'd — a live commit would have written 3 audit-confirmed-false edges despite the
console/report claiming all 6 were excluded. Fixed same-session (correct ids re-derived and
re-verified against the payload; a startup assertion now refuses to run if any exclusion entry
doesn't match a real payload edge). See `batch-006.md` §7 for the full account. This is disclosed
here, not smoothed over, because it directly affects trust in the "verified end-to-end" claim this
script otherwise makes.

**Recommendation: do not run `apply-amends-regen.ts --commit --confirm-live` yet.** The script
itself is correct and tested (nodes-then-edges, provenance-preserving merge on the 150 pre-existing
keys, deletion safety gate, the 6 audit-confirmed false edges excluded) — but excluding 6 known-bad
edges does not fix N1's recall gap (~29 real amendments still missing from exactly the highest-
value bills). Applying today would land a graph that is honest about what it excludes but still
silently incomplete, with the payload's own stats reading as "citation universe closed." Hold for
the extractor fix + regen + a third independent audit (see batch-006.md §4 for the exact
minimum-to-ready list).

The node payload (`batch-005-missing-law-nodes.json`) is independently sound and could apply on its
own, but provides no standalone value split from its edges (nothing currently cites most of these
187 statutes as an `amends` target without the edge regen) — land both together once the edges are
fixed, not the nodes alone now.

## 3. Shared-file additions (append verbatim — could not edit these in fleet mode)

### → `patterns.md`
```
### Law: an adversarial second pass beats the original author's self-review even when the
self-review author believes they are being adversarial about their own work
batch-005's driver fixed 6 of 11 audit-found defects and, in batch-006, ran its own manual
precision review of 6 proxy-flagged edges — correctly clearing 3 as proxy false-negatives, but
WRONGLY clearing a 4th (tisk 6 -> 424/1991) as real. An independently-dispatched Opus audit's
deeper, cross-bill-corroborated read overturned that call: 424/1991's real amendment lives in a
different bill; the citation the driver defended was a transitional provision, not an amending
clause. Two consecutive batches now show the SAME pattern one level deeper each time: batch-005's
audit caught what the driver's self-check missed on the ORIGINAL extraction; batch-006's audit
caught what the driver's self-check missed on its OWN precision review of that extraction's
residue. -> self-review, however rigorous-feeling, is a weaker check than a genuinely different
agent's read, structurally — not because the self-reviewer is careless, but because it shares the
same blind spots as whatever produced the artifact being reviewed.

### Law: a "citation universe closed" / "0 missing" claim needs an independent STRUCTURAL check,
not just a citation-resolution count
batch-005's amends-census extractor splits bills into amending-target citations by finding `Čl. N`
article markers; every bill matching that format gets accurately parsed. Bills organized instead by
`ČÁST ... Změna zákona ...` headings (common in omnibus/companion-change legislation) fall through
to a single-subject fallback that always emits exactly ONE citation regardless of how many laws the
bill actually amends -- a confidently wrong answer that looks structurally identical to a correctly
parsed single-subject bill. The payload's own stats ("0 missing statutes") were true for every
citation the extractor could SEE and materially false for the population as a whole (~29 missing
targets across 7 high-value omnibus bills, found by an independent audit reading the actual PDF
text). -> a recall claim of this shape needs a check on whether the extraction METHOD even applies
to each item's actual format, not just a citation-level resolution count over whatever the method
did find.
```

### → `feature-opportunities.md`
```
### Law: an insert-capable case-scoped apply script is cheap once the store's real capability is
understood (batch-006, closing part of batch-005's D3/D4 kernel-level gap)
`persist-batch.ts`'s "refuses to insert" (flagged in batch-005 as a kernel-level gap every future
node/edge-growing case loop would hit) turned out to be an APPLICATION-level choice in that one
shared script -- it checks target existence and throws -- not a store limitation:
`store.upsertKgNodes`/`upsertKgEdges` are true upserts by primary key, confirmed by reading
`lib/db/pglite/repositories/kg.ts`'s `ON CONFLICT ... DO UPDATE` clause. batch-006 built
`scripts/case-loops/law/apply-amends-regen.ts` as a case-scoped reference implementation:
node-then-edge ordering, a provenance-PRESERVING merge for pre-existing edge keys (props stay
additive via a namespaced note, `provenance` untouched), a deletion safety gate, and the same
fleet write-safety convention as `scripts/case-loops/money/purge-osvc.ts`
(`--commit` + `--confirm-live` for a live default-path write). Any future case hitting the same D3
wall should check whether its own payload shape can reuse this pattern before assuming
`persist-batch.ts` itself needs extending.

### Law: two consecutive Opus audits finding the SAME change-set not ready is a signal about the
extraction pipeline, not just the current payload
batch-005's census/regen pipeline has now failed independent audit twice, on two different defect
classes (precision/footnote-misreads first, then recall/structural-format-blindness second). The
next attempt at this payload should treat `amends-census.ts`'s `extractRealAmendedLaws` as
under-tested against the actual diversity of Czech bill formatting (ČÁST/Změna headings, repeal
clauses, multi-line footnotes) rather than patch a third specific case and resubmit for a third
audit -- per the kernel's "deferred-three-batches" rule, this item cannot roll a third time without
either landing or being explicitly retired.
```

### → `frontier.md` (Case ③ section)
```
- **batch-005's amends regen is NOT applying as of batch-006** -- a second independent Opus audit
  found a new recall defect (N1: the Čl.-only census extractor is blind to ČÁST/Změna-heading and
  §-organized bills, undercounting ~29 true amending targets in exactly the highest-value
  government omnibus bills) plus 6 confirmed false edges (not the 2 batch-006's own precision
  review found -- the audit's deeper read overturned one of the driver's "real edge" calls). The
  node payload (187 law nodes) is independently sound and ready on its own, but provides no
  standalone value without its edges. Minimum-to-ready path: extend the census extractor's article
  splitter to ČÁST/Změna headings + §-blocks, generalize the footnote-line detector to footnote
  BLOCKS, decide the repeal-vs-amend modeling question explicitly, complete the provenance shape,
  and get a THIRD independent audit before any live apply -- this is the second consecutive
  NOT READY verdict on this change-set; per the kernel's deferred-three-batches rule it cannot roll
  a third time without landing or being explicitly retired.
- **A durable, insert-capable apply path now EXISTS for this case** (`apply-amends-regen.ts`,
  batch-006) -- tested end-to-end on an isolated copy including a real commit test. It is ready
  machinery for whenever the regenerated payload clears audit; it does not itself need rework.
- **Re-triage and the ~171-pair collision army wave (batch-005 priorities 4-5) remain untouched**,
  correctly deferred a second batch -- both depend on the edge regen actually landing, which it has
  not.
```

### → `graph-log.md`
```
## Pass N (track: law) — Case ③ batch-006: independent audit found the batch-005 edge regen NOT
READY on a NEW recall defect; precision measured full-population; a durable apply path built and
verified but not executed (2026-07-25)
No graph writes this batch (all analysis on isolated .pglite-copy-law-006* copies, always removed
after use). A background Opus audit (maximum depth), independently dispatched and briefed to
distrust the batch-005 driver's remediation prose, re-checked all 11 original defects (D2/D5/D10
confirmed fixed; D8 fixed for this run with a fail-open design note; D11 correctly stated; D3/D6/D9
confirmed still open, D6/D9 wider/worse than previously reported; D1/D4/D7 partially fixed with
real residual gaps) AND found two new high-severity defects the first audit's scope never reached:
N1, the census extractor's Čl.-only article splitter silently degrades every ČÁST/§-organized bill
to a single citation, undercounting ~29 true amending targets across 7 high-value omnibus bills
(tisk 250/69/10/54/113/189/228) -- directly contradicting the payload's "0 missing statutes,
citation universe closed" claim; and N2, 6 confirmed false edges survive (tisk 63/69/6/55/76/144),
3 of them repeal clauses misread as amendments. This batch's own full-population precision
measurement (measure-precision-006.ts, amending-verb-context proxy across all 567 edges: 561
high-confidence / 6 low-confidence) overlaps only PARTIALLY with the audit's confirmed-false set
(3 of the proxy's 6 flags match the audit's 6 finds; the proxy flagged tisk 7/10/64 as low-
confidence but they are real, and rated tisk 55/76/144 as high-confidence despite being false
repeal-not-amend edges the proxy's verb regex cannot distinguish from real amendments) — reported
as a partial-overlap finding, not a corroboration, since the proxy demonstrably misses a real
defect class (repeal clauses) entirely. A durable insert-
capable apply script (apply-amends-regen.ts) was built and verified end-to-end on an isolated copy
(dry-run + a real --commit test), closing D3/D4 for this payload shape without touching the shared
persist-batch.ts -- but the batch's honest recommendation is NOT to run it live yet: excluding 6
known-false edges does not fix N1's recall gap. Live graph untouched. npm run check green
(typecheck 0 errors, tests 240/240; lint clean on this batch's own files, 3 pre-existing errors in
a concurrent fleet executor's unrelated file not touched).
```

## 4. Enum / schema proposals

None new this batch. The provenance-completeness gap (N3: missing `computedAt` on edges, missing
`pass` on nodes) is a payload-generation fix for whichever batch regenerates
`batch-005-amends-regen.json`/`batch-005-missing-law-nodes.json`, not a schema change.

## 5. Commit plan (orchestrator; per-case commit inside law boundary)

**Nothing committed this batch** (per Authority — no exceptions).

**Uncommitted work, all within law boundary**:
- `scripts/case-loops/law/measure-precision-006.ts` (new) — full-population precision proxy
- `scripts/case-loops/law/apply-amends-regen.ts` (new) — the durable insert-capable apply path
- `docs/data-analysis/case-law/batch-006.md` (new) — full narrative
- `docs/data-analysis/case-law/handoff.md` (this file, replacing batch-005's)
- `docs/data-analysis/case-law/ledger.json` (updated — `batch006IndependentAudit` summary block
  added to `totals`)
- `docs/data-analysis/case-law/payloads/batch-006-precision-measurement.json` (new)
- `docs/data-analysis/case-law/payloads/batch-006-apply-report.json` (new, dry-run artifact)

Suggested message (Conventional), for whatever the orchestrator folds together:
```
docs(case-law): batch-006 independent audit finds batch-005 edge regen NOT READY (new recall
defect), builds durable apply path, holds live apply

Law loop batch-006 — P1a: independent Opus audit (different agent, maximum depth) re-checked
batch-005's post-remediation payloads fresh. D2/D5/D10/D11 confirmed clean; D3/D6/D9 confirmed
still open (wider/worse than reported); D1/D4/D7 partially fixed. Found 2 NEW high-severity
defects the first audit's scope never reached: N1, the census extractor's Cl.-only splitter is
blind to CAST/Zmena-heading bills, undercounting ~29 true amending targets in 7 high-value
omnibus bills; N2, 6 confirmed false edges (not the driver's own 2). P1b: full-population
precision measurement (amending-verb-context proxy, 567 edges) -- 561 high-confidence / 6 low,
corrected to match the audit's finding. P1c: built apply-amends-regen.ts, an insert-capable,
provenance-preserving apply path (closes D3/D4 for this payload shape without touching the
shared persist-batch.ts) -- verified end-to-end on an isolated copy, dry-run + commit test both
clean. Recommendation: do NOT apply the edge regen this batch -- excluding 6 known-false edges
does not fix N1's recall gap; node payload alone is sound but provides no standalone value split
from its edges. Second consecutive NOT READY verdict on this change-set; concrete minimum-to-ready
path recorded. npm run check green (typecheck/tests; lint clean on this batch's own files).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 6. Lessons learned

See `batch-006.md` §7 for the full text (5 lessons): (1) the driver's own manual read of a proxy
flag is not a substitute for an independent audit, even when it feels rigorous — self-review
shares the blind spots of whatever produced the artifact; (2) "recall closed to 0" is the
highest-value claim in this kind of payload and the easiest to get wrong silently — a citation-
resolution count can be perfectly true for what the extractor CAN see and badly wrong for the
population as a whole; (3) a footnote-detection fix scoped to 3 motivating cases needs a block
model from the start, not a line model with iterative patches; (4) an insert-capable apply script
is genuinely cheap once the store's actual capability (true upsert-by-PK) is understood — the D3
gap was one script's narrow contract, not a missing store feature; (5) two consecutive Opus audits
finding the same change-set not ready is itself a signal about the extraction pipeline's
under-testedness, not just the current payload's state — the next attempt should harden the
extractor against real format diversity, not patch a third specific case.
