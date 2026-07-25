# Case ③ Law loop — batch-006 (2026-07-25)

Fleet run, concurrent with money/effort/kiosek loops. Priority: make batch-005's held change-set
(187 missing law nodes + 567 regenerated `amends` edges) applicable, or prove it isn't — per the
orchestrator's twice-held decision and the skill's Batch-006 priorities block. **No live `.pglite`
writes, no commits, no shared-vault edits** — all analysis on isolated `.pglite-copy-law-006*`
copies, always removed after use.

**Bottom line: NOT READY TO APPLY as the edge payload currently stands** — the independent audit
found a new, unremediated RECALL defect (N1) at least as serious as anything in the original
11-defect list, on top of confirming 6 false edges (not 2). The node payload (187 law nodes) is
independently sound and ready with minor caveats. Full detail below; §5 has the honest
recommendation and the concrete path to READY.

## 1. Independent fresh audit (P1a) — dispatched to a background Opus subagent, maximum depth

Briefed to check the CURRENT post-remediation payloads fresh against all 11 original defects
(D1–D11) plus an open search for new issues, explicitly instructed not to trust the driver's
remediation prose and to cite file+line or payload-field evidence for every finding. Full report
preserved verbatim in `handoff.md` §0 (this section is the summary).

### Verdicts on D1–D11

| # | Verdict | Note |
|---|---|---|
| D1 (precision never measured) | PARTIALLY FIXED — residual worse than the caveat states | 3 named cases (219/222/243) verified fixed; audit's own proxy run (18 flags across all 567) found the false-positive population is a DIFFERENT, structural class the amending-verb proxy can't see — see N1/N2 below |
| D2 (Sb. m. s. treaty collision) | CONFIRMED FIXED | regex lookahead verified correct; 0 of the 3 named false edges remain; one corpus-wide residual (tisk 46/104-2013) checked and is a true positive, not a defect |
| D3 (no apply path) | CONFIRMED NOT FIXED (correctly deferred) | `persist-batch.ts` still refuses inserts by design; this batch's `apply-amends-regen.ts` is the answer, see §3 |
| D4 (union-vs-replace / provenance overwrite) | PARTIALLY FIXED, gap real and open | `diff-amends-regen-deletions.ts` confirmed key-only; storage layer confirmed to wholesale-replace `props`/`provenance` on conflict (`lib/db/pglite/repositories/kg.ts:25`) — closed this batch by `apply-amends-regen.ts`'s provenance-preserving merge, see §3 |
| D5 (invented firstSeenPass) | CONFIRMED FIXED | `max(graph)+1`, correctly provisional |
| D6 (no durability contract) | CONFIRMED NOT FIXED, scope wider than reported | `kg-legislation-ingest.ts` wholesale-replaces `props` on BOTH law nodes AND `amends` edges (the edge scope was not previously flagged) — a re-run would also erase the `source`/provenance tags this whole regen exists to add |
| D7 (stale payload self-description) | PARTIALLY FIXED | payload `method`/`boundary`/`caveats` accurate except a "191 vs 187" node-count typo; the impact sidecar (`batch-005-amends-regen-impact.md`) was NOT updated, still headed "batch-004, prepare only" |
| D8 (non-act nodes as amends targets) | FIXED for this run; gate design is fail-open | full 567-edge scan confirms 0 remaining non-act targets; gate defaults to "allow" when a target's `esbirka_title` is empty — no live impact on this data (100% of 187 titles are `Zákon`-prefixed) but an allowlist would be structurally safer |
| D9 (truncated titles) | CONFIRMED OPEN, worse than reported | 37 of 187 (not 28) truncate mid-word in `label`; `props.esbirka_title` itself is intact in every case (display-only defect) |
| D10 (naive PGLITE_PATH guard) | CONFIRMED FIXED | absolute-path comparison verified |
| D11 (sequencing) | CONFIRMED CORRECTLY STATED | nodes-before-edges ordering, same window, accurately documented |

### New defects found (not on the original 11)

