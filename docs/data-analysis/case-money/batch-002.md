# Money loop — batch 002 (full-population ARES-VR reconciliation + O-money-2)

Case ① FollowTheMoney · 2026-07-24 · fleet mode (money loop) · **Sonnet-only** (driver +
army; Opus reserved for the reflection call — the batch-002 model-tiering experiment).
Population: **260 `linked_to` ties**, all `pending_review`. This batch reconciles the
**245 ties batch 001 did not reach** (batch 001 covered the top 15) against ARES VR, and
ships the O-money-2 temporal-status badge.

> Web-research doctrine held: every Sonnet-judged claim carries `{claim, url, accessedAt}`;
> ARES VR (token-free, primary registry) outranks media. **No `review_state` touched.**

## Q-money-1 — full-population reconciliation

`scripts/case-loops/money/reconcile-ares-vr.ts` — deterministic (no LLM) for the bulk. For
each of the 245 remaining ties: fetch ARES VR (`ekonomicke-subjekty-vr/{ico}`, token-free,
throttled ~150ms/req ≈ 400 req/min, well under the ~500/min budget), match the MP to an
officer/shareholder record by **exact birth date** (same discipline as `money-feed.ts`'s
`bridgePerson` — never a name-only guess), derive `corroboration` + `role_valid_from/to` +
`temporal_status` + `tie_class` in code.

**Methodology fix caught mid-run:** the first pass read only `statutarniOrgany` (statutory
officers) and scored a suspicious 91/245 `conflicting`. ARES VR's `ostatniOrgany` section
(supervisory boards — dozorčí rada, kontrolní komise; **same JSON shape** as
`statutarniOrgany`) is a *separate* top-level key, and most `steward`-class ties (200/260 of
the population) are exactly these supervisory-board seats. Adding it: `conflicting` 91→23,
`registry-confirmed` 96→164. Documented as a driver-caught bug, not a data finding — see
lessons in `handoff.md`.

**Second fix, caught by the Opus reflection:** `money-postdates-role` was computed as "no
contract signedOn ≤ role end", which silently treated an UNDATED contract (`signedOn: null`)
as postdating. Fixed to require an actual dated contract before classifying either way; a
company whose only reachable money has no disclosed date now gets its own honest bucket,
`historical-undated-money` (0 occurrences in this run's data — the fix is defensive, didn't
change any output here, but closes a real design gap for future runs).

### Population results (260/260 gated)

| corroboration | count | meaning |
|---|---|---|
| registry-confirmed | **179** (15 batch 1 + 164 batch 2) | exact birth-date match found among VR officers/shareholders |
| conflicting | **23** (3 batch 1 + 20 batch 2) | VR record exists, no birth-date match for this person (or Sonnet-confirmed wrong-entity) |
| registry-unconfirmed | **58** | ICO has no VR record at all — mostly special-law public bodies (VZP, ČT, ČRo, universities, state hospitals) not registered in the Obchodní rejstřík; a genuine structural gap, not a data-quality defect |

| temporal_status (registry-confirmed only) | count |
|---|---|
| current | 43 (39 batch 2 + 4 batch 1) |
| historical | ~76 |
| money-postdates-role | 39 |
| historical-no-money / historical-undated-money | ~22 |

**Gate:** `scripts/case-loops/money/validate-payloads.ts` (extended to validate multiple
payload files + a cross-file duplicate guard) → **260/260** proposals validate, 0 fabricated
ids, 0 duplicates across batch-001/batch-002.

## Sonnet-judgment pass (10 ambiguous units, per the "Sonnet judges only ambiguous
matches" doctrine)

Two Sonnet army agents (5 units each, real WebFetch+WebSearch, batch-001 dossier depth)
reviewed the deterministic pass's `conflicting` and `money-postdates-role` head units
(ranked by signal score):

