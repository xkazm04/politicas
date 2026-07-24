# Money loop — batch 003 (2026-07-24)

Case ① FollowTheMoney · fleet mode (effort + law loops concurrent) · Sonnet
driver + 2 Sonnet build/research subagents + 1 Opus reflection. **No army run**
this batch — population reconciliation was already complete (260/260, batch
002). Scope: (1) ship the human-review WRITE PATH — the seed backlog's #1
build-ready item since batch 001, now the top item three batches running; (2)
Q-money-7 — re-resolve the wrong-IČO "PRaK" tie flagged in batch 002.

## 1. The build — `ReviewRepository` + `/penize/kontrola` write path

**Design.** A narrow `ReviewRepository` was added to the `Store` (additive
carve-out into `lib/db` granted for this batch only — see
`docs/case-loops.md`'s fleet rules, normally `lib/db` is out of case boundary):

- `lib/db/pglite/ddl.ts` — new append-only `review_audit` table (id uuid pk,
  src/rel/dst, decision, reviewer, note, decided_at, prior_state), two
  indexes (edge key, decided_at desc). Idempotent (`create table if not
  exists`), additive only.
- `lib/db/store.ts` — new `ReviewRepository` interface: `setTieReviewState(src,
  dst, decision, reviewer, note)` and `listReviewAudit(opts?)`. Spread into
  `Store` alongside the five existing repositories.
- `lib/db/pglite/repositories/review.ts` — the implementation, and **the only
  code path in the app that writes `kg_edge.props.review_state`**. Audit row
  written first (`review_audit` insert), then the edge props update. `confirm`
  → `review_state:"verified"`; `reject`/`needs-more` → stays
  `"pending_review"`, decision recorded in `props.last_decision` /
  `last_reviewer` / `review_note` instead.
- `features/money/reviewActions.ts` — a `"use server"` Next action,
  `submitReviewDecision`. Reviewer identity: `REVIEWER_NAME` (display name) +
  `REVIEWER_TOKEN` (shared secret) read server-side from env, compared against
  a client-submitted token. `REVIEWER_TOKEN` unset → returns a distinct
  `{status:"not-configured"}` **before touching the store**, so the console
  stays honestly read-only instead of a confusing failure. Documented in
  `.env.example`.
- `features/money/components/VerificationConsole.tsx` — wired the previously
  stubbed confirm/reject/needs-more buttons to the action: optimistic local
  state, then reconciles against the real result; distinct visual states for
  `ok` / `not-configured` / `unauthorized` / `not-found` / `error`.
- Tests: `lib/db/pglite/repositories/review.test.ts`, 5/5, on an isolated
  `fs.mkdtempSync` PGlite dir (never `./.pglite` or `./.pglite-copy-money`).
  Covers audit-row-before-flip with correct `prior_state`, confirm→verified,
  reject/needs-more→NOT verified, and — the strongest test in the file —
  verified-tie-drops-from-the-REAL `getVerificationQueue()` loader (not a
  re-derived filter).

**Checks:** `npx tsc --noEmit` clean repo-wide. `npx vitest run` 171/171 →
176/176 after the Opus pass added coverage elsewhere in the same window (see
§4). `npm run check` lint: 2 pre-existing failures in a sibling **effort**
loop's untracked file (`scripts/case-loops/effort/divergence-retune.ts`), not
touched by this batch, confirmed via `git status`.

## 2. Q-money-7 — PRaK IČO re-resolution

**Finding:** the correct entity is likely **IČO 61858111, "PRaK, a.s. v
likvidaci"** — Praha–Kladno rychlodráha (rapid-rail) special-purpose vehicle,
founded 1994-08-16, Městský soud v Praze B 2674/MSPH, dissolved 2012-12-13.
Petr Bendl (Kladno) listed dozorčí rada 1995-04-21→1996-01-15 then
představenstvo from 1996-01-16; Richard Brabec (Kladno-era) also listed on the
board 1994-08-16→1996-01-15. Corroborates the currently-graphed IČO
(49683144, "PRAK spol. s r.o.") is definitively wrong: ARES confirms it is an
s.r.o. (cannot have a představenstvo) and is **still active today**
(`datumZaniku: null`) — structurally incompatible with the "1996–1999,
dissolved" tie on both counts.

**Not yet graph-ready — annotation only, per doctrine.** The Opus reflection
(§4) downgraded the sourcing confidence from the research agent's "high" to
**medium**: ARES REST returns 404 for IČO 61858111 on both the subject and VR
endpoints (calibrated against a known-good IČO to rule out a URL bug) — this
entity is dissolved pre-ARES's online reach, so **it is structurally outside
the repo's own primary-source corroboration path** (the same class of gap as
the 58 registry-unconfirmed special-law bodies, batch 002 §Q-money-8). All
corroboration is via the kurzy.cz aggregator + one psp.cz stenoprotokol
(context only, no IČO) + one city-council document + one independent news bio
for Brabec. The claimed Bendl end date (1999-07-28, from the aggregator's
person-index page) conflicts with the company-history page's own listed end
(2002-12-31, likely *funkce do* vs *vymazáno* — unresolved).

