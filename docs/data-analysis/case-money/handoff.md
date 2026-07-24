# Money loop — fleet handoff (batch 001)

Case ① FollowTheMoney · 2026-07-24 · fleet mode. Everything the orchestrator needs to
serialize this batch's writes and aggregate cross-case. All work is inside the money
boundary; nothing shared was edited. **No commit, no live `.pglite` write, no
`review_state` change made.**

## 1. Graph-write payloads (validated — orchestrator writes under the `.pglite` lock)

- **File:** `docs/data-analysis/case-money/payloads/batch-001-corroboration.json`
- **What:** 15 props-merge annotations onto **existing** `linked_to` edges (corroboration
  verdict + ARES-VR `role_valid_from`/`role_valid_to` + `temporal_status` + `tie_class` +
  reviewer note). **No new edges, no node creation, no `review_state` change.**
- **Provenance to stamp at write:** `{track:"money", pass:<assigned by orchestrator>,
  method:"verdict", ref:"case-money/batch-001 · ARES VR + Registr smluv", computedAt:"2026-07-24"}`
  (the `track` field per kernel §Provenance; pass number assigned in write order by the lock
  holder).
- **Re-verify before writing:**
  ```
  cp -r .pglite .pglite-copy-money        # if the copy was cleaned up
  PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/validate-payloads.ts
  # expect: GATE: 15/15 corroboration proposals validate against the graph copy.
  ```
- **Gate result this batch:** 15/15 validated, 0 drops, 0 fabricated ids.

> Recommendation: these annotations are safe to persist (they only enrich provenance and add
> a reviewer-facing corroboration field). If the orchestrator prefers to hold graph writes
> until an `owns`-layer decision (see §4), the batch note + console already carry the value.

## 2. Shared-vault additions (exact text to append — I did not edit these files)

### → `docs/data-analysis/patterns.md`

```
## [[patterns]] Money · stale "ongoing" is the norm, not the exception (money batch 001)
The `linked_to` period is derived from Hlídač `datumDo` (absent ⇒ "ongoing"); ARES VR shows
the real end date. In the top 15 owner/steward ties, 11/15 were stale or misattributed:
8 roles had actually ENDED (Okamura 2021-06-02, Juchelka 2026-01-16, Decroix 2021-06-18,
Ženíšek 2013-10-26, Černochová 2021-12-20, Vondráček 2018-09-05, Fiala 2018/2014); 2 had the
money post-date the role (Žbánek, Záhoř); 1 missed an indirect chain (Babiš). Implication: no
tie should render as "active" until its period is reconciled against ARES VR. Also: Hlídač
start dates are year-rounded (Jan 1) and ~months off the ARES vznik date.

## [[patterns]] Money · owner-operator vs steward is the load-bearing tie distinction
Raw reachable-money ranks public-body supervisory seats (hospitals/utilities/universities)
at the top, where money is the body's own public activity and does NOT flow to the MP.
A deterministic tie-class (owner-operator | manager | steward), keyed on role string ×
company legal-form/public-marker, separates the real FollowTheMoney (37 owner-operator ties)
from 200 stewardship seats. Steward subsidy totals (e.g. VaK Kroměříž ~602M) must never be
attributed to the MP.
```

### → `docs/data-analysis/contradictions.md`

```
## [[contradictions]] Money batch 001 — graph vs ARES VR (period)
Graph edges assert "ongoing"; ARES VR contradicts for: Okamura/MIKI TRAVEL (ended 2021-06-02),
Ženíšek/Pojišťovna VZP (board seat only 3 months in 2013, ended 2013-10-26), Černochová/Komwag
(ended 2021-12-20, + an omitted earlier 2005–2011 term). Graph asserts "no party donation" for
STYLE PD, OCCAM PR, Delices de papa — Hlídač shows donations (215k ODS / 240k TOP 09 / 40k ODS)
requiring a donor-registry pass to confirm. Resolution: annotate (done in payloads), do not
flip review_state; feed the temporal reconciliation into next triage.
```

### → `docs/data-analysis/feature-opportunities.md`

