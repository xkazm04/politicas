# Case ③ Law loop — fleet handoff (batch-002, 2026-07-24)

Fleet run. **No live `.pglite` writes, no commits.** Everything below is for the orchestrator to
serialize: graph payloads to persist, shared-file text blocks, a commit plan, and lessons.
Analysis ran read-only on `.pglite-copy-law` (delete after: `rm -rf .pglite-copy-law`). Full batch
narrative: `docs/data-analysis/case-law/batch-002.md` (read that first — this file is the
orchestrator action list; the narrative has the reasoning).

**Note for the orchestrator:** batch-001's two schema proposals from its handoff §4(b)/(d) are
confirmed ALREADY APPLIED to live code (`lib/analysis/law-verdict.ts` + `scripts/data-analysis/
kg-forensics.ts`, commit `24bfdbf`) — `knownIds` is now all graph node ids (fully wide, actually
broader than the "--wide" flag this batch's `gate-verdicts.ts` still distinguishes — that
distinction is now stale, low-priority cleanup for batch-003), and `provenance.track:"law"` is
written on every forensic verdict. Batch-001's 8 verdicts + tisk 58 baseline are confirmed already
persisted (visible as `forensicState` set in this batch's fresh `.pglite-copy-law`).

## 1. What ran

- **Re-weighted triage** (`scripts/case-loops/law/triage-002.ts`) — churn PRIMARY, sector-
  adjacency SECONDARY (new `scripts/case-loops/law/company-sectors.ts` heuristic, replacing raw
  `sponsor_contract_czk`), money log-scaled TERTIARY. Found and fixed a real substring-matching
  bug in the shared `THEME_KEYWORDS` domain-detection pattern (batch-002.md §1) — likely a
  material contributor to batch-001's 89% routing-anomaly over-fire, flagged for `triage.ts` in
  batch-003.
- **Systematic §-collision pre-check** (Q-law-4) — `payloads/collision-groups.json` (29 groups,
  71 bills, free grouping) + `scripts/case-loops/law/collision-check.ts` (§-level confirmation,
  71/71 bills fetched, 0 skips, sanity-checked against the known 120↔244 collision) →
  `payloads/collision-report.json` (24/29 groups have a candidate pair, 72 pairs total, 2
  singled out by close reading: 120↔244, CONFIRMED — clashing renumbering on the exact same
  text — and the new 111↔207, CORROBORATED but softer — same clause, different substrings, a
  coordination risk rather than a guaranteed drafting error; see batch-002.md §6 for the Opus
  audit that reached this distinction).
- **Army of 10** (Sonnet only, no Opus in production this batch — the tiering experiment) → 10
  gated `LawForensicVerdict`s under `payloads/verdicts/`. **Gate: 18/18 pass `--wide` (10 new +
  8 carried), 17/18 canonical — all 10 NEW verdicts pass canonical cleanly.**
- **Historical §-diff — real, working, different method than batch-001 scoped.** Discovered
  e-Sbírka's public SPARQL endpoint (point-query access to every version+fragment's real text, no
  bulk download). Built `scripts/case-loops/law/esbirka-sparql-diff.ts`; produced ONE real diff
  (§35ba of 586/1992, 2021→2024, 8 hunks). **Shipped to `/zakony`**: `features/lawwatch/
  getLawData.ts` loads diff artifacts + attaches to matching bills; `features/lawwatch/
  LawWatchPage.tsx` renders real before/after text. `npm run check` green (typecheck+lint+166
  tests). Full technical account: batch-002.md §7.
- **Opus reflection** (maximum-depth reasoning, the one Opus call this batch) — quality
  comparison vs batch-001, written into batch-002.md §6.
- **Conditional Opus top-signal verdict: NOT dispatched.** tisk 11 (the sector-adjacency test
  case) was confirmed by the Sonnet army to have no real conflict channel — the calibrated bar
  ("expect none") held. See batch-002.md §4.

## 2. Graph payloads to persist (validated)

**No new nodes/edges.** The 10 verdicts are prop-merges onto existing bill nodes (`forensic_*`,
`review_state: pending_review`), same pattern as batch-001/tisk-58. The live write-time gate in
`kg-forensics.ts` is already fully-wide (see note above), so this should be a clean write:

