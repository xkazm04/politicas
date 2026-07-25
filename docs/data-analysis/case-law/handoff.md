# Case ③ Law loop — fleet handoff (batch-007, 2026-07-25)

Fleet run, concurrent with an insert-path executor working in `scripts/case-loops/apply-batch*` +
`lib/analysis/kg-verdict.ts` (stayed out of both). **No live `.pglite` writes during analysis, no
shared-vault edits, no commits.** Full narrative: `batch-007.md` (read that first — this file is
the orchestrator action list plus the two verbatim Opus reports). This supersedes batch-006's
`handoff.md` as the action list; `batch-005.md`/`batch-006.md` and their `handoff.md` stay as
history.

## 0. Independent audit (Opus #1, maximum depth) — verbatim

Dispatched to a genuinely separate agent, no memory of the driver's work, briefed adversarially:
find every reason the batch-007 regenerated `amends` edge payload must not be applied. Full report,
unedited (note: this audit ran against the payload BEFORE the driver's N-A fix and the reflection
pass's round-2 fixes — see §0b for what changed after):

<details>
<summary>Independent audit — batch-007 payload (pre-N-A-fix state), full text</summary>

## VERDICT: **READY WITH CAVEATS** — conditional on three mechanical preconditions

I audited the batch-007 payload from scratch — read every script end to end, re-derived the census
independently from the cached PDF text, ran the validator myself, and queried both the live store
and the isolated copy read-only. No files were modified; the live `./.pglite` was opened read-only
only.

Scope: `docs/data-analysis/case-law/payloads/batch-007-amends-regen.json` (586 edges, at the time
of this audit) and the machinery that produced it. All evidence below is from my own
re-derivation, not the driver's prose.

### Part 1 — Verdicts on the three claimed fixes

**Fix 1 — ČÁST splitter + `změn[aiy]` heading gate: CONFIRMED CORRECT** (with two caveats). I
reimplemented `extractRealAmendedLaws` verbatim from `amends-census.ts:238-297` and replayed it
against the cached text of all 140 census rows. **Full determinism replay: 0 mismatches / 140
rows.** Every `realLaws` array and `structure` tag in `batch-007-amends-census.json` reproduces
exactly from `.data/law-collision-cache/` + the committed code. Per-block replay of tisk 250
confirmed the gate correctly excludes `ČÁST DVANÁCTÁ ZRUŠOVACÍ USTANOVENÍ` and `ČÁST TŘINÁCTÁ
ÚČINNOST` while gating in the 10 real "Změna" parts. **Gate false-positive hunt** (a repeal/
účinnost part sneaking "změn" into its 320-char window): swept every ČÁST block in all 16
`cast`-structured bills — zero cases. **Gate false-negative hunt** (a real "Změna" part silently
skipped): swept the whole corpus for heading-shaped "Změna …" lines — every uncovered one inside a
`cast` bill is a non-law "Změna" (tisk 63 "Změna účetní metody", tisk 144 "Změna garanta", etc.) —
no real amending part is being skipped in this corpus. **Window sizing** — empirically justified,
thin margin: max `změn` offset inside the 320-char heading window = 238; max first-citation offset
inside the 1200-char citation window = 348 (headroom ~1.3×/~3.4×). **`ČÁST` regex robustness** —
checked all 141 cached texts; the 22 bills with `ČÁST` but 0 `PART_RE` matches are all `OBECNÁ
ČÁST`/`ZVLÁŠTNÍ ČÁST` memo headers (correct non-matches). No pdftotext running-header produced a
phantom ČÁST boundary.

**Fix 2 — `AMENDING_TITLE_RE` title-verb gate: WORKS, BUT IS UNEXERCISED DEAD CODE.** Structure
histogram: `cl: 119, cast: 16, single-subject-non-amending: 5, single-subject-amending: 0`. The
positive branch never fires in this corpus — all 5 single-subject bills correctly zeroed, each
verified by reading its own title. The regex's Czech grammatical coverage is untested by any real
case (misses `kterým se doplňuje`, `o změně zákona č. X`, etc.) but this is latent risk, not a live
defect.

**Fix 3 — multi-line footnote block: CONFIRMED WORKING.** Direct evidence from tisk 243 (both
footnote citations suppressed, `realLaws = []`, correct) and tisk 69's `381/1991` (gone from both
census and payload).

