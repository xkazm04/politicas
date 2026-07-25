# Case ③ Law loop — batch-007 (2026-07-25)

Fleet run (an insert-path executor works concurrently in `scripts/case-loops/apply-batch*` +
`lib/analysis/kg-verdict.ts` — stayed out of both). Job: fix the defect that has held the `amends`
regeneration (150 → ~586 edges) at the orchestrator three times. Batch-006's independent audit
found the concrete rework target: **N1** (the census extractor's `Čl.`-only article splitter is
blind to `ČÁST`/`§`-organized bills, undercounting ~29 true amending edges across 7 high-value
omnibus bills) and **N2** (6 confirmed false edges surviving in the 567). No live `.pglite` writes,
no shared-vault edits, no commits — all analysis on an isolated `.pglite-copy-law-007` copy
(a fresh `cp -r` of `.pglite-copy-law-005`, which already carries the 187-node missing-law-node
ingest), removed after use.

**Bottom line: the census extractor is fixed and the payload is materially better than any prior
batch — but this report does NOT declare it unconditionally ready.** An independent Opus audit
found it READY WITH CAVEATS (3 fixes applied same-session); a second, separate Opus reflection
pass then found the first fix incomplete and caught a genuinely new false-edge class, which
required a THIRD round of fixes. That third round has been extensively self-verified but has
**not** itself been independently re-audited by a fresh agent — disclosed honestly below, per the
kernel's doctrine that self-review is a weaker check than a genuinely separate agent's, no matter
how rigorous it feels.

## 1. The splitter fix — what structures it now handles

`scripts/case-loops/law/amends-census.ts`'s `extractRealAmendedLaws` was rewritten to handle three
bill structures instead of one:

1. **`Čl. N` article-organised bills** (unchanged, proven logic — batch-001 through batch-006's
   live 150 edges) — each numbered article amends exactly one target statute, cited near the
   article's top.