- **N1 (HIGH) — the census extractor is structurally blind to `ČÁST`/`§`-organized bills; the
  "0 missing statutes, citation universe closed" claim is materially false.** `extractRealAmendedLaws`
  splits only on `Čl. N` article markers; 21 of 140 census bills have zero `Čl.` markers and fall
  into the single-subject fallback (first non-footnote citation, ONE edge, regardless of how many
  laws the bill actually amends). 7 of those 21 are confirmed omnibus/companion bills with multiple
  `Změna zákona …` parts in the text — tisk 250 (10 real amending parts, 1 edge), 69 (7→1), 10
  (4→1), 54 (4→1), 113 (4→1), 189 (4→1), 228 (3→1) — **≈29 true amending targets missing**,
  concentrated in exactly the highest-value government omnibus bills for churn ranking and
  collision detection.
- **N2 (HIGH) — 6 confirmed false edges survive in the 567** (not the 2 the driver's own P1b
  manual review found — see §2's correction): tisk 63→21/1992 (substantive cross-reference, not
  amendment), tisk 69→381/1991 (multi-line footnote continuation `isFootnoteLine` didn't catch),
  tisk 6→424/1991 (transitional provision about a predecessor institution — the driver's P1b
  manual read wrongly cleared this one; the audit's line-level read overturns it), tisk
  55→194/2017, tisk 76→234/2014, tisk 144→326/1999 (all three: REPEAL clauses misread as
  amendments — a relation the extractor cannot distinguish from `amends`).
- **N3 (MEDIUM) — the "5-field kernel provenance contract" claim is false in both payloads.** Edge
  provenance is missing `computedAt` on all 567 edges; node provenance is missing `pass` on all
  187 nodes (only injected by the copy-apply script, not the payload itself). The validator never
  checks provenance shape at all.
- **N4 (MEDIUM) — `isFootnoteLine` is single-line and cuts both ways.** Confirmed under-skip on
  multi-line footnote blocks (tisk 69, N2); a theoretical over-skip risk on a genuine `1) V § 3 …`
  amending instruction was identified but not observed firing in this corpus.
- **N5 (LOW/MEDIUM) — stale prose in 3 more generated artifacts** beyond D7: the "191 vs 187" node
  count, and `collision-groups-005.json`/`collision-report-v2-005.json` both still say "574 amends
  edges" in their `method` string even though the underlying numbers were correctly regenerated
  from the final 567-edge set (verified: `distinctAmendedLaws: 284` matches an independent recount).
- **N6 (LOW) — the D8 act-type gate is a blacklist and fails open** on an empty `esbirka_title`; no
  live impact on this batch's data (100% `Zákon`-prefixed) but an allowlist would be strictly safer.

### Checks that came back clean
Edge/stat count consistency (567 = stats = totalResolvedCitations, no drift anywhere); no duplicate
edge keys; no dangling targets (183 new + 101 pre-existing, set-equal to batch-004's target set);
churn re-ranking recomputes correctly from the edge array (40/2009 = 12, confirming the "#1" claim
is real); the 3 original hand-proven-false pairs are confirmed absent; the `90-221` close-read
correction was independently verified character-for-character against the source excerpt; no
fabricated law numbers (every `ref` traces to a real source).

### What the audit did not verify (stated for the record, not hidden)
Did not open `.pglite` (so the 101 pre-existing law nodes' `esbirka_title` coverage, and thus
whether D8's gate is live or fail-open for them, is unconfirmed); did not re-run
`validate-amends-regen-005.ts`/`diff-amends-regen-deletions.ts` (both need a store); of the 567
edges, hand-read cached source text for ~30 (the proxy-flagged 18 + the 12 single-fallback bills),
the remaining ~537 checked only structurally + by the proxy.

### Overall audit verdict
**NOT READY TO APPLY** for `batch-005-amends-regen.json`. **READY WITH CAVEATS** for
`batch-005-missing-law-nodes.json` on its own (187 nodes independently sound; caveats: 37 truncated
`label`s should regenerate from the intact `esbirka_title` before apply; real `pass` must be
assigned by the write-lock holder; D6's durability gap remains open).

## 2. Full precision measurement (P1b) — and a correction from the audit

New script: `scripts/case-loops/law/measure-precision-006.ts`. Method: the amending-context proxy
(citation within ±2500 chars of `se mění|se ruší|se vkládá|se nahrazuje|zní:`), run as a full
567-edge population metric, not a spot-check. Result: 561/567 (98.94%) high_confidence, 6/567
(1.06%) low_confidence, 0 unresolvable. Output:
`docs/data-analysis/case-law/payloads/batch-006-precision-measurement.json`.

**The driver's own manual read of the 6 low-confidence flags classified 4 as proxy false-negatives
(real edges, verb-phrasing/window artifacts) and only 2 as genuine false edges (tisk 63→21/1992,
tisk 69→381/1991). The independently-dispatched Opus audit's deeper, line-level read overturned
one of those 4 "real" classifications**: tisk 6→424/1991, which the driver read as containing real
"mění"/"ruší" verb forms near the citation, is actually a transitional provision about a
predecessor institution, not an amending clause — the audit traced the ACTUAL 424/1991 amendment
to a different bill. **This is deferred to as the correct call** — the audit's evidence (exact line
numbers, cross-bill corroboration) is stronger than the driver's own pattern-matching read, and it
is exactly the discipline the kernel's audit doctrine exists for (an adversarial second pass beats
the original author's self-check, every time this loop has tested it).

Combined with N2's other 3 finds (55/76/144, all repeal-not-amend), the **corrected precision
figure is 561/567 confirmed-or-plausible-real (98.9%), 6/567 confirmed false (1.06%)** — a good
per-edge precision number in isolation, but precision alone does not clear the audit's overall
verdict: **N1's recall gap (≈29 missing true edges in exactly the bills this regen was supposed to
fix) is the harder problem, and it is not something a precision exclusion list can patch.**

## 3. The durable apply path (P1c)

New script: `scripts/case-loops/law/apply-amends-regen.ts` — the case-scoped, insert-capable
reference implementation the batch-005 handoff asked for (D3/D4). `persist-batch.ts` remains
props-merge-only and out of this case's fleet boundary to extend; this script answers the same gap
for THIS payload shape without touching the shared file.

Design:
1. **Nodes first, edges second, same run** (D11).
2. **Nodes**: plain insert with a REAL assigned `--pass=<n>` (refuses `--commit` without one).
3. **Edges, split by whether the (from,to) key already exists live** (the actual D4 fix): 150
   pre-existing keys get a provenance-PRESERVING merge (live `provenance` left completely
   untouched; only an additive `props.amends_regen_005` note added); new keys get a full insert
   with the real pass substituted for the payload's placeholder `pass: 0`.
4. **Deletion safety gate** (P44/D1 method, reused inline from `diff-amends-regen-deletions.ts`):
   any live edge missing from the applied set is refused unless allowlisted.
5. **Precision exclusion, updated post-audit**: the exclusion list now carries all **6**
   audit-confirmed false edges (not just the driver's original 2) — tisk 63→21/1992, 69→381/1991,
   6→424/1991, 55→194/2017, 76→234/2014, 144→326/1999 — each with its cached-text line citation.
6. **Fleet write safety** (same convention as `scripts/case-loops/money/purge-osvc.ts`): dry-run
   default; `--commit` with `PGLITE_PATH` unset is refused unless `--confirm-live`; `--commit`
   requires `--pass=<n>`.
7. Always writes `docs/data-analysis/case-law/payloads/batch-006-apply-report.json`.

**Verified end-to-end** against an isolated throwaway copy (removed after use, never touched live
`./.pglite`): dry-run and a `--pass=999` commit test both ran clean — 187/187 new nodes, 561/567
edges applied (411 new inserts + 150 provenance-preserving merges = 561), 0 unallowlisted
deletions. **This number was corrected after a bug the reflection pass (§8) caught — see there for
what happened and why the "verified end-to-end" claim above needed a second look before it was
actually true.**

**Important scope note**: this script is correct, tested machinery — but per the audit's overall
verdict, **excluding 6 known-false edges does not by itself make the edge regen ready to apply.**
N1's recall gap means the 561 remaining edges are precision-clean but the SET is still
incomplete/undercounting exactly where it matters most. Running this script's edge phase live
today would write a graph that is honest about the 6 excluded false claims but still silently
undercounts ~29 real amendments in 7 high-value bills, while the payload's own stats block would
read as "citation universe closed." That is not an acceptable trade — see §4.

## 4. Recommendation

**Do not apply the edge regen (`batch-005-amends-regen.json`) this batch.** The node payload
(`batch-005-missing-law-nodes.json`) is independently verified sound and CAN apply on its own —
187 law nodes with correct titles/ELIs and no dangling issues — but applying only the nodes without
the edges provides no immediate value (no bill currently cites most of these statutes as an
`amends` edge target yet, since that requires the edge regen), so there is no urgency to split the
apply into two commits; better to land both together once the edge set is actually fixed.

**Minimum to reach READY** (from the audit, adopted as this batch's concrete next-step list):
1. Extend `extractRealAmendedLaws` (`amends-census.ts`) to split on `ČÁST …`/`Změna …` part
   headings and `§`-numbered amending blocks, in addition to `Čl. N` — closes N1, and as a side
   effect correctly zeroes out the tisk 63/6/55/76/144 fallback edges (those bills have no
   amending part at all).
2. Generalize `isFootnoteLine` to footnote BLOCKS, not lines (N4) — tisk 69 is the regression test.
3. Decide the repeal-vs-amend modeling question explicitly (tisk 55/76/144 class): a separate
   `rel` (e.g. `repeals`), or excluded from the graph entirely — not silently folded into `amends`.
4. Add the missing provenance fields (`computedAt` on edges, `pass` on nodes) and have
   `validate-amends-regen-005.ts` actually gate provenance shape + independently re-check the
   act-type gate (N3).
5. Fix the stale prose (N5) — cheap, and exactly the "actively misleading a reader" failure D7 was
   raised to close.
6. Re-run the census + regen + this batch's `measure-precision-006.ts` + a THIRD independent audit
   before any live apply — this is now the second consecutive audit to find the payload not ready;
   per the kernel's "deferred-three-batches" rule this cannot roll a third time without either
   landing or being explicitly retired.

This batch's `apply-amends-regen.ts` remains valid, tested machinery for whenever that regenerated
payload lands — it does not need to be rebuilt, only pointed at the corrected payload file and its
exclusion list re-checked against a fresh audit of that version.

## 5. Re-triage / collision-sweep scope (batch-005 priorities 4–5) — correctly deferred, not started

Contingent on the edge regen actually applying, which it does not this batch — re-triage against
the still-live 150-edge topology would produce numbers that go stale the moment a corrected regen
eventually lands. Not started, recorded honestly as deferred rather than run against a topology
this batch confirmed is not going to be the final one.

## 6. `npm run check`

- **typecheck: green** (`tsc --noEmit`, 0 errors).
- **tests: green** (240/240, `vitest run`).
- **lint: 3 pre-existing errors, all in `lib/ingest/sources/dataor.ts`** — a concurrent fleet
  executor's in-progress file (the dataor/kiosek ingest, explicitly out of this case's boundary),
  not touched this batch. This driver's own new files
  (`scripts/case-loops/law/measure-precision-006.ts`, `scripts/case-loops/law/apply-amends-regen.ts`)
  lint clean (verified with a targeted `eslint` run against just those two files).

## 7. Second Opus call — batch reflection, and a bug it caught

Per the batch brief's step 6, a second Opus call (a genuinely separate agent from the P1a audit)
reviewed THIS BATCH'S OWN deliverables — not the underlying legislative payload again, but whether
the batch note, handoff, and new scripts were internally consistent and free of self-serving
framing. **It found a real bug**: 3 of the 6 entries in `apply-amends-regen.ts`'s
`EXCLUDED_LOW_CONFIDENCE_EDGES` list carried the WRONG `from` bill-node id (tisk 55/76/144 were
written as `bill:tisk:43159`/`43177`/`43225`, none of which are those bills' real ids —
`43162`/`43183`/`43264` are). The wrong ids matched nothing in the payload, so the exclusion
filter silently no-op'd for those 3: **a live `--commit` would have written 3 of the 6
audit-confirmed-false edges anyway**, while the console output and report both claimed all 6 were
excluded. The reflection also caught two smaller issues: the stale `isManuallyConfirmedLowConfidenceButReal`
list still listed tisk 6→424/1991 as "real" after the exclusion list had already correctly moved
it to "false" (dead, contradictory code — the exact stale-self-description class the audit's D7/N5
findings criticized elsewhere in this same payload); and the graph-log draft's "independently
corroborated" framing overstated the overlap between the driver's own precision-review flags
(tisk 6/7/10/63/64/69) and the audit's confirmed-false set (6/63/69/55/76/144) — the true overlap
is 3 of 6, not full corroboration, and that overlap gap is itself worth keeping as a finding rather
than smoothing over.

**Fixed, same session**: the 3 wrong ids corrected (re-derived from `perBillLog` and re-verified
against the payload before applying), the stale tisk-6 "real" entry removed, a startup assertion
added to `apply-amends-regen.ts` that refuses to run if any exclusion entry doesn't match a real
payload edge (so this exact bug class fails loudly next time instead of silently), and the report
artifact + this document's numbers regenerated and reconciled (561/567 edges applied — 411 new
inserts + 150 merges — not the earlier 564/565 figures, which were themselves symptoms of the
bug: the wrong-id exclusions meant 3 too many edges were being counted as "applied" without being
flagged). The apply script was NOT run with `--commit` against anything but a throwaway,
immediately-deleted copy at any point — no live or persistent artifact was ever at risk.

## 8. Lessons learned

1. **The driver's own manual read of a proxy flag is not a substitute for an independent audit,
   even when it feels rigorous** — the P1b manual review correctly cleared 3 of 4 proxy
   false-negatives but wrongly cleared the 4th (tisk 6→424/1991); the independently-dispatched
   audit's deeper, cross-bill-corroborated read caught it. Self-review by the same
   pipeline/mindset that built the fix is weaker than an adversarial second pass EVEN WHEN the
   self-review agent believes it is being adversarial about its own work — this is the batch-005
   lesson (§7.1/§7.2 there) proving out a third time, one level deeper: it's not enough to audit
   your own OUTPUT differently than you audited your INPUT; a genuinely different agent still
   finds things the same agent's second pass does not.
2. **"Recall closed to 0" is the highest-value claim in this kind of payload and the easiest to
   get wrong silently** — the census extractor's `Čl.`-only splitter produces a STRUCTURALLY
   confident wrong answer (exactly one edge per bill, looks complete) rather than an honestly
   partial one, for every non-`Čl.`-organized bill. A "0 missing statutes" stat can be true for the
   citations the extractor CAN see and still badly wrong for the population as a whole — the
   number needs an independent structural check (does this bill's format even match what the
   extractor knows how to parse?), not just a citation-resolution count.
3. **A footnote-detection fix scoped to the motivating 3 cases needs a block model, not a line
   model, from the start** — batch-005 already learned "iterate against multiple examples" for the
   paren-handling half of `isFootnoteLine`; the multi-line-continuation half of the same function
   needed the identical lesson independently, one property later. When a text-extraction heuristic
   is built to close a specific audit finding, the fix's OWN shape (line-scoped vs block-scoped,
   single-verb-form vs verb-family) deserves the same "what is this still blind to" scrutiny the
   kernel's patterns.md entry from batch-005 already names for gates generally.
4. **An insert-capable apply script is genuinely cheap to build once the store's actual capability
   is understood** — `persist-batch.ts`'s "refuses to insert" turned out to be an
   application-level choice (checks existence, throws), not a store limitation
   (`store.upsertKgNodes`/`upsertKgEdges` are true upserts by PK). The D3 gap was about one
   shared script's deliberately narrow contract, not a missing store capability — worth checking
   before assuming new infrastructure is needed.
5. **Two consecutive Opus audits finding the same change-set not ready is itself a signal about
   the change-set's SOURCE, not just its current state** — batch-005's extraction pipeline
   (census body-text parsing) has now failed an independent audit twice, on two different defect
   classes (precision/footnotes, then recall/structure). The next attempt should treat the
   extractor itself as under-tested against the actual diversity of Czech bill formatting, not
   patch a third specific case and re-submit.
6. **A "correct, tested" claim about your OWN new tooling needs the same independent check as a
   claim about the underlying data — a self-run dry-run/commit test is not that check.** The
   apply script's exclusion list had a silent id-mismatch bug that a dry-run against a live copy
   did not surface (wrong ids just match nothing, no error, the run "succeeds") — it took a
   genuinely separate reflection pass cross-checking the list against the actual payload keys to
   catch it. The driver's own "verified end-to-end" framing (§3, before correction) was accurate
   about WHAT was tested (dry-run + commit against a copy) but not about whether that test would
   have caught this specific class of defect — it would not have, by construction, since the bug's
   symptom (silently applying edges instead of excluding them) looks identical to success in every
   metric the driver was watching. The fix (an assertion that fails loudly if an exclusion doesn't
   match) closes this specific hole; the general lesson is that a self-authored verification step
   inherits its author's blind spots exactly like a self-authored fix does (lesson 1, one level
   further down the stack — this time in the DRIVER'S OWN new code, not the payload it was
   reviewing).
