---
name: money-loop
description: Run the FollowTheMoney analyst-builder loop over the materialized money graph — triage-rank the 260 human-gated MP↔company ties, 196 companies and 2,287 contracts, dispatch a subagent army unit-by-unit (corroborate ties via registries, detect contract anomalies, complete accountability triangles), gate every proposal, and ship /penize product increments (verification console first). Use when the user says "run the money loop", "process the ties/contracts", "corroborate money ties", or wants Case ① to advance.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch
---

# Money loop — Case ① FollowTheMoney analyst-builder

Extends the shared kernel — **read `docs/case-loops.md` first**, then
`[[cluster-committees-and-money]]` and the money rows of `[[graph-schema]]`.
Vault home: `docs/data-analysis/case-money/`.

## Population & unit

Three nested unit types, processed tie-first (a tie is the accountability
atom): **260 `linked_to` ties** (person→company, ALL `pending_review`) →
**196 `company` nodes** (props: ico, subsidies, party donations) → **2,287
`contract` nodes** (amount, signedOn, supplierIco; 2,290 `supplies` edges).
Code substrate: `lib/analysis/kg-money.ts` (join + human gate),
`lib/analysis/money-feed.ts` (Hlídač/ARES clients, strict IČO resolver,
birthdate person-bridge). The graph was built pass 10; ~18.7 bn CZK reachable
across 73 MPs.

## Triage signals (deterministic, PGlite SQL on a copy — R4)

*(re-weighted after batch 001 — see P28/P29, C4)*

- **Tie-class FIRST** (`tie_class`: owner-operator | manager | steward, keyed
  on role × legal-form/public-marker). 200/260 ties are public-body board
  seats where money is the body's own activity and does NOT flow to the MP —
  raw CZK ranking buries the 37 genuine owner-operator ties. **Steward
  reachable-CZK must never be attributed to the MP** (VaK Kroměříž ~602M is
  not Karpíšek's money).
- **Period reconciliation vs ARES VR** — the primary temporal signal. Hlídač
  periods are year-rounded and default "ongoing"; ARES VR `role_valid_to`
  catches stale/ended ties and money-postdates-role (11/15 of batch 001's
  head). The naive "contracts signed while in role" check barely
  discriminates — demoted. **DONE population-wide (batch 002, pass 16):
  260/260** — refresh via `scripts/case-loops/money/reconcile-ares-vr.ts`
  on re-ingest, don't re-derive. Reading rules that batch paid for: the VR
  JSON's `statutarniOrgany` + `ostatniOrgany` + `spolecnici` are ALL
  load-bearing (P35); pre-2000s records often lack birth dates — use a
  name-similarity fallback GATED to null-birthdate entries only (P36);
  undated money is `historical-undated-money`, never "postdates" (P37).
  **Corroboration semantics (the stated definition since batch 002):**
  `registry-confirmed` = the MP positively identified among registry roles;
  `conflicting` = registry exists but this MP could NOT be identified;
  `registry-unconfirmed` = the check could not be attempted (special-law
  bodies with no OR record — 58, structural).
- **Money volume per owner-operator tie** — contract + subsidy CZK, WITHIN
  the owner-operator class.
- **Near-threshold clustering** — amounts just under procurement limits
  (2M/6M CZK zadávací limity), repeated same-supplier awards.
- **Subject-similarity splits** — pgvector over contract subjects (R6):
  candidate contract splitting (queued: Q-money-2).
- **Triangle completion** — contracts AND subsidies AND party donations from
  one IČO.
- **Cross-case** — `absentee_manager_lead` persons rank up ONLY after the
  effort loop's `never_cast_ballot` pre-filter (C5: 4/4 raw flags were
  phantom-mandate false positives).

## Stages per unit (tie)

1. **clean** — validate the tie's evidence chain (source string parses, IČO
   resolves, person bridge sound); flag defects.
2. **enrich** — corroboration dossier: ARES VR / justice.cz officer records
   (is the MP really jednatel/akcionář of this IČO, when? — **ARES VR is the
   corroboration hinge and needs no token**), Hlídač detail, contract
   counterparty (who paid — state org? municipality?). `HLIDAC_API_TOKEN` is
   OPTIONAL and currently absent from `.env` — without it, take
   contract/subsidy figures from the already-materialized graph and
   corroborate via token-free ARES; donation re-verification (Q-money-3)
   stays blocked on the token. Web/news only as narrative context. Every
   claim: `{claim, url, accessedAt}`.
3. **wire** — proposals only: confidence annotations on the tie
   (`corroboration: registry-confirmed | registry-unconfirmed | conflicting`),
   enriched company/contract props, missing `supplies` edges found via direct
   Registr smluv queries. **NEVER a new person↔company edge without registry
   evidence, NEVER touch `review_state`** — the human gate is absolute here;
   these are accusatory edges about real people.
4. **signal** — story-worthiness 0–5 + one line (e.g. "4.2M CZK road contract
   signed 3 months into the statutory role, payer = home region").

## Case gates

Kernel gates plus: (a) an unresolved IČO drops the link — never guessed
(`pickExactIco` discipline); (b) corroboration annotates, never verifies;
(c) contract amounts come from the registry feed, never from prose; (d) a
tie rendered anywhere states its review state honestly.

## Seed build backlog (build-review consumes these)

1. **Verification console** — the human-review UI for the 260 pending ties
   (evidence dossier per tie, approve/reject/needs-more, audit trail). THE
   bottleneck: the whole Integrity pillar sits at 0/260 verified. First
   build-ready increment.
2. Tie detail drill-down on `/penize` (dossier + contract list + triangle).
3. Anomaly feed (near-threshold clusters, split candidates) — signals, not
   accusations, each labelled "signál k prověření".
4. Registr smluv direct ingest adapter (autonomous — open bulk XML dumps;
   the Pumper `smlouvy-dump-watch` app already watches releases).

## Batch-004 priorities (set at batch-003 integration)

1. **D1 — ingest durability (Q-money-10, TOP):** kg-money's ingest must
   merge-preserve human-gated fields (`review_state`, `last_decision`,
   `review_note`) or replay `review_audit` after every run. The committed
   write path stays DISABLED (no `REVIEWER_TOKEN`) until this closes.
2. **OSVČ purge (Q-money-11, TOP):** generic-token blacklist ("OSVČ",
   "advokát", …) before the exact-name ARES pick + purge the **49** edges
   annotated `false_edge_suspected` (pass 21) — 19% of the tie population is
   this one false-edge class; effective real population ~211.
3. Write-path polish (Q-money-12): honest counter (D3), revalidate (D4),
   decision whitelist + CHECK (D5), terminal `rejected` state (D7).
4. PRaK (Q-money-7): Bendl end-date vs or.justice.cz úplný výpis; any
   re-point reclassifies the tie `steward` in the same change.
5. Q-money-2 (pgvector splitting): **commit or retire** — deferred three
   batches (kernel heuristic).

## History

Batch 001 (pass 13): top-15 corroboration + tie-class + `/penize/kontrola`
console. Batch 002 (pass 16): full-population ARES-VR reconciliation
(260/260) + temporal badge. Batch 003: write path built (NOT enabled, D1) +
PRaK candidate (medium). Ledger: `docs/data-analysis/case-money/`.