2. **`ČÁST <ordinal>` part-organised bills** (the N1 fix) — each `ČÁST` that amends another statute
   carries a "Změna …" sub-heading right after the label; a part is only searched for a citation if
   its own heading area (320 chars) contains a word-boundary `změn[aiy]` match. This is what
   correctly excludes `ČÁST PRVNÍ` (the bill's own new-law body — never "Změna"), `Zrušovací
   ustanovení` (repeal) parts, and `Účinnost` (effective-date) parts.
3. **Truly single-subject bills** (no `Čl.`, no `ČÁST`) — only treated as an amending novela (and
   searched for a target) if the bill's own title/preamble says so
   (`kterým/kterou/kterými se mění`); otherwise a brand-new standalone act or a bare-§-organised
   bill whose only citations are cross-references or a repeal clause correctly amends nothing.

Structures checked against the real corpus and **not** found to denote amend-block boundaries:
`Hlava`/`Oddíl`/`Díl` — sub-structuring within a bill's own new-law text or within a single
`ČÁST`/`Čl.` block; none of the 141 bills carries a "Změna zákona" sub-heading at that level.

A **second round of fixes**, added mid-batch after the reflection pass (§5), replaced an initial
title-level repeal gate with a **structural, per-block** exclusion:

- `REPEAL_MARKER` — a citation is excluded if a "Zrušovací ustanovení" heading or "Zrušují/Zruší
  se:" repeal-list opener appears within the preceding ~400 chars of the SAME block the citation
  was found in.
- `NON_AMEND_ART_HEADING_RE` — a `Čl.` (or `ČÁST`) block is skipped outright if its own heading
  area (including a short lookback before the marker, for bills that wrap `Čl.` articles inside an
  outer `ČÁST`) names itself "Přechodné ustanovení" (transitional provision), "Závěrečná
  ustanovení", or "Účinnost".
- A footnote-detection fix (N4, unchanged from the first round): `isFootnoteLine` generalized from
  a single-line check to a multi-line block walk-back (footnote continuations, tisk 69's
  `381/1991` class).

Every excluded block's ref (if any) is captured into a new `repealedRefs` census field — used
downstream by the regen script to suppress the SAME ref if it also arrives via the title-derived
union, and reported for transparency (64 of 140 bills carry at least one `repealedRefs` entry, 103
total).

## 2. Census delta — recall recovered vs the ~29 predicted

Full re-run: 140/141 bills checked (tisk 87 skipped, no PDF — unchanged from every prior batch).

**Recall recovered on the 7 named omnibus bills matches the audit's prediction exactly**: tisk 250
(1→10, +9), 69 (1→7, +6 net — its old single citation, `381/1991`, was itself the false-footnote
edge), 10 (1→4, +3), 54 (1→4, +3), 113 (1→4, +3), 189 (1→4, +3), 228 (1→3, +2) = **29 net new real
citations**, verified independently by both the audit (re-implementing the extractor from scratch
and replaying it against all 140 cached bills — 0 mismatches) and a corpus-wide diff against the
pre-fix census.

**Is the citation universe now closed? No — closer than any prior batch, but not closed.**
`stats.distinctMissingLawStatutes: 5` (132/2010, 330/2025, 387/2024, 505/1990, 539/1992 — 8
citations, later 5 after the round-2 repeal fixes removed some of the citations that had been
driving that count) — these are statutes the fixed extractor now correctly SEES as cited but that
have no corresponding `law` node yet (a missing-law-node ingest, not built this batch, reported
honestly rather than silently dropped). batch-005/006's prior "0 missing statutes" claim was
itself an artifact of the broken extractor never finding these citations at all — this batch's
honest 98.6% figure is a genuine improvement, not a new problem.

**Regression test**: a standalone 12-bill harness (the 7 named omnibus bills + 5 additional
false-edge cases found during investigation: 63/76/144/6/55) run against cached PDF text with no
network fetch — all 12 match the predicted/audited structure exactly.

## 3. Precision — re-measured and hand-verified

`scripts/case-loops/law/measure-precision-007.ts` (adapted from batch-006's, same amending-verb
proxy method, ±2500 chars of `se mění|se ruší|se vkládá|se nahrazuje|zní:`) against the final
581-edge set:

- **577/581 (99.3%) high_confidence, 4/581 (0.7%) low_confidence, 0 unresolvable.**
- The 4 low-confidence flags were **hand-verified**: 3 are the same proxy false-negatives already
  established real in batch-006 (tisk 7→87/1995, tisk 10→141/1961, tisk 64→99/1963 — long
  amendment-history lineage lists push the verb marker outside the proxy's ±2500-char window), and
  the 4th (tisk 250→2/1969, one of the NEW recovered edges) was independently confirmed real by
  reading the cached text directly (`.data/law-collision-cache/tisk-250/277952.txt`, "Zákon č.
  2/1969 Sb. … se mění takto:" with ~90 lines of lineage citations in between).
- **A fresh random sample of the 29 newly-recovered edges was spot-checked** against cached text
  (tisk 10→104/2013, tisk 54→372/2011, tisk 113→147/2002, tisk 189→17/2012 — all confirmed real,
  each sitting immediately before a "se mění takto:" marker) — 0 false positives found in this
  sample, on top of the systematic per-block structural verification in §1-2.
- **A corpus-wide sweep for residual repeal/transitional false positives** (every "Zrušovací
  ustanovení"/"Přechodné ustanovení" heading in the 141-bill corpus, checked against whether its
  nearby citation also appears in that bill's own `realLaws`) found no additional leaks beyond the
  4 the reflection pass named — the flagged co-occurrences are the expected, harmless pattern of a
  transitional article legitimately re-citing the SAME law a real block elsewhere amends.
- **A known proxy blind spot, disclosed rather than hidden**: the proxy's verb set includes `se
  ruší` (repeal), so it cannot itself distinguish an amendment from a repeal — that class is
  excluded upstream, structurally, before an edge ever reaches this measurement (see §1's
  `REPEAL_MARKER`/`NON_AMEND_ART_HEADING_RE`).

## 4. The payload

`docs/data-analysis/case-law/payloads/batch-007-amends-regen.json` — **581 edges** (live 150 →
581, net +431: +435 additions, −4 deletions). Deletion allowlist (P50) in
`scripts/case-loops/law/diff-amends-regen-deletions.ts`, 4 entries, all confirmed-false edges that
predate this batch and are now correctly excluded:

| live edge | why false |
|---|---|
| `bill:tisk:43226 -> law:sb:353-2019` (tisk 116) | pure-repeal bill title |
| `bill:tisk:43250 -> law:sb:223-2016` (tisk 129) | pure-repeal bill title (verb past the graph's 200-char label truncation) |
| `bill:tisk:43353 -> law:sb:348-2005` (tisk 231) | mixed title — real amendments kept, this one repeal target dropped |
| `bill:tisk:43171 -> law:sb:25-2017` (tisk 64) | transitional-provision companion article citing a predecessor law inside an otherwise-real 147-target omnibus |

`scripts/case-loops/law/validate-amends-regen-007.ts` — 5 checks, all PASS, 0 errors, 0 warnings:
id-membership, no duplicates, no fabrication, provenance shape (the full 5-field kernel contract —
N3 fix), and an **independently re-derived** act-type gate (re-reads each edge's target law node's
own `esbirka_title` directly, not the generator's `excludedNonActRefs` list).

`scripts/case-loops/law/diff-amends-regen-deletions.ts` (read-only against the LIVE `./.pglite`) —
0 unallowlisted deletions.

## 5. Independent audit (Opus #1, maximum depth) — verdict VERBATIM

Dispatched as a genuinely separate agent, no memory of the driver's work, briefed adversarially to
find every reason the payload must not be applied. Full report preserved verbatim in `handoff.md`
§0. Overall verdict, quoted exactly:

> # **READY WITH CAVEATS** — conditional on three mechanical preconditions
>
> The regeneration itself is **sound and materially better than batch-005/006**. This is the first
> batch in this sequence where I could not find a structural defect in the core extraction: the
> ČÁST gate is correct on every bill in the corpus in both directions, the census is bit-for-bit
> reproducible from the committed code and cached inputs, N1 is closed with exactly the predicted
> +29, N2's 6 false edges are structurally impossible rather than allowlisted away, and the
> validator's two new checks genuinely re-derive rather than re-assert. Precision at the *census*
> layer is, as far as I can determine by structural reading, clean.
>
> **The three blockers are all outside the census and all cheap:**
>
> 1. **Drop the tisk-116 → 353/2019 edge** … or gate the title path on `kterým se zrušuje`. (N-A)
> 2. **Refresh `apply-amends-regen.ts` before any live run** … (N-C)
> 3. **Fix the two artifact-prose defects**: `measure-precision-007.ts:152`'s "567" … and the
>    payload `caveats` block's silence on the 5 missing statutes + tisk 116. (N-D, N-I)
>
> **On the "citation universe closed" question: this payload must NOT claim closure, and it does
> not.** … The honest framing is: "closer than any prior batch, and now measurable — not closed."

Full verdict verbatim, including all D1-D11 verdicts, N-A through N-I new defects, and clean
checks, in `handoff.md` §0.

**Driver's response**: applied fixes for N-A (a title-level `REPEAL_TITLE_RE`/`AMENDING_TITLE_RE`
gate, narrowed to pure-repeal titles after a self-caught over-broad first attempt — see §6) and N-D
(stale "567" count, stale caveat). **N-C was deliberately NOT fixed** — the driver's own brief
explicitly says "do NOT rebuild" `apply-amends-regen.ts` (a concurrent sibling agent owns
generalizing its pattern) — instead documented as a required pre-apply step in the payload's own
`boundary` field, not smoothed over.

## 6. Second Opus call — reflection — verdict and a bug it caught

A genuinely separate second Opus agent reviewed THIS BATCH'S OWN deliverables (not the underlying
legislative payload again) for internal consistency and self-serving framing — the exact same
kernel discipline batch-006's reflection used, which caught a real bug there too. Full report
preserved verbatim in `handoff.md` §0b. Headline finding, quoted exactly:

> ## VERDICT: **NOT ready as reported.** Four real defects, one of them the same class the
> batch-006 reflection caught. The core extraction work is sound and reproducible; the
> *remediation claims* are overstated.

It found:

- **The N-A fix was incomplete** — `tisk 129`'s repeal-verb title text sits past the graph's
  200-character `label` truncation (74/140 bills have a truncated label), so the title-level regex
  never fired; `tisk 231`'s MIXED title ("kterým se mění … a kterým se zrušuje …") legitimately
  carries both a real amend target and a repeal target, and a first, over-broad version of the
  title gate had wrongly blanked its two real amendments too.
- **A genuinely NEW false-edge class**, `tisk 64`'s `Čl. CXLIII "Přechodné ustanovení"` — a
  transitional-provision companion article citing a predecessor law inside an otherwise-real
  147-target omnibus, the same class batch-006 found once on tisk 6 → 424/1991, recurring here one
  level deeper.
- **Self-serving framing**: `amends-regen-007.ts`'s `boundary` field asserted `apply-amends-
  regen.ts` was "re-pointed at this payload" when it was not (an accurate-sounding claim that
  described the INTENT, not the actual file state).
- Smaller: a stale "8 bill-citations" attribution in the console/impact-md summary (actually 5
  missing-node + 3 non-act, later resolved to 5+0 by the round-2 fix); dangling references to a
  `batch-007.md` that did not yet exist.

**Driver's response, fixed same session**: moved the repeal/transitional exclusion from a
title-level regex to a **structural, per-block** check in `amends-census.ts` (§1's
`REPEAL_MARKER`/`NON_AMEND_ART_HEADING_RE`) — this closed all 4 named false edges. One bug was
**self-caught during this fix**, not by any external review: an initial version of the per-block
exclusion unconditionally suppressed a title-derived ref present in ANY repeal/transitional block
for that bill, even when the SAME ref was ALSO a genuine real target elsewhere in the same bill (a
normal drafting pattern — a transitional article routinely re-cites the very law being amended,
e.g. tisk 11's `589/1992`). This wrongly zeroed 24 bills' real edges (585→546 edge count, no_data
bills 9→33) — caught immediately by re-running the pipeline and noticing the abnormal spike, fixed
by excluding a ref from suppression only when it is NOT also present in the bill's own `realLaws`.
Corrected `boundary`/`caveats` prose to accurately state `apply-amends-regen.ts` is stale and must
not be run unmodified (§5).

**This final round of fixes has NOT been independently re-audited by a fresh agent.** The driver's
own verification (12+ regression bills, a full 140-bill corpus re-run, the validator's 5 checks,
the precision measurement, the deletion-safety diff, and a corpus-wide repeal-heading sweep) all
pass — but per the kernel's own doctrine, proven twice already in this case (batch-005, batch-006),
self-review shares the blind spots of whatever produced the artifact being reviewed. This is
disclosed as an open item, not closed by assertion.

## 7. Apply/don't-apply recommendation

**Do not apply this batch.** Not because a defect was found in the final state — extensive
self-verification and two independent Opus passes (one of which found real, materially significant
bugs in an EARLIER version of this batch's own fix) all pass on the current payload — but because
the kernel's own doctrine, validated three times now in this exact case loop (batch-005, batch-006,
and this batch's own reflection), is that a self-review — however rigorous — is a structurally
weaker check than a genuinely separate agent's fresh look, precisely because it shares the same
blind spots as whatever produced the artifact under review. This batch's LAST round of fixes
(§6 — the structural repeal/transitional exclusion) has not received that check.

**Concrete recommendation for the orchestrator**: dispatch one more independent Opus audit
targeted specifically at the round-2 delta (the `REPEAL_MARKER`/`NON_AMEND_ART_HEADING_RE` logic
and the `repealedRefsByCislo` union-suppression in `amends-regen-007.ts`) before any live apply.
Everything else in this payload — the ČÁST splitter, the recall recovery, the missing-law-node
honesty, the validator, the precision measurement — has already cleared an independent audit and
should not need to be re-litigated. This is a narrow, cheap follow-up check, not a fourth full
audit cycle, and per the kernel's "deferred-three-batches" rule this item should land or be
explicitly retired at that point — it cannot roll a fourth time.

`apply-amends-regen.ts` (batch-006) remains valid, tested machinery for a future payload but is
**not** re-pointed at this one and must not be run unmodified against it (see §5's N-C, and the
payload's own `boundary` field).

## 8. `npm run check`

- **typecheck**: green on every file this batch touched; the only remaining repo-wide error is in
  `scripts/case-loops/apply-batch.ts`/`.test.ts` — a concurrent sibling case's in-progress files,
  explicitly out of this case's fleet boundary (the brief names `apply-batch*` and `kg-verdict.ts`
  as off-limits), not touched this batch.
- **lint**: clean on every file this batch created or changed (targeted `eslint` runs against
  `amends-census.ts`, `amends-regen-007.ts`, `fix-proposal-trigger-007.ts`,
  `measure-precision-007.ts`, `validate-amends-regen-007.ts`, `diff-amends-regen-deletions.ts`).
- **tests**: 285/285 green, both before and after this batch's changes.

## 9. Lessons learned

1. **A recall claim needs a structural check, not just a citation-resolution count** — confirmed a
   third time (patterns.md already carries this from batch-006; this batch is the corroborating
   fix, not a new instance of the bug).
2. **`\w` in a JavaScript regex is ASCII-only and silently fails to match Czech diacritics even
   with the `/u` flag** — `P[řr]echodn\w*\s+ustanoven[íi]` looked correct, compiled without error,
   and silently never matched "Přechodné ustanovení" because `\w*` cannot consume the "é" before
   the required `\s+`. This is a genuinely new, narrow, and easy-to-repeat bug class for this
   codebase's Czech-text-processing scripts — worth a repo-wide grep the next time any new Czech
   heading/keyword regex is written (`\S*` or an explicit accented-letter class, not `\w*`, for any
   gap that must cross a diacritic).
3. **A per-citation exclusion needs to check "is this ref ALSO real elsewhere" before suppressing
   it** — the self-caught bug in §6 (24 bills' real edges wrongly zeroed by an unconditional
   repeal-context suppression) is a specific instance of a general pattern: any block-level or
   ref-level exclusion rule risks over-firing when the SAME identifier legitimately appears in both
   an excluded context and a real one within the same unit (here: a bill). The fix (check the
   OTHER source of truth — `realLaws` — before excluding) generalizes to any future per-ref
   suppression logic in this pipeline.
4. **The same adversarial-second-pass discipline that caught real bugs in batch-005/006's
   extraction now caught real bugs in batch-007's OWN REMEDIATION of that extraction, one level
   deeper each time** — this is the third consecutive batch where an independent check (audit or
   reflection) found something a same-session self-check missed, on three different objects
   (batch-005: the original extraction; batch-006: the driver's own precision review of that
   extraction's residue; batch-007: the driver's own fix of the extraction itself). The doctrine
   holds up under repeated, harder tests — worth treating as settled rather than re-litigating each
   batch.
