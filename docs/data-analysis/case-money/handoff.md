# Money loop — fleet handoff (batch 002)

Case ① FollowTheMoney · 2026-07-24 · fleet mode · **Sonnet-only driver + army, Opus
reflection only** (batch-002 model-tiering experiment). Everything the orchestrator needs to
serialize this batch's writes and aggregate cross-case. All work is inside the money
boundary; nothing shared was edited. **No commit, no live `.pglite` write, no
`review_state` change made.** (Batch 001's payload/handoff is already persisted live at
pass 13 — confirmed by reading `.pglite`'s `linked_to` edge props directly before starting
this batch. This document supersedes batch 001's handoff.md, which is now historical.)

## 1. Graph-write payloads (validated — orchestrator writes under the `.pglite` lock)

- **File:** `docs/data-analysis/case-money/payloads/batch-002-ares-vr-reconciliation.json`
- **What:** 245 props-merge annotations onto **existing** `linked_to` edges — the full
  remaining population (260 total − 15 batch 1). Same prop shape as batch 001:
  `corroboration`, `corroboration_source`, `role_valid_from`/`role_valid_to`,
  `temporal_status`, `tie_class`, `signal` (only on the 10 Sonnet-reviewed units),
  `reviewer_note`, `flags`. **No new edges, no node creation, no `review_state` change.**
- **Provenance to stamp at write:** `{track:"money", pass:<assigned by orchestrator,
  expected 16+>, method:"verdict", ref:"case-money/batch-002 · ARES VR full-population
  reconciliation (deterministic) + Sonnet judgment on 10 ambiguous units",
  computedAt:"2026-07-24"}`.
- **Re-verify before writing:**
  ```
  cp -r .pglite .pglite-copy-money        # if the copy was cleaned up
  PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/validate-payloads.ts
  # expect: GATE TOTAL: 260/260 proposals validate across 2 file(s). Cross-file duplicates: 0.
  ```
- **Gate result this batch:** 245/245 validated (260/260 population total including
  batch 1), 0 drops, 0 fabricated ids, 0 cross-file duplicates.
- **Write order matters:** apply `batch-001-corroboration.json` (already live — SKIP, it's
  there) then `batch-002-ares-vr-reconciliation.json`. The gate script's dedup guard will
  catch it if applied twice.

## 2. Shared-vault additions (exact text to append — I did not edit these files)

### → `docs/data-analysis/patterns.md`

```
## [[patterns]] Money · ARES VR ostatniOrgany (supervisory boards) is a load-bearing section, not optional (money batch 002)
The VR (veřejný rejstřík) JSON has TWO parallel officer sections with identical shape:
`statutarniOrgany` (statutory officers — jednatel/představenstvo) and `ostatniOrgany`
(supervisory/other bodies — dozorčí rada, kontrolní komise). Reading only the first
mis-scored 91/245 ties as "conflicting" (unconfirmed); most `steward`-class ties (200/260 of
the population) are exactly supervisory-board seats, which live in `ostatniOrgany`. Adding
it: conflicting 91→23, registry-confirmed 96→164. Any future ARES-VR consumer must read
BOTH sections (and `spolecnici` for ownership stakes) — omitting one systematically
under-confirms whichever tie-class maps to it.

## [[patterns]] Money · pre-2000s ARES VR historical entries often lack birth dates (money batch 002)
Officer/shareholder records added under paper-era filings (roughly pre-1997/2002) frequently
have no `datumNarozeni` on the `fyzickaOsoba` object, even when name + role period match the
claimed tie exactly. A strict birth-date-exact matcher (correctly conservative for modern
records — see money-feed.ts's `bridgePerson` discipline) produces false "conflicting" on
these older ties. Batch 002 caught 3/10 reviewed ambiguous units this way (Babiš/AGRONOVA CS,
Janulík×2). Recommended fix for a future batch: a name-similarity fallback pass, gated to
ONLY entries with a null birth date, before defaulting to conflicting — not yet implemented,
so the residual `conflicting`/`registry-unconfirmed` buckets likely still under-read this
vintage (Opus reflection risk flag #1).

## [[patterns]] Money · undated contracts must not be silently treated as "after" a date (money batch 002)
A `money-postdates-role` classification requires an ACTUAL dated contract signed after the
confirmed role end — a contract with `signedOn: null` is UNDATED, not "later". The first
version of `reconcile-ares-vr.ts` conflated the two (caught by the Opus reflection); fixed to
require `datedSigned.length > 0` before classifying postdate vs within-tenure, with a new
honest bucket `historical-undated-money` for the has-money-no-dates case. 0 ties were
affected in this run (every company with reachable money had at least one dated contract),
but the design gap is now closed for future runs/other cases with the same pattern.
```

### → `docs/data-analysis/contradictions.md`

```
## [[contradictions]] Money batch 002 — wrong IČO suspected (Bendl + Brabec → "PRAK")
Both Petr Bendl and Richard Brabec carry a `linked_to` tie sourced from Hlídač as "PRAK,
member of the board of directors (představenstvo)" against IČO 49683144 ("PRAK spol.
s r.o."). That IČO has been an s.r.o. since 1993 (jednatelé/společníci only) and
structurally cannot have a představenstvo. Sonnet-review independent lookup
(rejstrik-firem.kurzy.cz) found a SEPARATE, dissolved "PRaK, a.s." where an "Ing. Petr
Bendl (Kladno)" is a documented board member 1996–1999, liquidated 2012 — almost certainly
the correct entity under a DIFFERENT IČO. Resolution: kept `conflicting`/`signal:0` on both
ties (never asserted false, never re-pointed without evidence), flagged
`wrong-entity-suspected`/`needs-ico-re-resolution` on both. Re-resolving the correct IČO
for "PRaK, a.s." is next-batch work, not done here (no IČO minted without confirmation).
```

### → `docs/data-analysis/feature-opportunities.md`

```
## [[feature-opportunities]] O-money-2 — Temporal-status badge on /penize ledger + console — SHIPPED (batch 002)
`features/money/moneyTypes.ts`'s `temporalBadge()` is the single source of truth: renders
"trvá" only when corroboration=registry-confirmed AND the role has no recorded end;
"ukončeno {year}" for a confirmed-ended role; "peníze po roli (do {date})" (warn tone) for
money-postdates-role; a neutral "neověřeno vůči ARES VR" for any tie not yet reconciled or
whose registry match failed. Wired into both `/penize` (`TiesLedger.tsx`) and
`/penize/kontrola` (`VerificationConsole.tsx`), which now shows the actual confirmed period
instead of a generic "go check ARES VR" nudge once a tie is reconciled. Graceful degradation:
absent props render the neutral badge, never "active". No `messages/*.json` edit — followed
the established VerificationConsole precedent of hardcoding Czech-first copy directly.

## [[feature-opportunities]] Q-money-1 — Full-population ARES-VR reconciliation — DONE (batch 002)
All 260/260 ties now carry a corroboration verdict (179 registry-confirmed / 23 conflicting /
58 registry-unconfirmed) + temporal_status where confirmable. `AresClient.vrRecord()`
(`lib/analysis/money-feed.ts`) is the reusable fetch method any future batch/case can build
on. See `docs/data-analysis/case-money/batch-002.md` for the full breakdown.
```

### → `docs/data-analysis/frontier.md` (money section)

```
## [[frontier]] Money (batch 002 additions)
- Q-money-5: Aleš Juchelka, as sitting minister (2026), reportedly gave subsidy-influence
  advantage to an advisor who runs her own subsidy-adjacent firm (ct24.ceskatelevize.cz
  coverage) — surfaced incidentally while reviewing a stale 2014–2016 tie; UNRELATED to that
  tie, a fresh live lead worth its own pass.
- Q-money-6: Tomio Okamura's 2016 sale of his U Machtů s.r.o. stake appears undisclosed in
  that year's mandatory MP asset declaration (Týden.cz, HlídacíPes independently report this)
  — a distinct, verifiable non-disclosure story separate from the money-flow tie itself.
- Q-money-7: re-resolve the correct IČO for "PRaK, a.s." (Bendl + Brabec ties currently point
  at the wrong entity, 49683144 — a same-named but structurally incompatible s.r.o.).
- Q-money-8: 58 ties are structurally unreachable via ARES VR (special-law public bodies —
  VZP, ČT, ČRo, universities, state hospitals not in the Obchodní rejstřík). If this
  population is ever prioritized, corroboration would need a different source (the body's
  founding statute/zákon) — low urgency, all are steward-class by construction.
- Q-money-1 (closed): full-population reconciliation done, see batch-002.md.
```

### → `docs/data-analysis/graph-log.md`

```
2026-07-24 · money batch 002 (Sonnet-only, full-population ARES-VR reconciliation +
O-money-2 build) · NOT YET WRITTEN (fleet handoff). 245 linked_to corroboration annotations
proposed (payloads/batch-002-ares-vr-reconciliation.json), gate 245/245 (260/260 population
total with batch 1). No review_state change. Provenance track:"money", pass TBD by lock
holder (expected 16+, after effort/law's batch-002 passes if run in the same window).
```

## 3. Proposed enum / schema changes

- **No new enum values needed** — `corroboration` and `tie_class` stay within batch 001's
  value sets. `temporal_status` gains two ADDITIVE values used this batch:
  `money-postdates-role` (already documented in batch 001's handoff) plus
  `historical-undated-money` (new — "has reachable money but none of it carries a
  disclosed date to compare against the role end"). If `kg-verdict.ts` enum-gates edge
  props, add `historical-undated-money` to the `temporal_status` value set there (SHARED
  file — orchestrator's edit, not mine).
- **No new node/edge KIND** proposed. `O-money-3` (indirect-ownership `owns`/`controls`
  layer) remains a candidate for a later batch, still not implemented.

## 4. Commit plan (orchestrator — per-case commit)

Files, all inside the money boundary:

```
NEW  scripts/case-loops/money/reconcile-ares-vr.ts             # the batch's core: deterministic ARES-VR reconciliation
EDIT scripts/case-loops/money/validate-payloads.ts              # multi-file gate + cross-file duplicate guard
EDIT lib/analysis/money-feed.ts                                 # AresClient.vrRecord() — new token-free VR fetch method
EDIT features/money/moneyTypes.ts                                # temporalBadge() + Corroboration type + MoneyTie fields
EDIT features/money/getMoneyData.ts                              # reads corroboration/role_valid_to/temporal_status
EDIT features/money/components/TiesLedger.tsx                    # renders the O-money-2 badge
EDIT features/money/reviewTypes.ts                                # ReviewTie gains corroboration/roleValidFrom/To/temporalStatus
EDIT features/money/getVerificationData.ts                       # reads the same props for the console
EDIT features/money/components/VerificationConsole.tsx           # renders the badge, replaces the generic "check ARES VR" nudge
EDIT docs/data-analysis/case-money/{ledger.md,ledger.json}
NEW  docs/data-analysis/case-money/batch-002.md
EDIT docs/data-analysis/case-money/handoff.md                    # this file (supersedes batch-001's)
NEW  docs/data-analysis/case-money/payloads/batch-002-ares-vr-reconciliation.json
NEW  docs/data-analysis/case-money/payloads/batch-002-ambiguous-inputs.json  # dossier-inputs for the 10 Sonnet-reviewed units
NEW  docs/data-analysis/case-money/reconcile-summary.json         # machine summary the script emits
```

Suggested message:
```
feat(case-money): full-population ARES-VR reconciliation (Q-money-1) + O-money-2 temporal badge

Reconciles all 245 remaining pending MP<->company ties (batch 001 covered the top 15)
against ARES VR deterministically — birth-date-exact officer/shareholder matching, no LLM
for the bulk. Gate 260/260 population, 0 fabricated, 0 duplicates. 10 ambiguous units
Sonnet-judged (3 false negatives corrected, 1 wrong-entity catch, 4 clean-handoff
confirmations). Ships the temporal-status badge on /penize + /penize/kontrola so a stale
tie never renders as active. No review_state changed.
```

**Check status:** `npx tsc --noEmit` clean (repo-wide). `npx eslint features/money app/penize
scripts/case-loops/money lib/analysis/money-feed.ts` clean. `npx vitest run` 166/166 green.
`npm run check`'s single failure (`features/lawwatch/LawWatchPage.tsx`,
`react/jsx-no-undef`) is the concurrent sibling **law** loop's file — not touched by this
batch, same pattern batch 001 documented for sibling fleet-loop errors.

## 5. Write-path handoff (unchanged from batch 001, now higher-value)

Still open: `POST /penize/kontrola` server action to let a human reviewer set
`review_state:"verified"` (confirm) or write a `review_note` (reject/needs-more). Now more
valuable — every one of the 260 pending ties carries a registry corroboration verdict a
reviewer can act on immediately, versus batch 001's 15. Still explicitly out of scope for
fleet mode (single-writer `.pglite`).

## 6. Opus reflection — quality-vs-batch-001 verdict + cost/unit (verbatim)

> **VERDICT: Quality HOLDS against batch 001's bar for the reconciliation objective
> (Q-money-1), and on honest-negative discipline it EXCEEDS it** — with one systematic
> under-confirmation caveat and two semantics that can mislead a reviewer.
>
> **Why it holds.** Batch 001 itself concluded that ARES-VR birth-date matching is a clean
> deterministic gate and full-population reconciliation "is deterministic once the VR fetch
> is wired in." Batch 002 executes exactly that. The birth-date-exact hinge is the same
> discipline the Sonnet army applied by hand in 001 — coded, it loses nothing on the
> confirmable majority (164/245 registry-confirmed) and gains consistency across 200
> steward seats. The `ostatniOrgany` fix is real and correct (91→23 conflicting is the
> right direction).
>
> **Honest-negative rate exceeds 001.** 81/245 (33%) left conflicting/unconfirmed rather
> than force-fit; ~50/58 unconfirmed share one correctly-declined OSVČ sentinel. Nothing
> manufactured; gate 260/260 with a real cross-file duplicate guard.
>
> **Where it does genuinely LESS than 001** (a different pass, not a regression): the
> deterministic bulk carries none of 001's discovery-grade narrative (indirect ownership
> chains, donation leads, media corroboration). The 10 hand-reviewed ambiguous units match
> 001's dossier depth and citation discipline exactly, and the depth was spent precisely
> where determinism was blind.
>
> **Cost/unit.** Batch 001: ~30k tokens/tie all-in. Batch 002: deterministic bulk ≈0 LLM
> tokens; ~10k/unit on the 10 reviewed; one Opus reflection call. Amortized ≈**400
> tokens/unit — ~75× cheaper.** A genuine efficiency win FOR reconciliation — cheaper
> because it defers narrative discovery, not because it skimps on the task it set.
>
> **Top 3 risk flags before human review:**
> 1. The pre-2000s null-birthdate false-negative was hand-corrected for only 3 units; the
>    deterministic pass was not re-run with a name-similarity fallback, so residual
>    conflicting/unconfirmed buckets still likely hide confirmable older-cohort roles.
> 2. `money-postdates-role`'s undated-contract conflation (fixed same-session after this
>    flag — see §3 and patterns.md addition above).
> 3. The Bendl/Brabec wrong-IČO catch was asymmetrically flagged (fixed same-session —
>    Brabec's tie now carries the same `wrong-entity-suspected` flag as Bendl's).
>
> Bendl/PRAK handled safely: kept `conflicting`/`signal:0`, never asserted the tie false,
> only "probably wrong IČO, re-resolve." Correct restraint. The temporalBadge/console/ledger
> build is sound: graceful degradation, token-only colors, Czech-first hardcoded copy
> consistent with the fleet-locked-i18n pattern.

*(Both flags #2 and #3 the reflection raised were fixed in this same session before this
handoff was finalized — see the `patterns.md` addition and the Bendl/Brabec contradiction
entry above.)*

## 7. Lessons learned (calibrates the skill/kernel — be specific)

1. **The ARES-VR `ostatniOrgany` section is load-bearing, not optional** — see
   patterns.md addition. Any future ARES-VR consumer (this case or another) must read
   `statutarniOrgany` + `ostatniOrgany` + `spolecnici`, not just the first.
2. **Pre-2000s VR records often lack birth dates** — a real limitation of the
   birth-date-exact discipline (correctly conservative for modern records) that a future
   batch should close with a gated name-similarity fallback, not loosen the modern-record
   matcher.
3. **Model tiering held**: near-zero LLM cost for population-scale deterministic
   reconciliation, Sonnet depth preserved exactly where the deterministic pass couldn't
   judge, Opus reserved for the one reflection call that caught two real bugs (undated-money
   conflation, asymmetric flagging) a Sonnet-only pass might have missed or accepted.
   **Recommend keeping this tiering for future population-scale batches** — Opus-as-QA on
   the batch's own output, not on unit processing, is where it earned its cost this time.
4. **The "conflicting" semantic needed a cleaner, deterministic definition than batch 001's
   narrative "graph says ongoing but registry disagrees" framing** (which wasn't itself a
   strict rule — see batch-001 payload spot-check). Batch 002's identity-match-based
   semantics (`registry-confirmed` = positively identified the MP among registry roles;
   `conflicting` = registry exists but could NOT identify this MP; `registry-unconfirmed` =
   couldn't even attempt the check) is more defensible at population scale and should be the
   skill's stated definition going forward.
5. **Concurrency**: this batch used 2 foreground Sonnet subagents (5 units each) + 1 Opus
   reflection, well under the fleet's shared cap — a full-population deterministic pass
   needs almost no subagent budget, freeing the concurrency cap for the sibling effort/law
   loops running in the same window.

## 8. Cleanup

`.pglite-copy-money` removed at end of run (`rm -rf`). Re-create from `.pglite` to
re-validate payloads (command in §1).