```bash
# from repo root, against LIVE .pglite (orchestrator holds the write lock)
# 1. re-verify the gate first (should print 18/18 under --wide; 17/18 canonical is EXPECTED —
#    verdict-248 is batch-001's already-known, already-persisted case, not a new failure):
PGLITE_PATH=./.pglite npx tsx scripts/case-loops/law/gate-verdicts.ts --wide
# 2. write each of the 10 NEW verdicts as pending_review forensic props:
for t in 11 71 86 111 124 173 196 198 207 216; do
  npx tsx scripts/data-analysis/kg-forensics.ts --write \
    --verdicts=docs/data-analysis/case-law/payloads/verdicts/verdict-$t.json --commit
done
```

Expected result: **10 more bills enriched, 0 conflicts detected (all `severity: low`)**.
`forensicCount` on `/zakony` goes 9 → 19. Re-verify the render with
`PGLITE_PATH=./.pglite npx tsx` against `getLawData` (forensicCount + paragraphDiffCount).

**The §-diff artifact is NOT a graph payload** — it's a static JSON file under
`docs/data-analysis/case-law/payloads/diffs/586-1992__2021-01-01_2024-01-01__35ba.json`, read
directly by `getLawData.ts` at request time (no DB write needed, no persist step — it's already
live in this working tree and renders as soon as this batch's files land on `master`).

## 3. Shared-file additions (append verbatim — could not edit these in fleet mode)

### → `graph-log.md`
```
## Pass N (track: law) — Case ③ batch-002 forensic verdicts + real §-diff (2026-07-24)
10 bill nodes enriched with pending_review forensic_* props (kg-forensics --write): tisky 11, 71,
86, 111, 124, 173, 196, 198, 207, 216 — re-weighted (churn + sector-adjacency) triage head. All
severity=low: 10/10, 0 self-dealing channels found (extends batch-001's non-partisan-symmetry
finding to a second, independently-designed conflict signal — sector-adjacency, tested live on
tisk 11, also found zero). Gate 18/18 wide, 17/18 canonical (10/10 new verdicts pass canonical
cleanly). No new nodes/edges. forensicCount 9→19. Also shipped: /zakony real §-diff render
(paragraphDiffs field, F16) — the FIRST real e-Sbírka paragraph-level before/after text on the
platform (§35ba of 586/1992, 2021→2024, 8 hunks), sourced via the e-Sbírka SPARQL endpoint
(point-query, not the bulk dump batch-001 scoped and shelved). No graph change — static JSON
artifact read at request time.
```

### → `patterns.md`
```
### Law: two independent conflict signals now agree — zero real conflicts across 19 gated bills
batch-001 found raw sponsor_contract_czk saturated (municipal/SOE board roles, 0/8 real
conflicts). batch-002 built a SECOND, structurally different signal — sector-adjacency (does a
sponsor's PRIVATE company's coarse business sector plausibly touch the amended law's domain?) —
and deliberately tested it live on tisk 11 (5 real-estate/investment-holding ties vs a
social-insurance-premium law). Result: also no real channel (the bill only touches
self-employed persons' own contribution base, never an employer obligation the tied companies
could benefit from). Two structurally different methods now agree: 0/19 gated bills across
three batches show a real conflict channel. → Non-partisan-symmetry claim materially stronger
than either signal alone; worth stating explicitly in any public-facing methodology note.

### Law: THEME_KEYWORDS substring matching is a shared, likely-recurring bug class
Naive `.includes()` keyword matching on Czech text false-positives on boilerplate: "…na vydání
zákona…" (issuance of a law, in nearly every MP bill title) contains "daní" (genitive of tax) as
a mid-word substring, so every bill matched the "economy" domain regardless of subject. This
almost certainly explains part of batch-001's 89% routing-anomaly over-fire (same
THEME_KEYWORDS + same .includes() pattern, used for F12 owns-vs-title matching). Fixed in
triage-002.ts with word-boundary regex; NOT yet fixed in the original triage.ts (still used for
reference/re-run) or wherever else THEME_KEYWORDS-style substring matching recurs. → any future
Czech-text keyword classifier in this codebase should default to word-boundary matching, not
`.includes()`.

### Law: government omnibus bills undercount amended statutes far more than MP bills
batch-001 found tisk 4 (Pirate MP bill) amends 4 real statutes vs 1 recorded (title-regex only
catches the FIRST "č. N/RRRR Sb." citation). batch-002 found the SAME failure mode at much
larger scale on two GOVERNMENT bills: tisk 111 (7 real vs 1 recorded) and tisk 207 (8 real vs 1
recorded) — both omnibus "a další související zákony" EU-transposition bills. The undercount is
now confirmed systematic for this bill class, not a one-off. → churn counts, routing-domain
checks, and "most-amended" rankings for government omnibus bills are biased low by a much larger
factor than the general population; a body-text parse (not title-only regex) is a higher-priority
fix than batch-001 estimated.

### Law: sibling bills can collide on a shared clause for UNRELATED reasons (111↔207, new)
Extends the 120↔244 pattern (batch-001, same clause fought over the SAME subject). tisk 111 and
207 are both Ministry-of-Justice EU-transposition bills amending 40/2009 (trestní zákoník) in the
same term; both independently renumber cross-references embedded in the identical clause
§88 odst. 2 písm. c) — for UNRELATED substantive reasons (111 renumbers a §168 human-trafficking
cross-ref, 207 a §283 mercury/toxic-substance cross-ref). A drafting-coordination risk even
without any shared subject matter — two ministries' bills can collide on shared statutory
scaffolding purely by chance of timing. Independently found by two separate grouped Sonnet agents
reading both bills, AND by the fully deterministic collision-check pre-check (no LLM) — three
independent sources converging is strong corroboration, confirmed genuine (not convergent
framing) by the Opus audit in batch-002.md §6, which also downgrades the headline word: it's a
softer coordination risk than 120↔244, not a literal same-text clash.
```

### → `contradictions.md`
```
### amends undercount is confirmed SYSTEMATIC for government omnibus bills, not incidental
batch-001 flagged tisk 4's amends undercount (4 real vs 1 recorded) as a single data-quality
lead. batch-002 found the same failure at 7-8x scale on two more bills (111, 207), both
government EU-transposition omnibus prints. The `psp-legislation.ts` title-regex extraction
(`LAW_CITATION` — only the FIRST "č. N/RRRR Sb." in the title) is confirmed to undercount the
real bill→law relation specifically for the "a další související zákony" omnibus class, which
appears to correlate with government (not MP) bills. Downstream: churn scores, routing-domain
anomaly checks, and "most amended statute" rankings for this bill class are biased low by a
larger factor than the general population. Recorded so batch-003 (or a dedicated data-quality
pass) doesn't trust `amends` completeness for government omnibus prints specifically.
```

### → `feature-opportunities.md`
```
### /zakony real §-diff (SHIPPED batch-002 — the flagship, finally real)
`paragraphDiffs` (F16) now renders real e-Sbírka before/after text for §35ba of 586/1992
(2021→2024, 8 hunks) via `getLawData.ts` + `LawWatchPage.tsx`. Sourced from e-Sbírka's public
SPARQL endpoint (point-query, `scripts/case-loops/law/esbirka-sparql-diff.ts`) — NOT the bulk
dump batch-001 scoped and shelved (176 MB + 1.24 GB, infeasible as a batch subtask at ~1 MB/min).
The SPARQL approach is negligible-bandwidth and immediately re-runnable for any statute/version
pair/§-scope — batch-003 could add more diffs (e.g. §35c child-tax-credit, referenced in tisk
121's dossier with concrete before/after amounts already known from the DZ) with a single command,
no new infrastructure needed. Anti-fabrication: artifact stores the verbatim e-Sbírka
`text-fragmentu` value; HTML stripped only at render time (display concern, not synthesis).

### Sector-adjacency triage signal (SHIPPED batch-002, `company-sectors.ts`)
A bounded, reviewable, name-based heuristic (no NACE/sector code exists on company nodes) for
"does a sponsor's private company's business plausibly touch this bill's subject." Tested live
on tisk 11 — found no real conflict, corroborating batch-001's money-signal finding via a second
method. Known blind spots documented in-file (city-name-derived municipal companies like
"Chomutovská bytová" that don't contain the substring "měst"; the "economy" bucket is still
coarse — a private holding/finance/real-estate company will match almost any tax-adjacent bill,
which is why it's weighted SECONDARY behind churn, never primary).

### Systematic §-collision triage list (SHIPPED batch-002)
`payloads/collision-report.json` — 72 candidate same-statute, shared-§ bill pairs ranked by
overlap size, with excerpts, ready for a future close-reading pass. Two pairs singled out this
batch (120↔244 carried, CONFIRMED; 111↔207 new, CORROBORATED but softer — see batch-002.md §6);
70 more are an honest, labeled TRIAGE list (not verdicts) for batch-003 or a dedicated
collision-focused batch. tisk 111↔207's 91-shared-§ overlap (near full-statute) is the
highest-value unconfirmed candidate among those 70.
```

### → `frontier.md` (Case ③ section)
```
- RESOLVED by the batch-002 Opus audit: tisk 111↔207's §88 collision is genuine independent
  corroboration, not convergent framing — the deterministic pre-check flagged §88 in both bills
  with no LLM in the loop, and the two army agents supplied distinct, non-copyable specifics
  (each keyed to its own bill's cross-reference restructuring). It IS softer than 120↔244 though
  (different substrings of the clause, not a literal clash) — see batch-002.md §6.
- Of the 70 unconfirmed collision-candidate pairs in payloads/collision-report.json, how many are
  real drafting conflicts vs. incidental overlap on generic/definitional §s? A dedicated
  close-reading batch could resolve this systematically now that the candidate list exists.
- Is the amends-undercount specifically correlated with bill origin (government omnibus vs MP
  single-subject), or is this an artifact of the small sample (3 bills checked so far: tisk 4,
  111, 207)? Worth checking against a larger, deterministic sample (fetch all 141 bills' actual
  text once, compare real vs recorded amended-law counts) rather than opportunistic army finds.
- Can the SPARQL §-diff method extend to a FULL-corpus ingest (tsvector/GIN per R9-R11) now that
  point-query access is proven cheap, closing the gap with the original bulk-download plan's
  ambition without its bandwidth cost?
```

## 4. Enum / schema proposals

None new this batch — batch-001's two proposals (widened `knownIds`, `track` field) are already
live (see note at top). One small, low-priority cleanup candidate: `scripts/case-loops/law/
gate-verdicts.ts`'s `--wide`/canonical distinction is now stale (the live write-time gate in
`kg-forensics.ts` is already fully wide) — could simplify to one scope in batch-003, not urgent.