```
## [[feature-opportunities]] O-money-1 — Verification console (/penize/kontrola) — SHIPPED (batch 001)
The human-review UI for the 260 pending ties: evidence dossier per tie (reachable money, role,
parsed period, tie-class + triangle/near-threshold/stale flags), primary-registry deep-links
(ARES subject/VR, Registr smluv, Hlídač, or.justice.cz), and confirm/reject/needs-more actions
STUBBED behind a labelled "zápis čeká na backend" state. Reads real graph data via
getVerificationQueue(). BLOCKER for the whole Integrity pillar (0/260 verified). Next: the
write path (§3).

## [[feature-opportunities]] O-money-2 — Temporal-status badge on /penize ledger
Surface role_valid_to / temporal_status ("trvá" vs "ukončeno YYYY" vs "peníze po roli") on the
main ledger so a stale tie is never shown as active. Cheap once the corroboration props land.

## [[feature-opportunities]] O-money-3 — Indirect-ownership (owns/controls) company layer
Babiš/CS CABOT: the live tie is Agrofert→DEZA→48%-of-CS-CABOT, which the MP↔company edge cannot
express. A company→company owns/controls layer would catch indirect conflicts the direct join
misses.
```

### → `docs/data-analysis/frontier.md` (money section)

```
## [[frontier]] Money
- Q-money-1: reconcile all 260 tie periods against ARES VR role_valid_to — how many of the full
  population are stale/ended? (batch 001: 11/15 of the head). Deterministic once the VR fetch is
  wired into triage.
- Q-money-2: contract-splitting — pgvector over contract subjects (R6) for same-supplier,
  similar-subject, sub-limit clusters. Deferred from batch 001.
- Q-money-3: the three surfaced company→party donation leads (STYLE PD/OCCAM/Delices) — confirm
  against the Hlídač sponzoring registry (needs API token → user gate) and propose donation edges.
- Q-money-4: revolving-door — Žbánek's 2019 Olomouc-city contract to a former company while
  mayor; a distinct pattern (public-office-era ties) the MP-mandate graph doesn't track.
```

### → `docs/data-analysis/graph-log.md`

```
2026-07-24 · money batch 001 (calibration) · NOT YET WRITTEN (fleet handoff). 15 linked_to
corroboration annotations proposed (payloads/batch-001-corroboration.json), gate 15/15. No
review_state change. Provenance track:"money", pass TBD by lock holder.
```

## 3. Proposed enum / schema changes

