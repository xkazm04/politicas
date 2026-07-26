# Batch 007 — the dossier prose debt paid off: 136/136 pre-006 dossiers rewritten, 207/207 now render

*Case ② Effort · 2026-07-26 · fleet mode (law/money loops concurrent in the same tree; Q-effort-15)*

Batch 006 closed population coverage at 207/207 and shipped a hard-DROP public-copy gate
(`publicCopyViolations`, Q-effort-14) for the three dossier fields that render **verbatim** to
voters on `/poslanec` — but the gate only guards *future* writes. It measured **136 of 207 live
person nodes / 436 field-instances (its own count formula)** already leaking pipeline jargon in the
graph, all from batches 001–005, invisible only because a render-time guard withholds violating
strings whole rather than shipping them broken. This batch pays that debt off.

---

## 1. Measured baseline (real, re-derived — not carried forward from batch 006's number)

On a disposable `.pglite` copy, using the exact rules the gate now enforces:

| metric | value |
|---|---|
| leaking person nodes | **136 / 207** |
| leaking field-instances | **205** (effort_notes 132, effort_public_role 30, effort_bill_focus 43) |
| rule-hits (sum of all matched rules) | 465 |
| origin | **exactly** batches 1–5 (5+16+35+35+45=136, cross-checked against `ledger.json`'s per-unit `batch` field) — batch 006's own 42 are confirmed clean |

The 136/207 count differs from the 436-field-instance figure documented in `public-copy.ts`'s
comment because that count predates a fix made in this batch (§2) — see the note there for why the
two numbers are not directly comparable, and why 205 (not 436) is the correct current figure.

## 2. A real divergence found and fixed before any rewriting started

`public-copy.ts`'s own docstring claimed **"this module is the one definition both [gate.ts and the
render loaders] import"** — false. `gate.ts` carried its **own duplicated** `PIPELINE_JARGON` array
with a 6th rule ("API/pipeline mechanics": endpoint/REST API/JSON/pipeline/dossier) that
`public-copy.ts`'s render-time guard did not have. Consequence: a string containing "endpoint" or
"JSON" would be **DROPPED at persist time** by the gate but **NOT withheld at render time** by
`publicCopyOrNull()` — an enforcement gap where old data with that specific jargon class could
render un-withheld.

Fixed: the canonical rule list (plus a new `jargonViolationDetails()` export carrying the matched
substring) now lives only in `lib/analysis/public-copy.ts`; `gate.ts` imports it. Regex literals were
moved byte-identical (same flags, same escaping) — the reflection pass independently verified this,
confirming the gate's persist-time permissiveness is unchanged and only the render-time guard got
strictly *stronger*. Added test coverage for the unified rule and for `jargonViolationDetails()` in
`lib/analysis/public-copy.test.ts`.

## 3. The rewrite — 6 parallel Sonnet groups, 136/136 mechanical rewrites

Each leaking node's flagged field(s) only were rewritten by a Sonnet subagent (23-per-group × 5 +
21 for the last), instructed to: strip the exact jargon patterns the gate checks; preserve every
fact, date, IČO, amount, and hedge; relocate removed pipeline-internal residue verbatim into a new
non-rendered `effort_analyst_note` (the batch-006 pattern) rather than discard it; leave clean fields
untouched; carry citations forward unchanged. Names were separately backfilled from the graph's
`label` field (not `props.name`, which several subagents correctly could not find — they left names
blank rather than invent one, a good abstention call).

**Gate result: 136/136 PASS, 0 DROP** (first pass, no rework needed on the jargon dimension). 21
Q-effort-11 numeric soft-fail warnings, confirmed spot-checked against the pre-rewrite payloads to be
**pre-existing**, not introduced by this rewrite (numbers were never touched by instruction).

## 4. The money-fidelity catch — the mechanical rewrite quietly broke hedges on 11 of 44 dossiers

44 of the 136 rewritten dossiers carry company/ownership-tie language. Rule #4 of this batch's
mandate requires two independent verification layers on any money-touching claim; since the
underlying facts were already established (and re-verified) by their originating batches, the
relevant verification here is **rewrite fidelity** — did stripping jargon also silently change what
the dossier *asserts*. A dedicated Opus pass diffed original vs. rewritten text for all 44 and found:

- **34 CONFIRMED** faithful.
- **7 BLOCKING**: the mechanical rewrite had, while removing jargon, also **merged in later
  verification-pass findings** and converted explicitly-unproven or explicitly-hedged company ties
  ("nepodařilo se ověřit", "pending_review", "nelze potvrdit") into **flat, uncited assertions** of
  current board seats or ownership. Worst case: **Petr Hladík** (sitting minister) — a hedged
  non-finding about ARENA BRNO board membership became an asserted supervisory-board chairmanship
  explicitly framed as "covering the award period of a 5.39bn CZK contract." Others: Hrnčíř, Válková,
  Foldyna, Bartošek, Decroix, Pařil — same failure class, none newly cited.
- **3 NEEDS_CORRECTION**: two lost the specific IČO identifying which of several linked companies a
  failed lookup applied to (Schrek, Adamec); one (Hoffmannová) had a load-bearing "this figure has
  never been tied to her by contract" caveat relocated into the non-rendered analyst note, silently
  weakening a public claim by omission.