**The consequential flag:** PRaK a.s. is a municipal rail SPV; Bendl's seat
looks like a **mayoral ex-officio public appointment** (he was Kladno mayor
1994–1998), not a private business interest. Re-pointing the edge without
reclassifying `tieClass` from whatever it inherits to **steward** would
misrepresent a public appointment with the visual grammar the console uses for
private conflicts of interest — against a named sitting MP. **This must ship
together with the re-point, not after it**, if a future batch acts on this.

Proposed payload content (NOT applied — annotation-only per the batch spec,
edge re-point is an orchestrator/graph decision):
```json
{
  "tie": "Bendl↔PRAK (currently ico:49683144)",
  "correct_ico_candidate": "61858111",
  "correct_ico_candidate_name": "PRaK, a.s. v likvidaci",
  "confidence": "medium — aggregator-sourced (kurzy.cz), ARES/or.justice.cz primary lookup returns 404/unfetchable (entity dissolved 2012, pre-ARES-REST reach)",
  "evidence": [
    "https://rejstrik-firem.kurzy.cz/61858111/prak-a-s-v-likvidaci/",
    "https://rejstrik-firem.kurzy.cz/osoba/667209/ (Bendl)",
    "https://rejstrik-firem.kurzy.cz/osoba/700372/ (Brabec)",
    "https://www.psp.cz/eknih/2017ps/stenprot/062schuz/bqbs/b32450501.htm (context only, no IČO)"
  ],
  "open_items": [
    "resolve Bendl end date: 1999-07-28 (person page) vs 2002-12-31 (company history page)",
    "reclassify tieClass to steward if re-pointed — this is a public-body seat, not private enrichment",
    "no birth-date identity match available (kurzy exposes none) — weaker identity standard than the reconcile-ares-vr.ts discipline used on the other 259 ties"
  ],
  "also_ruled_out": "PRaK s.r.o. v likvidaci (IČO 49686852) — different dissolved s.r.o., no Bendl/Brabec link found"
}
```

## 3. Army — none this batch

Population fully reconciled (260/260, batch 002). No unit processing this
batch; ledger.json `units` unchanged.

## 4. Opus reflection — verdict (verbatim excerpts; full text in handoff.md §6)

> The human gate holds in the forward direction, but it is not yet durable:
> it is not the only mutator of `review_state`, and the console's own success
> reporting is not honest under failure. Ship-able as a reviewed batch
> artifact, NOT ship-able to a public deployment as-is.

Two severity-HIGH/MEDIUM defects found (full list, 8 total, in handoff.md §4):
**D1 (HIGH)** — `lib/analysis/kg-money.ts`'s ingest re-stamps
`review_state:"pending_review"` on every `linked_to` edge and
`kg.ts:upsertKgEdges` replaces `props` wholesale (not merge), so **the next
`kg-money-ingest --commit` silently destroys every human `verified` decision**
and drops `last_decision`/`last_reviewer`/`review_note`. The audit trail
survives (append-only), but nothing replays it. **This must close before a
human is asked to spend real review time.** **D3 (MEDIUM)** — the console's
own "zapsáno: N" counter is optimistic-only and never rolls back on
`not-configured`/`unauthorized`/`error`, so it can report writes that did not
happen — flagged as the single worst-fit defect for a project whose thesis is
"trust is the product."

Full defect list (D1–D8), all Opus's original numbering, is preserved verbatim
in `handoff.md` §4 for the next batch to consume directly.

## Metrics block — batch 003

| metric | batch 003 |
|---|---|
| units processed | 0 (no army — population already 100% reconciled) |
| build shipped | write-path (`ReviewRepository` + server action + console wiring) — **not yet durable, D1 open** |
| tests | 5/5 new (review repo), 176/176 full suite, tsc clean |
| Q-money-7 | re-resolution candidate found (medium confidence), annotation only, not applied |
| Opus defects found | 8 (1 HIGH, 5 MEDIUM, 2 LOW/MEDIUM) |
| build-review cadence | R=1 → shipped a build, but Opus assessed it incomplete/unsafe for real use → **R does NOT reset to "converged", batch 004 must close D1 first before this counts as a settled ship** |

## Steering → batch 004 (Opus recommendation, adopted)

**Do not run Q-money-2 (pgvector) next.** Run a short durability+honesty fix
batch first:
1. D1 — merge-preserving ingest or a `review_audit` replay step after
   `kg-money-ingest --commit`, so human decisions survive re-materialization.
2. D3 + D4 — optimistic-rollback on the console counter,
   `revalidatePath("/penize/kontrola")` after a successful write.
3. D5 — runtime decision whitelist in the server action + a `CHECK` constraint
   on `review_audit.decision`.
4. D7 — decide whether `reject` needs a terminal `"rejected"` state so
   rejected ties stop being re-served in the pending queue.
5. Q-money-7 closure — resolve the Bendl end-date conflict against a
   browser-rendered or.justice.cz úplný výpis; land as annotation +
   `tieClass: steward` reclassification if/when re-pointed.
6. **Then** Q-money-2 in batch 005 — Opus's note: it's been deferred three
   batches running (001 §3, 002 §4, 003 here); either commit to it next or
   retire it from the backlog rather than rolling it a fourth time.

Q-money-3 (sponzoring pass) stays blocked on `HLIDAC_API_TOKEN` (user gate).