- **`linked_to` edge props (additive, no migration — props is jsonb):** `corroboration`
  ∈ {`registry-confirmed`|`registry-unconfirmed`|`conflicting`}; `role_valid_from`,
  `role_valid_to` (ISO date, null=open); `temporal_status` ∈ {`current`|`historical`|
  `money-postdates-role`|`historical-direct-indirect-current`}; `tie_class` ∈
  {`owner-operator`|`manager`|`steward`}; `owner_stake_pct` (number, optional). These are the
  fields the payloads set. If `kg-verdict.ts` enum-gates edge props, add the above value sets
  there (SHARED file — orchestrator's edit, not mine).
- **No new node/edge KIND** proposed this batch. An `owns`/`controls` company→company relation
  is a candidate for a later batch (O-money-3), not now.

## 4. Commit plan (orchestrator — per-case commit)

Files, all inside the money boundary:

```
NEW  features/money/reviewTypes.ts                         # pure review types + helpers (client-safe)
NEW  features/money/getVerificationData.ts                 # server-only review-queue loader
NEW  features/money/components/VerificationConsole.tsx     # the console UI
NEW  app/penize/kontrola/page.tsx                          # route
EDIT features/money/FollowTheMoneyPage.tsx                 # header link → /penize/kontrola
NEW  scripts/case-loops/money/triage.ts                    # deterministic triage + tie-class
NEW  scripts/case-loops/money/validate-payloads.ts         # the gate
NEW  docs/data-analysis/case-money/{ledger.md,ledger.json,batch-001.md,handoff.md,triage-dump.json}
NEW  docs/data-analysis/case-money/payloads/batch-001-corroboration.json
```

Suggested message:
```
feat(case-money): verification console (/penize/kontrola) + batch-001 triage & corroboration

Triage-ranks the 260 pending MP↔company ties with a deterministic tie-class (owner-operator
vs steward); enriches the top 15 against ARES VR (gate 15/15, 0 fabricated ids). Ships the
human-review console: per-tie dossier + registry deep-links + confirm/reject/needs-more
(write path stubbed, fleet mode). No review_state changed.
```

**Check status:** typecheck green (repo-wide), lint green **for all money-boundary files**,
tests 157/157 green. `npm run check` currently fails ONLY on 4 pre-existing lint errors in the
concurrent sibling loops (`scripts/case-loops/effort/extract-dossiers.ts`,
`scripts/case-loops/law/triage.ts`) — outside the money boundary, not mine to fix. Verify with:
`npx eslint features/money app/penize scripts/case-loops/money` (clean).

## 5. Write-path handoff (the console's stubbed action)

The console records confirm/reject/needs-more in browser-local state only, labelled "zápis
čeká na backend". To wire it: a server action `POST /penize/kontrola` that, on a **human**
decision, sets `review_state:"verified"` (confirm) on the `linked_to` edge or writes a
`review_note` (reject/needs-more) — the ONLY place a tie may be verified, and always by a
human. Needs an authenticated reviewer identity + an audit-trail row. Explicitly out of scope
for fleet mode (single-writer `.pglite`), left as the top build-ready item after O-money-2.

## 6. Lessons learned (calibrates the skill/kernel — be specific)

1. **The skill assumes a Hlídač API token in `.env`; this repo has none** (`.env.example`
   documents only Sentry; the var is `HLIDAC_API_TOKEN`). Enrichment still worked via
   token-free ARES REST + web, but subsidy/donation/contract *re-verification* against Hlídač
   was impossible — army confirmed the officer/ownership hinge (ARES VR) and took the graph's
   contract/subsidy figures as given. **Skill fix:** state the token is optional and name the
   token-free fallback (ARES subject + ARES VR are the corroboration hinge; the money figures
   come from the already-materialized graph).
2. **Triage's strongest listed signal — "temporal alignment" — is nearly useless as written.**
   Hlídač periods are year-rounded and mostly open-ended ("ongoing"), so "contracts signed
   while in role" evaluates true for almost everything and doesn't discriminate. The REAL
   temporal signal is the opposite: **ARES-VR `role_valid_to` reconciliation** to catch ties
   that are stale/ended or where money post-dates the role (11/15 here). **Skill fix:** demote
   "temporal alignment (contract signedOn vs role window)" and promote "period reconciliation
   against ARES VR" as the primary temporal signal.
3. **The skill's population framing omits the owner-operator vs steward distinction** — yet it
   is the single most important ranking lever. 200 of 260 ties are stewardship board seats on
   public bodies (money doesn't flow to the MP); 37 are the genuine owner-operator archetype.
   Ranking by raw reachable money (the skill's "head of the queue") buries the real signal.
   **Skill fix:** add tie-class as a first-class triage dimension (role × legal-form/public-marker).
4. **"Reachable CZK" over-attributes.** For a steward seat, the company's contract/subsidy
   totals are its own public activity; the console and any score must NOT read them as MP money.
   The graph has no flag distinguishing the two — hence the tie-class heuristic. **Kernel/skill
   note:** non-partisan symmetry cuts both ways — a big number next to an MP is often *nothing*.
5. **Concurrency cap bites at 15+ parallel subagents** (limit 20; 2 of 15 launches were
   rejected and relaunched). **Kernel note:** with three fleet loops sharing the cap, a 15-unit
   army should launch in a single wave and budget for ≤ ~6 concurrent per case, or stage in
   two waves.
6. **ARES VR is a genuinely strong, free primary gate** — it cleanly caught every stale period
   and confirmed every real ownership stake, with exact dates. The web-research doctrine
   (lead→cited→gate) held perfectly; media (iROZHLAS/Seznam) added context (Petrtýl, Fiala)
   but never became a graph fact. This validates the kernel's registry-outranks-media rule.
7. **Scope gap the direct join can't see:** indirect ownership (Babiš→Agrofert→DEZA→CS CABOT).
   The MP↔company edge model structurally misses these; noted as O-money-3.

## 7. Cleanup

`.pglite-copy-money` was removed at end of run (`rm -rf`). Re-create from `.pglite` to
re-validate payloads (command in §1).
