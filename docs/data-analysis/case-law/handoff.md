# Case ③ Law loop — fleet handoff (batch-005, 2026-07-25)

Fleet run, concurrent with money and effort loops in the same repo. **No live `.pglite` writes
during analysis, no shared-vault edits, no commits.** Full narrative: `batch-005.md` (read that
first — this file is the orchestrator action list). This supersedes batch-004's `handoff.md` as
the action list; `batch-004.md`/`batch-004-reflection.md` stay as history.

## 1. What ran (see batch-005.md for full detail, including the Opus audit's full defect list)

Q-law-12 (missing-law-node ingest, 187/187 resolved) + Q-law-11 (set-difference proposal trigger)
+ amends regen v2 (150→567 edges, 0 missing law nodes) + **Opus paired-landing audit round 1: NOT
READY, 11 defects (D1-D11)** + same-batch remediation of 6 of them (D2/D8 fully, D1 partially — the
3 hand-proven false edges fixed, the broader 6.3% precision risk NOT re-measured, D4/D5/D7/D10
fully) + a deletion-diff gate (new, key-only, D4 residual: no value-preservation check yet) +
post-regen collision pre-check (583 raw / 186 partitioned candidate pairs, P52 ranking signal
implemented but explicitly NOT validated — Fisher p=1.00 vs baseline, reported honestly not
oversold) + 15-pair close-read (5 confirmed / 7 coordination-risk / 3 incidental, one entry
corrected post-audit) + build-review (`/zakony/kolize` batch-5 section shipped, clearly labeled
post-regen-pending; `/zakony` most-amended ranking confirmed already graph-driven, no change
needed) + `npm run check` green.

**This is a re-prepared, remediated, but NOT re-audited state.** The Opus verdict that gates live
apply is for the PRE-remediation payload; a fresh audit pass on the current
`batch-005-amends-regen.json`/`batch-005-missing-law-nodes.json` is the correct next step, not
optional, before any orchestrator write.

## 2. Graph payloads to persist (validated, NOT applied — orchestrator decision required, AND a fresh audit first)

```bash
# from repo root, against a COPY first (never live) to re-verify:
cp -r .pglite .pglite-copy-law-verify
PGLITE_PATH=./.pglite-copy-law-verify npx tsx scripts/case-loops/law/_apply-missing-law-nodes-copy.ts
PGLITE_PATH=./.pglite-copy-law-verify npx tsx scripts/case-loops/law/validate-amends-regen-005.ts
# should print PASS, 567/567, 0 errors — payload path is baked into the script
PGLITE_PATH=./.pglite npx tsx scripts/case-loops/law/diff-amends-regen-deletions.ts \
  --payload=docs/data-analysis/case-law/payloads/batch-005-amends-regen.json
# read-only against LIVE — should print 0 unallowlisted deletions
```

**No apply script exists that can write live** (Opus audit D3): `scripts/case-loops/persist-batch.ts`
(shared, outside this case's fleet boundary — never edited this batch) is props-merge-only and
refuses inserts; this batch's payloads are 191 node inserts + 567 edge inserts (mostly inserts,
some pre-existing-edge value-updates), which it cannot execute as-is. The orchestrator must either
extend `persist-batch.ts` with an insert-capable path (shared file, cross-case decision) or run a
case-scoped insert script under its own review, in this exact order:

1. **Nodes first**: `docs/data-analysis/case-law/payloads/batch-005-missing-law-nodes.json`'s
   `resolved` array (187 nodes) — `_apply-missing-law-nodes-copy.ts` is the tested reference
   implementation (currently guarded to refuse the live path; the orchestrator's real run needs
   the SAME logic against live, with a REAL assigned `pass` replacing the provisional
   `max(graph)+1` placeholder it currently computes).