- **3 false negatives corrected** (Babiš→AGRONOVA CS, Janulík→Poliklinika Břeclav,
  Janulík→POLIKLINIKA-servis): pre-1997/2002 ARES VR historical entries often lack a birth
  date; independent name+period matching confirmed all three. Corrected `conflicting` →
  `registry-confirmed`.
- **2 confirmed negatives** (Babiš→AGROPROFIT, Kučera→Sirius Praha): no corroborating
  identity found anywhere; verdict stands.
- **4 money-postdates-role units** (Juchelka/YOU STORY UP!, Šťastný/GEKO SPORT,
  Okamura/U Machtů, Decroix/ELEMENTA) confirmed as **clean historical handoffs**, not
  revolving-door — ownership passed to an unrelated co-founder/buyer before any reachable
  contract. One independent lead surfaced: Okamura's 2016 stake sale appears **undisclosed**
  in that year's mandatory asset declaration (Týden.cz, HlídacíPes) — a distinct,
  independently-sourced non-disclosure story, not part of this tie (→ frontier Q-money-6).
- **1 wrong-entity catch** (Bendl/Brabec → "PRAK spol. s r.o.", IČO 49683144): the Hlídač
  source claims a "člen představenstva" (board of directors) role, but this IČO is an s.r.o.
  since 1993 — structurally cannot have a představenstvo. A separate, dissolved "PRaK, a.s."
  fits the claim better. Kept `conflicting`/`signal:0`, flagged
  `wrong-entity-suspected`/`needs-ico-re-resolution` on **both** the Bendl and Brabec ties to
  this IČO (Brabec's flag was missing until the Opus reflection caught the asymmetry — fixed
  same session).

## O-money-2 — temporal-status badge (build, R=1)

Shipped on both `/penize` (ledger) and `/penize/kontrola` (console):
`features/money/moneyTypes.ts` (`temporalBadge()` — the single source of truth for how a
tie's reconciliation state renders), wired into `getMoneyData.ts`/`TiesLedger.tsx` and
`getVerificationData.ts`/`reviewTypes.ts`/`VerificationConsole.tsx`. **A tie never renders as
active unless the registry positively confirms it**: absent `corroboration` (not yet
reconciled — 0/260 in the live graph beyond batch 001's 15 until the orchestrator persists
this batch) → neutral "neověřeno vůči ARES VR", never green "trvá". The console's old generic
"ongoing — go check ARES VR" nudge now only fires when there's genuinely no registry answer
yet; once reconciled, it shows the real confirmed period instead.

Followed the established i18n precedent (`VerificationConsole.tsx` already hardcodes
Czech-first copy with a `useLocale()`-only pattern, not `useTranslations`) rather than adding
keys to the fleet-locked `messages/*.json` — no shared file touched.

**Check status:** `npx tsc --noEmit` clean (repo-wide). `npx eslint features/money app/penize
scripts/case-loops/money lib/analysis/money-feed.ts` clean. `npx vitest run` 166/166 green.
`npm run check`'s one failure (`features/lawwatch/LawWatchPage.tsx`, `react/jsx-no-undef`) is
the concurrent sibling **law** fleet loop's file, untouched by this batch (same pattern
batch 001 documented for sibling-loop errors).

## Cost / model-tiering read (batch-002 experiment)

- 235 of 245 units: pure deterministic script, ~0 LLM tokens (ARES HTTP only).
- 10 ambiguous units: 2 Sonnet agents × ~50k tokens ≈ 102,932 tokens total ≈ 10.3k/unit.
- 1 Opus reflection call (xhigh): 87,065 tokens (one-time, batch-level, not per-unit).
- Amortized ≈ **~420 tokens/unit** across all 245, vs batch 001's documented ~30k
  tokens/tie — roughly **75× cheaper** for the reconciliation objective. See the Opus
  reflection verdict in `handoff.md` for whether this holds quality (it does, with caveats).

## Cleanup

`.pglite-copy-money` removed at end of run (`rm -rf`). Re-create from `.pglite` to
re-validate payloads (command in `handoff.md` §1).