All 10 flagged entries were patched **in place** using the Opus pass's recommended text (which
restores the original hedge/framing while keeping the jargon-free phrasing, and moves the
newer-but-uncited registry findings into `effort_analyst_note` behind an explicit "add a citation
before this renders as fact" precondition). Re-gated: still 136/136 PASS, 0 DROP.

## 5. Reflection — one more entry the money pass itself missed, plus two process gaps

Opus reflection (max depth) independently re-verified the code fix (byte-identical regex migration,
confirmed), re-audited the "CONFIRMED" money verdicts, and confirmed all 10 corrections landed
byte-exact in the payload. It also found what the dedicated money pass missed:

- **D1 (fixed here): `psp:person:5459` Radim Fiala**, rated CONFIRMED by the money pass, in fact
  carries the *exact same class* of defect — `effort_notes` states flatly "a od června 2026 dozorčí
  radě ČEZ" while the untouched `effort_public_role` field (not itself flagged as leaking, so never
  rewritten) hedges the identical claim ("NEOVĚŘENO touto verifikací"). Tracing it back: the unhedged
  mention already existed in the *original* batch-004 text, so this batch didn't introduce the
  inconsistency — but it is exactly the class of defect this batch exists to catch, so it was fixed:
  `effort_notes` now carries the same hedge as `effort_public_role`. **11 of 44, not 10 of 44, money
  dossiers needed correction.**
- **D2 (escalation, addressed with a test): `effort_analyst_note` is an unprotected jargon sink.** 38
  of 136 notes carry pipeline jargon by design (that's the point of the field) and
  `PUBLIC_RENDER_FIELDS` deliberately excludes it from the gate, so nothing stops a future profile
  change from wiring it into a render path and shipping all of it silently. Added a source-grep guard
  test (`lib/analysis/public-copy.test.ts`) asserting `getProfileData.ts`, `ProfilePage.tsx`, and
  `getLeaderboardData.ts` never reference the field name — cheap, durable, catches the mistake at
  test time rather than in production.
- **D3 (fixed here): `headline` was dropped from all 136 outputs.** `headline` isn't persisted (see
  §7), but `gate.ts`'s Q-effort-11 scan also reads it — added in batch 004 specifically because a
  real numeric defect (Výborný, Kolovratník) lived in the headline and nowhere else. Restoring the
  original headline into the payload surfaced 8 additional legitimate soft-fail warnings this batch
  would otherwise have silently skipped past.

**Verdict: ACCEPT WITH REQUIRED FOLLOW-UPS** — all three addressed before this handoff (D1 patched,
D2 tested, D3 restored); re-gated and re-verified after each.

## 6. Verified render end-to-end (kernel step 6)

On the disposable copy, after persisting the corrected payload:

| check | before this batch | after |
|---|---|---|
| leaking person nodes (`jargonViolations`) | 136/207 | **0/207** |
| withheld field-instances (`publicCopyOrNull`, the actual render-time function `getProfileData.ts`/`getLeaderboardData.ts` call) | 205 | **0** |
| person nodes rendering ≥1 dossier field | 71/207 | **207/207** |
| person nodes rendering all 3 fields | — | 180/207 (the other 27 legitimately lack content in one field — e.g. zero bills authored, no low-score reason — not a defect) |

This was measured against the real `publicCopyOrNull` import, not a re-derivation of its logic.

## 7. `npm run check`

Effort-owned paths (`gate.ts`, `public-copy.ts`, `public-copy.test.ts`, new
`measure-baseline.ts`) clean on typecheck + lint. Repo-wide: typecheck ✅, **352/352 tests** ✅ (5 new
this batch), lint ✅ — repo-wide lint was failing on a concurrent sibling loop's file
(`scripts/case-loops/money/*.ts`) mid-batch, outside this boundary; clean by the time of the final
check (fixed by that sibling loop during this same fleet window).

## 8. What did NOT happen this batch (explicit, so it isn't assumed)

- **No live write.** Every gate run, persist, and render check ran against `.pglite-copy-effort`
  (recreated fresh from `.pglite` three times to avoid compounding), deleted at the end.
- **No re-verification of underlying money facts against ARES/psp.cz.** The money-fidelity layer
  checked that the rewrite is a faithful restatement of what was already recorded (and, per prior
  batches' own P51 gates, already fact-checked at the time it was written) — it is not a fresh
  ARES sweep of all 44 entities. Where the fidelity check surfaced findings from a *later*
  verification pass that had never made it into the public field with a citation (Hladík, Hrnčíř,
  Válková, Foldyna, Bartošek, Decroix, Pařil), those findings are now explicitly parked in
  `effort_analyst_note` behind a stated precondition ("add the registry citation before this renders
  as fact"), not asserted publicly and not discarded.
- **`headline` is confirmed not persisted anywhere** (`persist-batch.ts` only threads `props` +
  `citations` into the graph) — restoring it into the payload (§5, D3) only widens the gate's own
  Q-effort-11 scan surface, it does not change what gets written.