### Part 2 — N1 and N2 independently re-verified

**N1 (recall) — CLOSED, exactly as claimed.** Diffed old vs new census: 250 (1→10, +9), 69 (1→7,
+6), 10/54/113/189 (1→4 each, +3 each), 228 (1→3, +2) = **+29, matching the batch-006 audit's ~29
prediction exactly.** Line-verified 3 of these against raw cached text. Edge-level accounting
closes cleanly: 567→586, exactly 6 removed / 25 added / nothing else, all `census_full`.

**N2 (precision) — ALL 6 GONE, FOR THE RIGHT REASON.** Set difference removes precisely the 6
batch-006 audit-confirmed false edges. **No exclusion allowlist anywhere in the generation path** —
census rows confirm the structural reason for each (title gate rejects for 6/55; all ČÁST parts
gate OUT for 63/76/144; footnote block walk-back suppresses 69's `381/1991`). These are
structurally impossible to reproduce, not accidentally filtered. Verdict: N2 closed.

### Part 3 — New defects

**N-A (MEDIUM-HIGH) — the title_fallback UNION can override the census's deliberate zero, and
does; 1 confirmed false edge ships.** `amends-regen-007.ts:136-139` unions the census list with the
bill's title-derived `amended_laws` prop with no verb-semantics gate. 8 bills have a census
proposal but still emit `title_fallback` edges; of these, **tisk 116** (`"kterým se zrušuje zákon
č. 353/2019 Sb."`) is FALSE — a repeal bill, census correctly says `[]`, union re-adds `353/2019`
anyway. The union is genuinely load-bearing for other bills (tisk 107, 243 are real novelas whose
operative text never reprints the target's own citation number) — dropping it entirely would lose
real edges. 5 other union-sourced refs (36/42/88/124/153) were NOT independently verified by this
audit.

**N-B (LOW-MEDIUM) — the `single-subject-amending` branch is unwindowed**, i.e. it is the old
N2-producing whole-text-scan code, currently unreachable (0 bills classified this way) but a
loaded gun for the next corpus refresh.

**N-C (MEDIUM) — `apply-amends-regen.ts` is stale and will not correctly apply this payload.**
`NODE_PAYLOAD`/`EDGE_PAYLOAD`/`REPORT_OUT` still name batch-005's files. Running it unmodified
applies batch-005's superseded set. Re-pointing `EDGE_PAYLOAD` without further edits hits the
startup assertion and REFUSES (a safe failure, credit to the script) — but once someone clears that
assertion by emptying the exclusion list, several stale things go quiet: `isManuallyConfirmedLow
ConfidenceButReal` is missing batch-007's new low-confidence edge; the merge-note namespace is
hardcoded `amends_regen_005`; `NODE_PAYLOAD` is batch-005's 187 nodes (missing batch-007's 5 newly
discovered statutes). Confirmed the nodes-first dependency is real: live `./.pglite` has 101 law
nodes; `.pglite-copy-law-007` has 288 (delta 187) — 436 of the 586 edges point at nodes that don't
exist live.

**N-D (LOW-MEDIUM) — the precision measurement is close to vacuous for the repeal class, and its
own docstring is stale.** `measure-precision-007.ts:152` still read "567" while measuring 586 at
audit time. More substantively: `AMEND_VERB` includes `se ruší` (repeal), so of the 6 edges
batch-006 hand-confirmed FALSE, 3 (tisk 55/76/144) were rated `high_confidence` by this exact
proxy — the "high_confidence" figure carries zero evidentiary weight against repeal-class false
positives. Independently confirmed the 4th low-confidence flag (tisk 250 → 2/1969) is real.

**N-E (LOW) — memo-boundary detection recognizes only "Důvodová zpráva".** One bill (tisk 100)
uses "Odůvodnění / Obecná část" instead — harmless in this corpus only because the last article's
800-char window caps before the memo begins.

**N-F (LOW) — footnote heuristic can suppress a real citation, silently and uncounted.**
`pdftotext -layout` regularly injects page numbers inline; had a page number landed on the same
line as a real citation instead of a separate line, the citation would be dropped with no signal.

**N-G (INFO) — `PART_RE` lacks `/u`; `\b` truncates diacritic-final ordinals** in
`skippedParts[].label` (reporting-only field, block boundaries/gating unaffected).

### Part 4 — Checks that came back clean

Census reproducibility (0 mismatches/140 rows); validator run by the audit itself (5/5 PASS, 0
warnings, 0 fail-open — every one of 288 law nodes carries `esbirka_title`); all batch-007 scripts
correctly point at batch-007 paths (no cross-batch leakage); store isolation verified by direct
read-only query (live = 150 amends edges throughout, unchanged; copy = 150 + the 187-node ingest,
nothing else); no phantom ČÁST boundaries; no memo bleed; provenance 5-field contract complete on
all edges with a shared `computedAt` (N3 closed); deletion safety confirmed (drops exactly the 6
audited-false keys, nothing else).

### Part 5 — What was NOT verified

Ground-truth precision of the 25 new edges beyond structural reading (not each full clause read in
full); the 5 unverified `title_fallback` union edges (36/42/88/124/153); the 110 `title_fallback`
edges from non-census bills generally (psp-legislation.ts's title extractor is an unaudited
surface this batch did not touch); `npm run check`/tests not re-run by this audit.

### Part 6 — Overall verdict

**READY WITH CAVEATS** — conditional on three mechanical preconditions. The regeneration itself is
sound and materially better than batch-005/006 — this is the first batch where no structural
defect was found in the core extraction. The three blockers are all outside the census and all
cheap: (1) drop the tisk-116 false edge or gate the title path; (2) refresh
`apply-amends-regen.ts` before any live run; (3) fix stale prose (the "567" count, silent caveats
on the 5 missing statutes + tisk 116). **On "citation universe closed": this payload must NOT
claim closure, and at audit time it did not** — `distinctMissingLawStatutes: 5` present and
correct; the honest framing is "closer than any prior batch, and now measurable — not closed."

</details>

## 0b. Reflection (Opus #2, a separate agent) — verbatim

Reviewed THIS BATCH'S OWN deliverables (not the underlying legislative data again) for internal
consistency and self-serving framing, after the driver applied fixes for the audit's N-A and N-D
findings (N-C deliberately left unfixed per the brief's boundary). Full report, unedited:

<details>
<summary>Reflection pass — batch-007's own remediation, full text</summary>

## VERDICT: **NOT ready as reported.** Four real defects, one of them the same class the
batch-006 reflection caught. The core extraction work is sound and reproducible; the
*remediation claims* are overstated.

I independently reproduced the precision measurement exactly (581 high / 4 low / 0 unresolvable,
same 4 low-confidence edges) and re-derived every count in the payload. The driver's factual
account is accurate on almost everything **except the scope of the N-A fix and the N-D fix's
completeness**.

### A. HEADLINE FINDING — the N-A fix is incomplete; ≥3 false edges of the identical class still
ship

**A1. `tisk 129` → `law:sb:223-2016`** — a pure-repeal bill's only edge, still in the payload. The
bill's own printed title (cached text offset 152): "ZÁKON …, kterým se zrušuje zákon č. 223/2016
Sb., o prodejní době v maloobchodě …". Escapes the gate mechanically: bill node LABELS are
truncated to 200 characters (74/140 census rows have `title.length === 200` exactly); tisk 129's
label cuts off ONE CHARACTER before "ým se zrušuje". `REPEAL_TITLE_RE.test(label)` is `false`. The
gate working on tisk 116 was luck, not design. The census's `Čl.` path also had no repeal gate at
all (`Čl. I Zrušují se: 1. Zákon č. 223/2016 Sb.` was extracted as an amend target).

**A2. `tisk 231` → `law:sb:348-2005`** — the repeal target the driver saw and called
"out-of-scope". Cached text: "ČÁST ČTVRTÁ ZRUŠOVACÍ USTANOVENÍ Čl. IV Zrušují se: 1. Zákon č.
348/2005 Sb." The driver read this exact title while debugging the over-broad first gate and
encoded it in a comment, then characterised the surviving edge as "leaving mixed-title bills'
pre-existing (unrelated, out-of-scope) title-regex behavior untouched." It is not unrelated — it is
the same defect in the same bill the driver was debugging.

**A3. `tisk 64` → `law:sb:25-2017`** — repeal target via the `Čl.` census path. Cached text: "ČÁST
STO ČTYŘICÁTÁ DEVÁTÁ ZRUŠOVACÍ USTANOVENÍ Čl. CLIX Zrušují se: 1. Zákon č. 25/2017 Sb." Tagged
`census_full`. All three are precisely the class batch-006's audit excluded three edges for. This
payload has no exclusion list of its own — the census fix was assumed to have absorbed that job.
It absorbed it only for ČÁST-structured bills whose repeal part is gated by the heading check; it
did not extend to the `Čl.` path at all, and the ČÁST gate itself only looks FORWARD from a part's
own label, not at an outer ČÁST wrapping a `Čl.` article (tisk 231's case).

**A4. The precision proxy structurally cannot see this class** — `AMEND_VERB` includes `se ruší`.
Confirmed all three false edges above score `high_confidence`. The "99.3%" figure carries zero
evidentiary weight against repeal-class false positives, and none of the caveats mention it.

### B. The N-D fix is stale again — off by exactly the edge N-A removed

Both numbers the N-D fix introduced were wrong at the time of this review (fixed before the
final re-run, not before this reflection ran): "586" vs actual 585 at that point, "0/110" vs
actual 109. `batch-007-precision-measurement.json` therefore contradicted itself internally at
that point — the exact batch-006 bug class: a hardcoded value that LOOKS updated but is wrong.

### C. N-C is not merely "not fixed" — the payload asserted the opposite of the truth

Leaving `apply-amends-regen.ts` alone was a defensible boundary call. Documenting it as done was
not. `amends-regen-007.ts`'s `boundary` field and header comment BOTH stated the script was
"re-pointed at this payload" — it was not; `apply-amends-regen.ts:63-64` still read batch-005's
filenames. The payload's `caveats` block contained no mention of N-C at all.

### D. Smaller but real

Dangling `batch-007.md` reference (file did not exist at review time); stale `auditStatus` caveat
(written before the audit ran, never updated after); `diff-amends-regen-deletions.ts` still
defaulted to batch-005's payload path; the "8 bill-citations" attribution conflated 5
missing-law-node citations with 3 non-act-excluded citations as if all 8 were the same class; no
captured validator run artifact for the final payload state.

### E. What checked out clean

585 edges (at that point), no duplicates, stats fully self-consistent; provenance 5-field contract
complete with one shared `computedAt`; census self-consistency (140 rows, no arithmetic
mismatches); proposal-v2 numbers reconcile; **the N-A gate narrowing is genuinely correct where it
fires** (tisk 231 retains 483/1991 and 484/1991; tisk 116 has zero edges; `353/2019` keeps one
legitimate incoming edge from a different bill); comment honesty on the two-attempt history (the
ONE place the driver documented their own error rather than smoothing it over — credited); all 6
batch-006 confirmed-false edges absent; tisk 222 resolves correctly to `134/2016` only; the
deletion allowlist key for tisk 116 is well-formed and correct (no id-mismatch of the batch-006
kind); precision measurement reproduces exactly.

### Recommended minimum before this is reported as ready

1. Drop or exclude `bill:tisk:43250|law:sb:223-2016` (tisk 129) and disclose/exclude
   `bill:tisk:43353|law:sb:348-2005` (231) and `bill:tisk:43171|law:sb:25-2017` (64).
2. Re-base the N-A gate on non-truncated text — the 200-char label makes it unreliable for 53% of
   the corpus.
3. Fix `586`→`585` and `0/110`→`0/109`, re-run so the shipped JSON stops contradicting itself.
4. Add a repeal-class caveat to `measure-precision-007.ts` stating `se ruší` is inside `AMEND_VERB`
   and the high-confidence rate is blind to repeal-target false positives.
5. Correct `boundary` to say `apply-amends-regen.ts` is stale and must not be run unmodified.
6. Point `diff-amends-regen-deletions.ts`'s default payload at batch-007.
7. Fix the "8 bill-citations" attribution.
8. Either write `batch-007.md` or stop referencing it from the payload.

</details>

## 1. Driver's response to both reports (fixed same session, see `batch-007.md` §§1,5,6 for full
detail)

- **N-A, round 1** (applied before the reflection ran): a title-level `REPEAL_TITLE_RE` gate,
  narrowed to pure-repeal titles (repeal verb present, amend verb absent) after a self-caught
  over-broad first attempt that would have wrongly blanked tisk 231's real amendments.
- **N-D**: fixed the stale "567"/"586" counts (moved to a non-hardcoded description referencing
  `summary.totalEdges`) and the stale caveat.
- **Reflection's A1/A2/A3** (tisk 129/231/64): the title-level approach from round 1 was
  structurally insufficient (truncated labels, mixed titles, and the `Čl.`-path repeal class it
  never covered at all) — replaced with a **structural, per-block** exclusion in
  `amends-census.ts` (`REPEAL_MARKER`, `NON_AMEND_ART_HEADING_RE`, applied to both `Čl.` and `ČÁST`
  blocks, with a heading lookback for `ČÁST`-wrapped `Čl.` articles). A **self-caught bug** during
  this fix (an unconditional per-bill suppression that wrongly zeroed 24 bills' real edges when the
  same ref was legitimately real elsewhere) was found by re-running the pipeline and noticing an
  abnormal count spike (585→546 edges, no_data 9→33), fixed by cross-checking against the bill's
  own `realLaws` before suppressing.
- **Reflection's C** (boundary/caveats overclaiming): corrected `amends-regen-007.ts`'s `boundary`
  and `caveats` fields to accurately state `apply-amends-regen.ts` is stale and must not be run
  unmodified, and to disclose the audit-trail history rather than assert unconditional readiness.
- **N-C itself** (the script's actual staleness): deliberately left unfixed — the driver's own
  brief explicitly instructs "do NOT rebuild" `apply-amends-regen.ts`.
- All fixes were followed by: a 12+ bill regression re-run, a full 140-bill census re-run, the
  validator (5/5 PASS), the precision measurement (577/581 high_confidence), the deletion-safety
  diff (0 unallowlisted), a corpus-wide repeal-heading sweep (no further leaks found), `npm run
  check` (typecheck/lint clean on this batch's files, tests 285/285).

**This final round of fixes has NOT been independently re-audited by a fresh agent** — see
`batch-007.md` §7 for the concrete, narrow follow-up this implies for the orchestrator.

## 2. Graph payloads — NOT applied (orchestrator decision required, contingent on one more
targeted independent check)

```bash
# Re-verify (the census/regen pipeline, from a fresh copy):
cp -r .pglite-copy-law-005 .pglite-copy-law-007-verify
PGLITE_PATH=./.pglite-copy-law-007-verify npx tsx scripts/case-loops/law/amends-census.ts
npx tsx scripts/case-loops/law/fix-proposal-trigger-007.ts
PGLITE_PATH=./.pglite-copy-law-007-verify npx tsx scripts/case-loops/law/amends-regen-007.ts
PGLITE_PATH=./.pglite-copy-law-007-verify npx tsx scripts/case-loops/law/validate-amends-regen-007.ts
npx tsx scripts/case-loops/law/measure-precision-007.ts
PGLITE_PATH=./.pglite npx tsx scripts/case-loops/law/diff-amends-regen-deletions.ts \
  --payload=docs/data-analysis/case-law/payloads/batch-007-amends-regen.json
# expect: 581 edges, validator 5/5 PASS, precision 577/581 high_confidence, 0 unallowlisted deletions
```

**`apply-amends-regen.ts` is NOT re-pointed at this payload and must not be run unmodified against
it** — its `NODE_PAYLOAD`/`EDGE_PAYLOAD`/`REPORT_OUT` constants and
`EXCLUDED_LOW_CONFIDENCE_EDGES` list still name batch-005's files. Its own startup assertion will
refuse to run against batch-007's payload as-is (safe failure) — re-pointing it is a prerequisite
for any live apply, not something this batch performed (per an explicit out-of-boundary
instruction; a concurrent sibling agent owns generalizing that script's pattern).

**Recommendation: dispatch one more independent Opus audit, narrowly scoped to the round-2 delta**
(the `REPEAL_MARKER`/`NON_AMEND_ART_HEADING_RE` logic in `amends-census.ts` and the
`repealedRefsByCislo` union-suppression in `amends-regen-007.ts`) before any live apply. The rest
of this payload has already cleared an independent audit and should not need re-litigating.

## 3. Shared-file additions (append verbatim — could not edit these in fleet mode)

### → `patterns.md`
```
### Law: a per-citation/per-ref exclusion rule must check "is this identifier ALSO real
elsewhere" before suppressing it, not just "does it appear in an excluded context somewhere"
batch-007's first attempt at excluding repeal/transitional-provision false edges structurally
(rather than via a title-level regex) unconditionally suppressed any title-derived ref that ALSO
appeared near a repeal/transitional heading anywhere in the bill -- which wrongly zeroed 24 bills'
GENUINELY REAL edges, because a transitional article routinely re-cites the very law being amended
elsewhere in the SAME bill (normal Czech drafting convention, not a defect). The bug was caught
immediately by an abnormal count spike on re-run (585 edges / 9 no-data bills -> 546 edges / 33
no-data bills), not by inspection -- the fix cross-checks the ref against the bill's own genuinely-
real citation list (realLaws) before suppressing it via the excluded-context signal. -> any
future per-ref exclusion rule in this pipeline (or similar corpus-wide keyword-proximity logic)
needs the same two-sided check: presence in an excluded context is necessary but not sufficient
for exclusion when the SAME identifier can legitimately also be real.

### Law: \w in a JavaScript regex is ASCII-only and silently fails on Czech diacritics, even with
the /u flag
A heading-blacklist regex `P[řr]echodn\w*\s+ustanoven[íi]` (meant to match "Přechodné ustanovení")
compiled without error and simply never matched, because `\w*` cannot consume the accented "é"
before the required `\s+` -- the regex engine backtracks \w* to zero width and then fails against
the non-word "é" character, with no runtime signal that anything is wrong. This is NOT the same
bug class as P42 (substring-collision from .includes() instead of word-boundary regex) -- it is a
character-class bug that produces a regex which LOOKS correct, compiles correctly, and fails
silently only on non-ASCII input. -> any new regex written against Czech legal/legislative text in
this codebase that needs to span a variable-length adjective ending or similar gap should use \S*
(or an explicit Czech-letter class) instead of \w*, and should be smoke-tested against a real
diacritic-bearing example before being trusted, not just against an ASCII stand-in.
```

### → `feature-opportunities.md`
```
### Law: the census's structural repeal/transitional-provision detection (batch-007) is a
reusable primitive for a `repeals` relation, if the case ever wants to model it explicitly
`amends-census.ts` now structurally identifies (not just excludes) repeal clauses ("Zrušovací
ustanovení" / "Zrušují se: N. Zákon č. X/Y Sb.") and transitional-provision companion articles that
cite a predecessor law, capturing the ref into a new `repealedRefs` census field per bill (64/140
bills, 103 refs corpus-wide). Currently used only to suppress these refs from becoming `amends`
edges. The batch-006 kernel's still-open "decide the repeal-vs-amend modeling question explicitly"
item (a separate `rel: "repeals"` vs excluded entirely) now has a ready-made data source if a
future batch wants to wire `repeals` edges into the graph rather than just discard the citations.
```

### → `frontier.md` (Case ③ section)
```
- **batch-007's amends regen is still NOT applying, despite passing an independent audit and
  extensive driver-side fixes** -- an independent Opus audit found the payload READY WITH CAVEATS
  (3 cheap required fixes, all applied); a SEPARATE reflection pass then found the first fix
  incomplete (2 more false edges the title-level gate missed -- one hidden by a 200-char graph
  label truncation, one a mixed-title bill) plus a genuinely NEW false-edge class (transitional-
  provision companion articles citing a predecessor law, e.g. tisk 64 -> 25/2017). The driver
  replaced the title-level gate with a structural, per-block exclusion in the census extractor
  itself, self-caught and fixed a resulting bug (an unconditional suppression that wrongly zeroed
  24 bills' real edges), and extensively self-verified the result (581 edges, validator 5/5,
  precision 577/581 high_confidence, 0 unallowlisted deletions, a corpus-wide repeal-heading
  sweep). This LAST round of fixes has not itself been independently re-audited -- the
  orchestrator's next step is a narrowly-scoped THIRD Opus pass targeted at exactly that delta
  (REPEAL_MARKER/NON_AMEND_ART_HEADING_RE + the union-suppression cross-check), not a full re-audit
  of everything already cleared. Per the kernel's deferred-three-batches rule this cannot roll a
  fourth time without landing or being explicitly retired.
- **N1 (the ČÁST/bare-§ recall gap) and the original N2 (6 false edges) are CLOSED and
  independently confirmed** -- the census now handles Čl., ČÁST, and single-subject-with-title-gate
  structures; recall recovered exactly the audited-predicted +29 citations across the 7 named
  omnibus bills.
- **`apply-amends-regen.ts` (batch-006) remains valid, tested machinery but is explicitly NOT
  re-pointed at the batch-007 payload** -- re-pointing it (new payload paths, a fresh exclusion
  list re-check against whatever payload eventually lands) is a prerequisite for any live apply,
  intentionally left to whichever agent generalizes that script's pattern next, per this batch's
  fleet boundary.
```

### → `graph-log.md`
```
## Pass N (track: law) — Case ③ batch-007: census extractor fixed (ČÁST/bare-§ splitter closes
N1's recall gap, structural repeal/transitional detection closes N2 + 4 more false edges found
across two independent Opus passes), payload extensively self-verified but not yet applied
(2026-07-25)
No graph writes this batch (all analysis on an isolated .pglite-copy-law-007 copy, removed after
use). amends-census.ts's extractRealAmendedLaws rewritten to split bill bodies on Čl. (unchanged),
ČÁST headings gated on a "změn[aiy]" sub-heading match (closes the batch-006-audited N1 recall gap
-- recovered exactly the predicted +29 citations across 7 named omnibus bills), a title-verb gate
for single-subject bills, and (added after an independent Opus reflection pass found the first
attempt incomplete) a structural per-block exclusion for repeal clauses and transitional-provision
companion articles (REPEAL_MARKER / NON_AMEND_ART_HEADING_RE), which closed 4 false edges beyond
the original batch-006 N2 list (tisk 116/129/231/64) -- 2 of which a title-level regex approach
could not reach at all (a truncated bill label, a mixed real-amend/repeal title). An independent
Opus audit (separate agent, maximum depth) verdict: READY WITH CAVEATS (3 required fixes, all
applied); a SEPARATE reflection pass then found the first fix's scope incomplete and a bug in the
driver's own remediation code (an unconditional per-ref suppression that briefly zeroed 24 bills'
real edges before being self-caught via an abnormal count spike on re-run). Final payload: 581
edges (150 live -> 581, +435/-4, all 4 deletions justified and allowlisted), validator 5/5 PASS (2
new checks: provenance shape, independently re-derived act-type gate), precision 577/581 (99.3%)
high_confidence with all 4 low-confidence edges hand-verified real, 5 distinct missing law-node
statutes honestly reported (NOT claimed as a closed citation universe). This final round of fixes
has not itself been independently re-audited -- disclosed, not smoothed over; recommendation is a
narrowly-scoped follow-up audit, not a full fourth cycle. Live graph untouched (150 amends edges
throughout). npm run check green on this batch's files (typecheck/lint clean; 3 typecheck errors
remain in a concurrent sibling case's unrelated, explicitly out-of-boundary files; tests 285/285).
```

## 4. Enum / schema proposals

None new this batch. The `repealedRefs` census field and the feature-opportunities entry above
note a potential future `repeals` relation, but this batch does not propose adding it — the
kernel's "decide the repeal-vs-amend modeling question explicitly" item (batch-006's minimum-to-
ready list) is addressed by EXCLUDING repeal citations from `amends` (the decision), not by adding
a new edge kind.

## 5. Commit plan (orchestrator; per-case commit inside law boundary)

**Nothing committed this batch** (per Authority — no exceptions).

**Uncommitted work, all within law boundary**:
- `scripts/case-loops/law/amends-census.ts` (modified — the ČÁST/bare-§/repeal/transitional
  splitter fix)
- `scripts/case-loops/law/amends-regen-007.ts` (new)
- `scripts/case-loops/law/fix-proposal-trigger-007.ts` (new)
- `scripts/case-loops/law/validate-amends-regen-007.ts` (new)
- `scripts/case-loops/law/measure-precision-007.ts` (new)
- `scripts/case-loops/law/diff-amends-regen-deletions.ts` (modified — 4-entry deletion allowlist)
- `docs/data-analysis/case-law/batch-007.md` (new) — full narrative
- `docs/data-analysis/case-law/handoff.md` (this file, replacing batch-006's)
- `docs/data-analysis/case-law/ledger.json` (updated — `batch007CensusFix`/
  `batch007IndependentAudit`/`batch007Reflection` summary blocks added to `totals`)
- `docs/data-analysis/case-law/payloads/batch-007-amends-census.json` (new)
- `docs/data-analysis/case-law/payloads/batch-007-amended-laws-full-proposal.json` (new)
- `docs/data-analysis/case-law/payloads/batch-007-amended-laws-full-proposal-v2.json` (new)
- `docs/data-analysis/case-law/payloads/batch-007-amends-regen.json` (new)
- `docs/data-analysis/case-law/payloads/batch-007-amends-regen-impact.md` (new)
- `docs/data-analysis/case-law/payloads/batch-007-precision-measurement.json` (new)

Suggested message (Conventional), for whatever the orchestrator folds together:
```
docs(case-law): batch-007 fixes census recall gap (N1) + repeal/transitional false-edge class
(N2 + 4 more), extensively verified but holds live apply pending one more targeted audit

Law loop batch-007 — fixed amends-census.ts's Čl.-only article splitter (batch-006 N1): now
handles ČÁST-organised and bare-single-subject bills via a title-verb gate, recovering exactly
the audited-predicted +29 citations across 7 named omnibus bills. An independent Opus audit
found the resulting payload READY WITH CAVEATS (3 cheap fixes, applied); a separate reflection
pass then found the fix's scope incomplete (2 more false edges a title-level gate structurally
could not reach: a truncated bill label, a mixed real-amend/repeal title) plus a genuinely new
false-edge class (transitional-provision companion articles citing a predecessor law). Replaced
the title-level approach with a structural per-block exclusion in the census extractor itself
(REPEAL_MARKER/NON_AMEND_ART_HEADING_RE); self-caught and fixed a resulting bug (an unconditional
suppression that briefly zeroed 24 bills' real edges). Final payload: 581 edges, validator 5/5
PASS (2 new checks: provenance shape, independently re-derived act-type gate), precision 577/581
high_confidence (all 4 low-confidence edges hand-verified real), 5 missing law-node statutes
honestly reported (citation universe NOT claimed closed). This final round of fixes has not
itself been independently re-audited -- disclosed as an open item; recommend one narrowly-scoped
follow-up Opus audit before any live apply, not a full fourth cycle. npm run check green on this
batch's files (typecheck/lint clean; tests 285/285).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 6. Lessons learned

See `batch-007.md` §9 for the full text (4 lessons): (1) a recall claim needs a structural check,
not just a citation-resolution count — confirmed a third time; (2) `\w` in a JS regex is
ASCII-only and silently fails on Czech diacritics even with `/u` — a genuinely new, narrow bug
class worth a repo-wide grep habit for future Czech-text regexes; (3) a per-ref exclusion rule
needs to check "is this identifier ALSO real elsewhere" before suppressing it, not just "does it
appear in an excluded context somewhere" — the self-caught 24-bill regression's general lesson;
(4) the same adversarial-second-pass discipline that caught real bugs in batch-005/006's
extraction now caught real bugs in batch-007's own REMEDIATION of that extraction, one level
deeper each time — three consecutive batches, three different objects, same doctrine holding up.
