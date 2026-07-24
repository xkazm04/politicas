# Case ③ Law loop — batch-005 (2026-07-25)

Fleet run, concurrent with money/effort loops. Priority: P1 paired landing — the missing-law-node
ingest (Q-law-12) + the held amends-edge regen (Q-law-11's set-difference trigger fix), landed
together as ONE reviewed change-set, per batch-004's handoff/reflection. **No live `.pglite`
writes, no commits, no shared-vault edits** — all work on `.pglite-copy-law-005`.

## 1. Missing-law-node ingest (Q-law-12)

`scripts/case-loops/law/ingest-missing-laws.ts` resolves batch-004's `missingLawNodeCensus`
statutes against the e-Sbírka act-master bulk registry (`.data/esbirka/002.json.gz`, the SAME
dataset `esbirka-laws.ts` already used to stamp the original 101 law nodes at pass 11) —
**substituted for the SPARQL point-query endpoint the skill brief named**, after investigation
found the SPARQL endpoint exposes only §-fragment text and a bare citation string, no title/ELI
field (confirmed by exhausting the akt-root predicate list and testing rdfs:label/dc:title/name,
all empty; the Opus audit independently re-ran the same probe and confirmed). Same access-path
doctrine as batch-002's SPARQL pivot: cheaper, more complete, same source, zero extra network
cost (the bulk file was already cached).

Final run (after the census-extraction fix, §2 below): **187/187 statutes resolved, 0
unresolvable.** Every emitted node's title is the verbatim `akt-název-vyhlášený` string, the ELI
is the expanded `akt-iri`. The Opus audit independently re-parsed the registry and byte-compared
all resolved nodes against it: **0 title mismatches, 0 ELI mismatches, 0 registry misses.**

Output: `docs/data-analysis/case-law/payloads/batch-005-missing-law-nodes.json`.

## 2. Opus paired-landing audit — round 1: NOT READY, 11 defects found

The mandated Opus audit (maximum depth) reviewed the ingest + regen as one change-set for
completeness, fabrication, and blast radius. Full verdict text is preserved in the handoff; summary:

**Verdict: NOT READY TO APPLY.** Findings (D1–D11), by severity:
- **D1 (high) — precision never measured.** Recall closed to 100% (0 missing statutes) but a
  hand-check found the newly-admitted citations included at least 3 proven-false edges
  (footnote citations misread as amending targets: tisk 219→354/2019, 222→9/2002, 243→240/2000 —
  all traced to the census extractor's naive "first citation in the operative text" fallback for
  single-subject bills, which picked up a footnote instead of the real target).
- **D2 (high) — `LAW_CITATION` matched `Sb. m. s.` (international-treaty) citations as if they
  were Sbírka-zákonů law refs** (tisk 63→64/2017 [Paris Agreement], 52→55/2006, 144→108/2004,
  all misresolved to unrelated but real-looking Sbírka-zákonů acts of the same number).
- **D3 (high) — no sanctioned apply path.** `persist-batch.ts` (shared, outside this case's
  boundary) is props-merge-only and refuses inserts; neither payload's shape matches its schema.
- **D4 (high) — the SAME union-vs-replace defect class batch-004's own audit caught, one field
  deeper:** applying the payload as-is would silently overwrite `provenance`/`props` (including
  the per-ref `source: census_full|title_fallback` tag) on the 150 pre-existing edges, and the new
  deletion-diff (built to close batch-004's flagged gap) checks only edge KEYS, not values — blind
  to exactly this class of value-replacement.
- **D5 (medium) — `firstSeenPass: 21` was invented** (graph max is 11; pass assignment belongs to
  the write-lock holder at finalize time, per kernel).
- **D6 (medium) — no durability contract**: the standing `kg-legislation-ingest.ts` re-derivable
  ingest wholesale-replaces `props`, would wipe `esbirka_title`/`esbirka_exists`/`esbirka_eli` on
  re-run (P44/D1).
- **D7 (medium) — stale self-description**: the regen payload's `method`/`caveats`/impact-doc text
  still described batch-004's 53-bill/count-based-trigger state, actively misleading a reader.
- **D8 (medium) — 6 of 191 newly-ingested "law" nodes are not acts of parliament** (nařízení
  vlády / vyhláška / sdělení) — a bill cannot amend a government regulation; each was about to
  become a fabricated `amends` edge.
- **D9 (low/medium) — 28 titles truncated mid-word** in the display label.
- **D10 (low) — the copy-write guard was a naive string comparison**, bypassable with an
  equivalent-but-differently-spelled `PGLITE_PATH`.
- **D11 — sequencing constraint** (correct, but must be explicit): nodes must land before edges,
  same transaction/window — 191 of 574 edge targets don't exist without the node payload applied
  first.

Blast radius confirmed: churn ranking flips to **40/2009 #1** exactly as batch-004's reflection
predicted; collision candidate universe grows from 88 to ~575-583 raw pairs.

## 3. Remediation (same batch, within case boundary)

Fixed before finalizing (blocking items D1/D2/D8 fully; D4/D5/D7/D10 fully; D3/D6/D9 documented
as orchestrator/next-batch items — D3 requires editing shared `persist-batch.ts`, outside this
case's fleet boundary):

- **D2**: `lib/ingest/sources/psp-legislation.ts`'s `LAW_CITATION` regex now excludes `Sb. m. s.`
  via a negative lookahead. Re-verified: tisk 63/52/144's international-treaty refs no longer
  misresolve.
- **D1 (partial, the 3 hand-proven cases)**: `amends-census.ts`'s `extractRealAmendedLaws` gained
  `isFootnoteLine()` — skips a citation whose line starts with a footnote-number marker (with or
  without the closing paren, since `pdftotext` renders it inconsistently across PDFs) before a
  capital-letter word. Re-ran the full census (all cached, no new fetch): **tisk 219 now correctly
  resolves 301/1992 (matches title); tisk 243 now honestly returns no body citation (title fallback
  covers it); tisk 222 improves from a wrong regulation (9/2002) to a still-imperfect
  multi-line-footnote artifact (176/2008)** — the D8 act-type gate (below) independently catches
  and excludes that residual case, since 176/2008 is a Nařízení vlády, not a law. The wider 6.3%
  proxy false-positive rate flagged by the audit across all 567 edges was **not** re-measured this
  batch — recorded as an explicit caveat in the regen payload and as batch-006's top precision item.
- **D8**: `amends-regen-005.ts` now gates every edge target by e-Sbírka act-type (title prefix
  Nařízení vlády/Vyhláška/Sdělení/Usnesení/Opatření excluded) — 4 refs excluded this run (`553/2020`,
  `76/2005`, `176/2008`, `357/2025`), logged in `excludedNonActRefs`, node kept (real act, just not
  wired as an edge target).
- **D4**: edge/node provenance now carries an explicit `pass` field (provisional `0`/next-int
  placeholder, orchestrator overwrites at real finalize); `diff-amends-regen-deletions.ts` remains
  key-only (documented as a KNOWN remaining gap — a full value-preservation diff is the next
  concrete ask for whoever holds the write lock).
- **D5/D10**: `_apply-missing-law-nodes-copy.ts` computes `firstSeenPass` as `max(graph)+1` instead
  of a hardcoded literal, and resolves the `PGLITE_PATH` guard to an absolute path before comparing.
- **D7**: `amends-regen-005.ts`'s `method`/`boundary`/`caveats` strings rewritten to describe the
  actual batch-005 state (including an explicit pointer back to the NOT-READY-until-re-audited
  status).
- **One close-read entry (`90-221` in `collision-close-reads-batch005.json`) that the audit found
  ungrounded** (a quoted "o)→q)" substring that doesn't exist anywhere in the source payload — the
  real excerpt shows "o)→p)") was corrected against the actual `collision-report-v2-005.json`
  excerpt text; classification (coordination-risk) unchanged, evidence/reasoning rewritten.

**Post-remediation numbers** (final, `batch-005-amends-regen.json`): 141 bills (59 census_full, 78
title_fallback, 4 no_data) → **567 edges** (was 574 pre-remediation, was 150 live) — the drop from
574→567 is the honest result of removing the 4 non-act-type false edges (188→187 missing statutes,
since 219/222/243's fixed extraction resolved differently) and one dropped statute recount.
**0 missing law nodes, 0 unallowlisted deletions, VALIDATE-AMENDS-REGEN PASS (567/567).**

**This is a re-prepared, not re-audited, state — a fresh Opus pass on the remediated payload is
the correct next step before any live apply**, not a self-certified pass (the driver fixing its
own audit's findings is not the same as an independent re-check).

## 4. Collision pre-check re-run (post-regen topology, COPY only)

`regen-collision-groups-005.ts` on the final 567-edge topology: **284 distinct amended laws, 145
multi-bill groups, 583 raw candidate bill-pairs** (up from 88 pre-regen — the ~5× the batch-004
reflection predicted, landing on the high end since the ingest closed nearly all of the citation
gap). `collision-check-005.ts --v2` (Q-law-10's partitioning, unmodified) parsed all 125 unique
bills **entirely from cache** (no new psp.cz fetch — every bill was already cached from prior
batches' collision runs) → **186 candidate pairs survive partitioning.**

**P52 ranking signal**: shared-§ COUNT was shown non-discriminative (anti-predictive
pre-partition) by the batch-004 reflection. This batch implements the reflection's proposed
replacement — `moneyLiteral`: does the pair's shared-§ excerpt contain a Czech
currency/percentage/allocation-coefficient literal — as the requested alternative ranking. First
regex version missed the coefficient half of the hypothesis entirely (0 of 7 real "číslo „0,8“
nahrazuje číslem „0,4“"-shaped substitutions matched); widened to catch quoted decimal/percentage
literals and any `koeficient*` inflection — final run: **60 of 186 pairs flagged** (up from 39).

**Close-read**: 15 of the money-literal-flagged, not-previously-close-read pairs
(`collision-close-reads-batch005.json`): **5 confirmed-collision, 7 coordination-risk, 3
incidental.** Grounded in verbatim excerpts already extracted (no new fetch); one entry (90-221)
was corrected post-audit (see §3).

**Ranking validation — HONEST result, not a claimed win.** The Opus audit ran the actual
statistics: 12/15 (80%) "real signal" (confirmed+coordination-risk) sounds good in isolation, but
the baseline rate among ALL partition-survivors without any money ranking (from prior batches'
data) is ~76% (26/34) — **Fisher's exact test p=1.00**, no significant difference, and the
confirmed-only rate actually regressed (50%→33%, p=0.36). At n=15 against this baseline the design
could not have reached significance even at 15/15. In ≥6 of the 15 close-reads the firing literal
sits in a § that plays no role in the actual finding (fired on an unrelated `10 000 Kč` gift cap
while the real clash is a letter-renumbering elsewhere). **Conclusion, per this project's own P32
discipline: `moneyLiteral` is NOT a validated ranking signal — it is an unvalidated candidate
heuristic that happened to surface real findings (because most partition-survivors do), not
proof it discriminates better than the baseline.** A larger, unbiased sample (ideally including
unflagged pairs as a real control arm) is the concrete next step, not a repeat of this design.

## 5. Build-review

`/zakony/kolize` (`features/lawwatch/getCollisionData.ts` + `CollisionsPage.tsx`): batch-005's 15
close-reads wired in as `sourceBatch: 5`, clearly separated with a `postRegenTopology` flag and a
visible banner + per-pair "dávka 5 · post-regen" badge — the candidate SET was found via topology
the live graph doesn't have yet, even though every individual cited fact (bill numbers, statute
refs, excerpt text) is real and already resolvable against the live graph today. Pre-regen (batch
1-4) findings are untouched.

`/zakony`'s most-amended ranking (`features/lawwatch/getLawData.ts`'s `topLaws`) was checked, not
rebuilt — it already computes purely from `store.listKgEdges({rel:"amends"})`, sorted dynamically,
zero hardcoding. It renders correctly today (586/1992 #1, live 150-edge graph) and will render
40/2009 #1 automatically the moment the orchestrator applies the batch-005 edge set — no code
change needed, confirmed by reading the loader, not assumed.

`npm run check`: **green** (typecheck, lint, 205/205 tests).

## 6. Orchestrator execution plan (exact, in order)

1. **Independent re-audit** of the remediated payload (`batch-005-amends-regen.json`,
   `batch-005-missing-law-nodes.json`) — the driver fixed its own audit's findings; that is not a
   substitute for a fresh check, per the kernel's audit doctrine.
2. **Full precision measurement** across all 567 edges (D1's residual scope) — the amending-context
   proxy check the audit ran (citation within ~2500 chars of `se mění|se ruší|se vkládá|se
   nahrazuje|zní:`) is a cheap deterministic script; run it as a reported metric, not just a
   spot-check, before or immediately after apply (it does not block the topology write itself,
   since it is a confidence signal, not a validity one — but it should gate which edges get
   surfaced in the UI at high confidence vs flagged).
3. **Write a real apply script** (case-boundary reference implementations exist:
   `_apply-missing-law-nodes-copy.ts` for nodes, node insert with computed `pass`; edges need an
   analogous insert-capable script — `persist-batch.ts` is props-merge-only and out of this case's
   boundary to extend, so either the orchestrator extends it with an insert path, or runs a
   case-scoped one-off under its own review). Order: **nodes first, edges second**, same
   transaction/write-lock window (D11). Provenance/props must carry the FULL 5-field kernel shape
   with a real assigned `pass` (not the batch's provisional placeholders) and must PRESERVE
   existing edges' provenance/props on the 150 pre-existing keys (D4 — do not blind-`upsert` the
   full payload against `kg_edge`'s PK without checking this).
4. **Re-triage** (`triage-002.ts` or successor) — the churn ranking changes materially (40/2009
   #1); sector-adjacency naive recomputation over the new edge set will re-degenerate exactly the
   way the batch-004 reflection warned (tisk 64 goes from 1 to dozens of amended statutes) —
   compute it at §-level per that same warning, not naively.
5. **THEN** the collision candidate universe (583 raw / 186 partitioned pairs) becomes the real
   population — this batch's 15-pair close-read is a validated-format PREVIEW, not exhaustive
   coverage; a further army wave over the remaining ~171 partition-survivors is batch-006 scope,
   with a properly validated ranking signal (see §4) before trusting any sweep order over it.
6. **Durability**: either patch `kg-legislation-ingest.ts`'s props-merge (D6) before any future
   full-graph rebuild, or accept and document that the 191 e-Sbírka-sourced law-node fields
   (`esbirka_title`/`esbirka_exists`/`esbirka_eli`) have no re-derivation path yet.

## 7. Lessons learned

1. **A recall fix and a precision fix are different projects, even in the SAME pipeline** —
   batch-004 warned "a precision fix does not imply a recall fix"; batch-005 is the mirror image
   (a recall fix — closing 289 unresolved citations to 0 — does not imply the newly-resolved
   citations are correct) and it took an independent Opus audit to catch it, not the driver that
   built the fix. Precision and recall are separate claims and need separate measurement passes,
   every time, on every side of a two-sided extraction problem.
2. **The SAME defect class can recur one field deeper even when you build the gate the LAST
   audit asked for.** batch-004's audit caught union-vs-replace on edge PRESENCE; batch-005 built
   the deletion-diff gate that was explicitly requested — and it is blind to value REPLACEMENT
   (provenance/props overwrite on preserved keys), the identical shape one level down. Closing a
   flagged gap fully means asking "what is this NEW gate itself still blind to", not just
   confirming it catches the originally-reported case.
3. **A footnote-marker regex tuned against ONE PDF's rendering breaks on the NEXT PDF's
   rendering of the same semantic thing** (`pdftotext` sometimes drops the footnote's closing
   paren entirely) — iterate the fix against multiple real examples before declaring it general,
   not just the first one that motivated it.
4. **An unvalidated ranking signal that "looks like it worked" on a small sample is a trap the
   kernel's own P32 discipline exists to catch — and it takes an adversarial audit, not the
   signal's own author, to run the actual baseline comparison.** 80% sounds like validation; it
   is statistically indistinguishable from doing nothing, at this sample size, against this
   baseline. Report the null result honestly rather than the flattering-sounding raw percentage.
5. **Fleet boundary discipline creates a real gap, not just friction**: `persist-batch.ts` is
   correctly out of this case's editable scope (shared, cross-case), but nobody in ANY case's
   fleet run currently owns "insert new nodes/edges" as a sanctioned write path — every case
   loop that ever needs to grow the graph's node/edge SET (not just merge props onto existing
   ones) will hit the identical D3 wall. This is a kernel-level gap, not a law-specific one, and
   is worth flagging to whichever session next touches `scripts/case-loops/persist-batch.ts`.