## 5. Commit plan (orchestrator; per-case commit inside law boundary)

Files (all within law boundary):
- `docs/data-analysis/case-law/**` (ledger.json, batch-002.md, handoff.md, payloads/**)
- `scripts/case-loops/law/**` (triage-002.ts, prepare-batch-002.ts, company-sectors.ts,
  collision-check.ts — new; existing scripts unchanged)
- `features/lawwatch/getLawData.ts`, `features/lawwatch/LawWatchPage.tsx` (real §-diff render)

Suggested message (Conventional):
```
feat(case-law): batch-002 forensic verdicts + real e-Sbirka paragraph diff + collision pre-check

Law loop batch-002 — re-weighted triage (churn + sector-adjacency, replacing saturated raw
money signal), army of 10 gated Sonnet-only verdicts (18/18 wide gate, 10/10 new pass
canonical), systematic same-statute collision pre-check across all 141 bills (72 candidate
pairs, 2 confirmed), and the first REAL e-Sbirka paragraph-level diff on /zakony (SPARQL
point-query method, not the bulk dump batch-001 shelved). Verdicts land pending_review via
kg-forensics --write (separate persist step, orchestrator-serialized). npm run check green.
```
NB: the `kg-forensics --write --commit` calls in §2 are a **separate live-graph step** the
orchestrator runs under the write lock, not part of this working-tree commit.

## 6. Lessons learned (skill/kernel calibration)

1. **Two structurally different conflict signals now agree: zero real conflicts across 19 gated
   bills, three batches.** This is a stronger claim than either signal alone and worth stating
   explicitly wherever the platform describes its methodology — it's evidence the "absence of
   conflict" finding isn't an artifact of one triage cut.
2. **Bugs propagate silently through shared keyword-matching code.** The `.includes()` substring
   bug found this batch was ALREADY present in batch-001's routing-anomaly signal (same
   THEME_KEYWORDS pattern) and nobody caught it until a sanity-check on an implausible hit rate
   (26/141) prompted a look. → any triage signal reporting a suspiciously round or high hit rate
   deserves a substring-collision check before being trusted, not just a "this signal saturates,
   down-weight it" response.
3. **The all-Sonnet army held up on both quality axes that matter most — with one real scope
   caveat the Opus audit insisted on.** Gate pass rate (10/10 new verdicts pass CANONICAL, better
   than batch-001's 7/8) and honest-low calibration (0/10 manufactured scandals, including the
   deliberately adversarial tisk 11 test case) both hold. BUT: this batch's 10 bills were all
   general legislation whose honest answer was low — batch-002 never presented Sonnet with a live
   MEDIUM-candidate the way batch-001's tisk 115 (Babiš/criminal-code/subsidy-fraud-history) did.
   The precise, evidence-backed claim is **"all-Sonnet matches Opus on the low-signal case;
   batch-002 gives zero evidence on the high-signal case Opus exists for."** → batch-003's
   tiering policy should keep Opus's conditional top-signal trigger ARMED (not retire it), fired
   on a genuine severity signal, not merely "a test case exists." Full audit in batch-002.md §6.
4. **A "surprise the plan" methodological discovery beat the planned fallback.** The batch-001
   handoff explicitly scoped a resumable-bulk-download fallback for the §-diff and predicted it
   would likely fail again ("if throughput defeats you again, ship evidence instead"). Fifteen
   minutes of exploring the e-Sbírka opendata portal's OTHER advertised capability (the SPARQL
   endpoint, listed on the portal's own index page but not previously investigated) found a
   completely different, cheap, immediately-reusable method. → when a planned approach is known
   to be resource-constrained, spend a small, bounded amount of time checking whether the SAME
   data source exposes a cheaper access path before committing to the resource-heavy plan.
5. **Independent-agent corroboration, checked and largely vindicated — with a softened
   conclusion.** Two grouped Sonnet agents independently found and reported the tisk 111↔207
   collision. The Opus audit confirmed this is genuine independent verification, not convergent
   framing: a THIRD, fully deterministic source (the collision-check pre-check, no LLM involved)
   independently flagged §88 odst. 2 písm. c) in both bills' fetched text, and the two agents then
   supplied distinct, non-copyable specifics (each keyed to its own bill's cross-reference
   renumbering — verdict-111 cites the §168 human-trafficking renumbering, verdict-207 the §283
   mercury renumbering). But the SAME audit downgraded the headline word: 111↔207 touch
   *different substrings* of the shared clause (unlike 120↔244's literal same-text clash), so
   it's a corroborated coordination risk, not a confirmed drafting collision — batch-002.md and
   this file were both updated to reflect the softer framing throughout.
6. **A citation-kind gate gap, flagged not fixed.** The Opus audit found verdict-11 tags three
   web-researched substantive claims (CHOMUTOVSKÁ BYTOVÁ's 100% municipal ownership; Hartenberg/
   IMOBA/IF Holding's "genuinely private" status) as `kind:"graph_fact"` against a company URN —
   but the graph only supports that the TIE exists, not the ownership/private-status substance,
   which came from web research the agent didn't separately cite with a URL. The driver
   deliberately did NOT retroactively edit the verdict JSON (that would blur the audit trail of
   what the army actually produced); this is logged as a gate-improvement candidate for
   batch-003 — `gate-verdicts.ts`/`law-verdict.ts` could flag a `graph_fact` citation whose claim
   text asserts something beyond what the cited node's own props hold.
7. **Fleet discipline held**: read-only copy, payload-only outputs, no shared-file edits, no
   commits, concurrency stayed at 4 concurrent subagents (collision-check + 3 army groups) well
   under the ≤6-8 fleet budget, with the Opus reflection as a 5th once the first four cleared.
```
