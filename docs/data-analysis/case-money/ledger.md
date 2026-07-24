# Money loop — unit ledger (Case ① FollowTheMoney)

Resumable state for the FollowTheMoney analyst-builder loop. Machine state:
[`ledger.json`](./ledger.json) (260 tie units → {stage, batch, signal, corroboration,
flags}). Human batch log + metrics below. Skill: `.claude/skills/money-loop.md`; kernel:
`docs/case-loops.md`. Vault home: `docs/data-analysis/case-money/`.

Unit = one `linked_to` tie (person→company), the accountability atom. Population: **260
ties** (all `pending_review`), 196 companies, 2 287 contracts, **19.76 bn CZK** reachable.

## Batch log

### Batch 001 — calibration (2026-07-24)

- **Triage:** all 260 ties scored deterministically (`triage.ts`, PGlite copy). Added the
  **tie-class** dimension (owner-operator 37 · manager 23 · steward 200) so the queue ranks
  by *genuine* FollowTheMoney value, not raw money volume (which is dominated by public-body
  stewardship seats). Skipped pgvector this batch (calibration) — **next-batch work**.
- **Army:** top **15 ties**, four stages each (clean → enrich → wire → signal). 15 parallel
  subagents (Opus ×3 for the head, Sonnet ×12). Enrichment hit ARES subject + ARES VR,
  Registr smluv (via Hlídač web), psp.cz, with every claim cited. **No Hlídač API token in
  this env** (`.env.example` documents only Sentry) — enrichment degraded to token-free ARES
  + web registries; it still resolved all 15.
- **Gate:** `validate-payloads.ts` → **15/15** corroboration proposals validate against the
  graph copy. 0 drops, 0 fabricated ids.
- **Persist (fleet):** batch note `batch-001.md`; graph payloads
  `payloads/batch-001-corroboration.json` (NOT written to live DB — orchestrator serializes);
  ledger.json updated (15 units → stage `signal`, batch 1).

## Metrics block

| metric | batch 001 |
|---|---|
| units done / total | **15 / 260** (5.8%) |
| owner-operator ties in head | 37 identified; top 15 processed |
| **signal yield** (signals ÷ units) | 15/15 produced a scored dossier; **4 live conflicts (signal ≥4)**, ratio 0.27 |
| registry-confirmed | 11/15 · conflicting 3/15 · (all IČOs exist) |
| **stale/misattributed period caught** | **11/15** (the dominant finding) |
| gate pass rate | 15/15 (100%) |
| est. cost / unit | ~30 k subagent tokens/tie, 3–7 web calls, ~90 s wall (parallel) |
| reuse-rate | triage + signal helpers shared between `triage.ts` and the live console (`reviewTypes.ts`) |

**Convergence read:** batch is calibration, not convergence. Signal yield is high because the
head of the queue is the richest 15. The *structural* finding (stale periods) is itself the
highest-value output — it means the whole 260-tie population needs an ARES-VR period
reconciliation pass before any tie is presented as "active".

## Steering (next batch)