2. **Edges second, same window**: `docs/data-analysis/case-law/payloads/batch-005-amends-regen.json`'s
   `edges` array (567) — **but NOT as a blind upsert.** 150 of the 567 keys already exist live;
   applying the full array with a naive `upsertKgEdges` call will overwrite their `provenance`/
   `props` (including losing the `source: census_full|title_fallback` tag this whole regen
   exists to add) per PK-conflict semantics — D4, unresolved. The orchestrator must decide: (a)
   split the payload into "150 pre-existing keys → props/provenance-merge, preserving what's
   mergeable" vs "417 new keys → plain insert", or (b) accept the provenance overwrite on the 150
   as an explicit, logged decision (the new provenance is arguably BETTER — it carries the
   `source` tag the old one lacks — but that is a call the orchestrator should make deliberately,
   not by accident of `upsertKgEdges`'s dedupe-by-PK behavior).
3. **Re-triage immediately after** — `triage-002.ts`'s `triageScoreV2`/`maxTargetChurn` go stale
   the instant the edge set changes; every downstream ranking (including `/zakony`'s `topLaws`,
   which reads the graph directly and will self-update) depends on nothing else reading a stale
   cached triage row.

**Independent re-audit is the actual next step, before step 1.** See `batch-005.md` §6 for the
full 6-item execution plan (re-audit → precision measurement → apply script → re-triage →
collision army wave → durability contract).

## 3. Shared-file additions (append verbatim — could not edit these in fleet mode)

### → `patterns.md`
```
### Law: the SAME defect class can recur one field deeper, even in the gate built to close the last audit's finding
batch-004's Opus audit caught a union-vs-replace defect on edge PRESENCE (a regen silently dropped
a live edge). batch-005 built the deletion-diff gate that finding explicitly asked for — and its
own Opus audit found the new gate is blind to value REPLACEMENT (provenance/props overwritten on a
KEY that survives), the identical shape one level down: `diff-amends-regen-deletions.ts` compares
`(from,to)` keys only, so an edge that keeps its key but loses its provenance passes clean. →
closing a flagged gap means asking "what is this NEW gate itself still blind to", not just
confirming it catches the originally-reported case — the same discipline P32 already established
for ranking signals now generalizes to gates themselves.

### Law: a recall fix and a precision fix are different projects even inside one pipeline, and the fix's own author is the wrong person to catch the gap
batch-004: "a precision fix does not imply a recall fix" (the amends-census correction was
validated only on over-counting, its under-counting rate measured a batch later). batch-005 is the
mirror: closing 289 unresolved citations to 0 (a recall win) does not imply the newly-resolved
citations are CORRECT — an independent Opus audit hand-verified 3 of them were footnote citations
misread as amending targets (proven false), and a cheap deterministic proxy flagged 6.3% of all
574 edges (pre-remediation) with no amending-verb context nearby. The driver who built the ingest
did not catch this before the audit did — precision review needs an adversarial second pass, not
self-checking the same pipeline that produced the number.

### Law: an unvalidated ranking signal that "looks like it worked" needs the actual baseline computed, not just a raw hit-rate quoted
P52's replacement signal (moneyLiteral, replacing shared-§ count) hit 12/15 (80%) "real signal"
among close-read pairs — sounds like a win. The Opus audit ran Fisher's exact test against the
TRUE baseline (76% among ALL partition-survivors, prior batches) and found p=1.00 — statistically
indistinguishable from random selection at this sample size, with the confirmed-only rate actually
regressing (50%→33%). → an 80%-sounding number is not evidence without its baseline stated next to
it; report null/inconclusive results with the same honesty as positive ones (a pattern the
kernel's own doctrine already demands for absence-of-conflict findings — this is the same rule
applied to a signal-validation claim instead of a substantive finding).
```

### → `feature-opportunities.md`
```
### /zakony/kolize now surfaces a post-regen preview (batch-005): 5 confirmed, 7 coordination-risk, clearly labeled as pending topology
15 of 60 money-literal-flagged candidate pairs from the post-regen (583 raw / 186 partitioned)
collision universe were close-read this batch, rendered on `/zakony/kolize` as `sourceBatch: 5`
with a `postRegenTopology` flag, a page-level banner, and a per-pair "dávka 5 · post-regen" badge
— every individual fact cited (bill numbers, statute refs, excerpt text) is real and already
resolvable against the LIVE graph today (all bills/statutes in these 15 pairs pre-date batch-005),
but the CANDIDATE SET was found via topology the live graph doesn't have yet, so it's rendered
distinctly rather than merged into the batch 1-4 count. Next increment: the remaining ~171
partition-survivor pairs are a full army-wave candidate for batch-006, once a validated ranking
signal exists to order the sweep (see patterns.md — moneyLiteral is not yet that signal).

### A kernel-level gap: no case loop currently has a sanctioned INSERT write path for new nodes/edges
`scripts/case-loops/persist-batch.ts` (shared across cases) is deliberately props-merge-only —
"refuses to insert" is a safety feature against silent graph growth. But batch-005's paired
landing (191 new law nodes + 417 new amends edges) is a legitimate, validated, audited case for
growing the graph's node/edge SET, and there is no shared tool that can execute it; a case-scoped
reference script (`_apply-missing-law-nodes-copy.ts`) exists for nodes only, tested on a copy, and
explicitly refuses the live path. Any future case loop (money/effort included) that needs to ADD
new entities rather than annotate existing ones will hit this same wall — worth a kernel-level
decision (extend `persist-batch.ts` with a reviewed, explicitly-labeled insert path; or a second
shared script with a narrower, insert-only contract) rather than each case re-inventing a
copy-only reference implementation.
```

### → `frontier.md` (Case ③ section)
```
- **batch-005's payload is remediated but NOT re-audited.** The Opus verdict on record (NOT READY,
  11 defects) is for the PRE-remediation state; 6 defects were fixed same-batch by the driver that
  built them, which is not equivalent to an independent second check. A fresh audit pass on
  `batch-005-amends-regen.json`/`batch-005-missing-law-nodes.json` (post-remediation) is the
  correct next step before any live apply — not optional, not a formality.
- **Precision on the 567 regenerated edges is not fully measured.** Only the 3 hand-proven false
  cases (footnote citations) were confirmed and fixed; a broader ~6.3% proxy false-positive rate
  flagged pre-remediation (edges with no amending-verb context within ~2500 chars) was never
  re-run against the remediated set. Every single-citation edge to one of the 187 newly-ingested
  law nodes should be treated as lower-confidence than a multi-citation or pre-existing edge until
  this measurement runs as a reported metric, not a spot-check.
- **No apply path exists for this batch's write** (D3) — `persist-batch.ts` is props-merge-only
  and out of this case's fleet boundary to extend. The orchestrator must either extend it
  (cross-case decision) or run a case-scoped insert script under direct review. See
  handoff.md §2 for the exact ordering constraint (nodes before edges, same window) and the
  provenance-preservation decision the 150 pre-existing edge keys require (D4).
- **Re-triage is a hard precondition, again** (as batch-004 flagged for its own regen): applying
  batch-005's 567-edge set changes `triageScoreV2`/`maxTargetChurn` for every bill; naive
  sector-adjacency recomputation over it will re-degenerate the same way batch-004's reflection
  warned (tisk 64 goes from 1 to dozens of amended statutes) unless computed at §-level.
- **The collision candidate universe (583 raw / 186 post-partition pairs) is 92% unread** — this
  batch's 15-pair close-read is a format-validated preview, not coverage. batch-006's first job
  (once re-triage lands) is the remaining ~171 pairs, WITH a properly validated ranking signal —
  moneyLiteral is explicitly not yet that (see patterns.md).
- **Durability gap unresolved (D6):** `kg-legislation-ingest.ts`'s standing re-derivable ingest
  still wholesale-replaces `props` on `law` nodes; a future full-graph rebuild would silently wipe
  `esbirka_title`/`esbirka_exists`/`esbirka_eli` from all 191 newly-ingested nodes (and would have
  already wiped the same fields from the original 101, had anyone re-run it — untested this batch,
  flagged not fixed, matches `esbirka-laws.ts`'s own correct merge pattern that
  `kg-legislation-ingest.ts` should adopt).
```

### → `graph-log.md`
```
## Pass N (track: law) — Case ③ batch-005: missing-law-node ingest + amends regen v2 prepared (NOT applied — audit found NOT READY, partially remediated), collision pre-check re-run, kolize batch-5 preview shipped (2026-07-25)
No graph writes this batch (all analysis on .pglite-copy-law-005). Prepared, awaiting a FRESH
orchestrator-commissioned audit before any apply: 187 new law nodes (e-Sbírka bulk registry,
0 unresolvable, titles/ELIs byte-verified) + amends edge regen 150 → 567 (was 282-held from
batch-004, now closes essentially the full citation universe: 0 remaining missing-law-node
statutes, down from 188). The FIRST Opus paired-landing audit found this NOT READY (11 defects:
unmeasured precision on newly-resolved citations, an `Sb. m. s.` international-treaty citation
collision, no apply path, a provenance-overwrite gap in the very deletion-diff built to fix
batch-004's flagged issue, an invented pass number, 6 non-parliamentary-act nodes wired as amends
targets, stale payload self-description). 6 of 11 defects remediated same-batch (Sb.m.s. regex
fix, footnote-citation extraction fix for the 3 hand-proven cases, act-type edge gate excluding
4 refs, pass-field + guard hardening, corrected payload documentation) — the remediated
567-edge/187-node state is NOT yet independently re-audited, and the broader ~6.3% precision risk
across all edges (found pre-remediation) was not re-measured. Collision candidate universe on the
post-regen topology: 583 raw pairs (145 multi-bill groups, up from 88/29), 186 survive partitioned
§-overlap (Q-law-10 method, unmodified). A replacement ranking signal for the debunked shared-§
count (P52, moneyLiteral — currency/percentage/coefficient literal in the shared excerpt) was
implemented and explicitly found NOT statistically validated (Fisher p=1.00 vs the 76% baseline
partition-survivor rate) — reported honestly, not oversold. 15 pairs close-read: 5 confirmed / 7
coordination-risk / 3 incidental, rendered on /zakony/kolize as a clearly-labeled batch-5/
post-regen-pending section (build-review, no commit — driver never commits, per kernel). Zero new
forensic_* verdicts this batch. npm run check green.
```

## 4. Enum / schema proposals

None new this batch beyond what batch-003/004 already proposed (`amended_laws_full` array-of-string
prop, unapplied). The regen payload's edge provenance now includes an explicit `pass: 0` provisional
field (kernel's 5-field contract) — not a new enum, just closes a field-completeness gap batch-004's
payload had left open.

## 5. Commit plan (orchestrator; per-case commit inside law boundary)

**Nothing committed this batch** (per Authority — no exceptions, not even a surgical one; batch-004's
driver commit was the cautionary tale the kernel now names explicitly).

**Uncommitted work, all within law boundary** (`docs/data-analysis/case-law/**`,
`scripts/case-loops/law/**`, `lib/ingest/sources/psp-legislation.ts`, `features/lawwatch/**`,
`app/zakony/**`):
- `scripts/case-loops/law/ingest-missing-laws.ts` (new), `fix-proposal-trigger.ts` (new),
  `amends-regen-005.ts` (new), `validate-amends-regen-005.ts` (new),
  `diff-amends-regen-deletions.ts` (new), `regen-collision-groups-005.ts` (new),
  `collision-check-005.ts` (new), `_apply-missing-law-nodes-copy.ts` (new, copy-only reference
  implementation — refuses the live path by construction)
- `scripts/case-loops/law/amends-census.ts` (modified — `isFootnoteLine` fix, D1 partial)
- `lib/ingest/sources/psp-legislation.ts` (modified — `LAW_CITATION` `Sb. m. s.` exclusion, D2)
- `docs/data-analysis/case-law/**` (batch-005.md new, this handoff.md replacing batch-004's,
  ledger.json updated, payloads/** — missing-law-nodes, amends-regen v2, collision-groups-005,
  collision-report-v2-005, collision-close-reads-batch005, impact.md)
- `features/lawwatch/getCollisionData.ts` + `CollisionsPage.tsx` (modified — batch-5 post-regen
  preview section)
- `.claude/skills/law-loop.md` (batch-005 priorities marked done, see below)

Suggested message (Conventional), for whatever the orchestrator folds together:
```
feat(case-law): batch-005 missing-law-node ingest + amends regen v2 (audit-remediated, NOT applied)

Law loop batch-005 — P1 paired landing: 187 missing law nodes resolved via the e-Sbirka bulk
registry (0 unresolvable, titles/ELIs byte-verified), amends edge regen 150->567 (set-difference
trigger, Q-law-11) closing the citation universe (188->0 missing statutes). Opus paired-landing
audit found the first pass NOT READY (11 defects) -- 6 remediated same-batch (Sb. m. s. citation
collision fixed, footnote-citation extraction fixed, non-parliamentary-act edge gate added,
deletion-diff gate added, provenance/pass fields fixed, stale docs fixed); precision on the full
edge set and a durable apply path remain open for a fresh audit + the orchestrator. Post-regen
collision pre-check: 583 raw / 186 partitioned candidate pairs (up from 88), 15 close-read (5
confirmed / 7 coordination-risk), P52 ranking signal implemented and honestly reported as NOT
statistically validated. /zakony/kolize ships the batch-5 preview, clearly labeled pending. npm
run check green. Live graph untouched -- awaiting a fresh orchestrator-commissioned audit before
any apply.
```

## 6. Lessons learned

See `batch-005.md` §7 for the full text (5 lessons): (1) a recall fix and a precision fix are
different projects even in one pipeline, and need an adversarial second check, not
self-verification; (2) the same defect class can recur one field deeper even in the gate built to
close the LAST audit's finding — ask what the new gate is still blind to; (3) a footnote-marker
regex tuned on one PDF's rendering breaks on the next PDF's rendering of the same thing — iterate
against multiple real examples before calling a text-extraction fix general; (4) an unvalidated
ranking signal that "looks like it worked" needs the real baseline computed by an adversarial
audit, not just its raw hit-rate quoted by its own author; (5) fleet boundary discipline creates a
genuine kernel-level gap — no case loop has a sanctioned insert (not just merge) write path, and
every case that ever needs to grow the graph's node/edge SET will hit the same D3 wall batch-005
did.