1. **Ties 16–30** by signal (owner-operators #16+; then the manager class). Batch size 15 held
   up well under the 20-concurrent subagent cap — keep 15, but launch in one wave (2 of this
   batch's 15 hit the cap and were relaunched).
2. **Temporal reconciliation as a first-class signal.** Re-run triage with an ARES-VR
   `role_valid_to` fetch so "ongoing-but-actually-ended" and "money-postdates-role" become
   deterministic flags, not per-tie discoveries. This is the single biggest calibration lever.
3. **pgvector subject-similarity** (R6) for contract-splitting candidates — deferred this batch.
4. **Sponzoring pass** — resolve the three surfaced company→party donation leads against the
   Hlídač donor registry (needs the API token → user gate) and propose donation edges.
5. **Indirect-ownership modelling** — the Babiš/CS CABOT scope gap shows the graph needs an
   `owns`/`controls` company→company layer (Agrofert→DEZA→CS CABOT) to catch indirect ties.

## Build-review

- **R=1 → shipped:** the **verification console** (`/penize/kontrola`) — the seed backlog's
  #1 build-ready increment. See `handoff.md`. R resets to 1 (something shipped).

### Batch 002 — full-population ARES-VR reconciliation + O-money-2 (2026-07-24)

- **Model tiering experiment:** driver + army = **Sonnet only**; Opus reserved for one
  reflection call. See `batch-002.md` for full detail.
- **Q-money-1 done:** all 245 remaining ties (batch 001 covered the top 15) reconciled
  against ARES VR by a deterministic script (`scripts/case-loops/money/reconcile-ares-vr.ts`)
  — birth-date-exact officer/shareholder matching, no LLM. Caught and fixed a real bug
  mid-run (missing `ostatniOrgany`/supervisory-board section: `conflicting` 91→23,
  `registry-confirmed` 96→164) and one flagged by the Opus reflection
  (`money-postdates-role` was conflating undated contracts with genuinely-later ones — fixed,
  0 cases affected in this run's data but the design gap is closed).
- **Sonnet judgment (10 ambiguous units):** 2 agents, 5 units each, real WebFetch+WebSearch,
  batch-001 dossier depth. 3 false negatives corrected (missing-birth-date VR records),
  2 confirmed negatives, 4 money-postdates-role verdicts confirmed as clean handoffs (not
  revolving-door — one independent non-disclosure lead surfaced, Okamura/U Machtů), 1
  wrong-entity catch (Bendl+Brabec → PRAK, likely wrong IČO).
- **Gate:** `validate-payloads.ts` (extended for multi-file + cross-file duplicate guard) →
  **260/260** population validates, 0 fabricated, 0 duplicates.
- **Build (R=1 → shipped, resets to 1):** O-money-2 temporal-status badge on `/penize`
  ledger + `/penize/kontrola` console — a tie never renders as active without registry
  confirmation. `npm run check` green for the money boundary (repo-wide typecheck clean,
  money-scoped lint clean, 166/166 tests; the one failing lint is the sibling law loop's
  file).
- **Opus reflection verdict:** quality **holds** against batch 001's bar on the
  reconciliation objective (honest-negative rate 33%, no fabrication, gate clean),
  **exceeds** it on rigor for the reviewed 10%; the deterministic bulk necessarily carries
  less narrative discovery-depth than batch 001's per-tie dossiers (expected — different
  pass, not a regression). Cost/unit ≈75× cheaper amortized. Full verdict in `handoff.md`.

## Metrics block — batch 002

| metric | batch 002 |
|---|---|
| units done / total (cumulative) | **260 / 260** (100% — population reconciliation complete) |
| corroboration | registry-confirmed 179 · conflicting 23 · registry-unconfirmed 58 |
| temporal_status (registry-confirmed) | current 43 · historical ~76 · money-postdates-role 39 · historical-no-money/undated ~22 |
| **signal yield** | 10/10 ambiguous units produced a judged verdict; 3 corrected, 1 wrong-entity catch, 1 new frontier lead (Okamura non-disclosure) |
| gate pass rate | 260/260 (100%) |
| est. cost / unit | ~420 tokens/unit amortized (vs batch 001's ~30k/tie) — deterministic bulk + Sonnet judgment only where ambiguous |
| reuse-rate | `AresClient.vrRecord()` (new, in `lib/analysis/money-feed.ts`) is now reusable by any future money-loop batch; `temporalBadge()` (`moneyTypes.ts`) is the shared badge logic for both ledger and console |

## Steering (next batch)

1. **Frontier leads from this batch:** Q-money-5 (Juchelka advisor subsidy-influence,
   2026 — surfaced incidentally, unrelated to this tie), Q-money-6 (Okamura 2016 asset
   non-disclosure — independently sourced, worth its own verification pass).
2. **Re-resolve PRAK IČO** for Bendl/Brabec — the correct entity is likely a dissolved
   "PRaK, a.s." under a different IČO than 49683144.
3. **58 registry-unconfirmed ties** are structurally out of ARES-VR's reach (special-law
   public bodies) — a different corroboration source (zákon establishing the body, or the
   body's own statute) would be needed if this population is ever prioritized; low urgency
   since these are steward-class by construction.
4. **pgvector subject-similarity** (Q-money-2) and the **donor-registry sponzoring pass**
   (Q-money-3, still blocked on `HLIDAC_API_TOKEN`) remain deferred.
5. **Write path** for the verification console (§5 of `handoff.md`, batch 001) is still the
   top build-ready item after O-money-2 — now more valuable since 260/260 ties carry a
   registry corroboration verdict for reviewers to act on.
