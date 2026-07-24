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

- **Money volume per tie** — contract CZK + subsidy CZK reachable through the
  company (the head of the queue).
- **Temporal alignment** — contracts signed *while* the MP held the role (tie
  period from the `linked_to` source string vs `signedOn`). The strongest
  signal in the population.
- **Near-threshold clustering** — amounts just under procurement limits
  (2M/6M CZK zadávací limity) and repeated same-supplier awards.
- **Subject-similarity splits** — pgvector over contract subjects (R6, embed
  once): same supplier, similar subject, amounts under limits → candidate
  contract splitting.
- **Triangle completion** — company holds contracts AND subsidies AND donated
  to a party (`donated_to_party_czk` props): the full accountability triangle.
- **Cross-case** — `absentee_manager_lead` persons (Case ② crossover) rank up.

## Stages per unit (tie)

1. **clean** — validate the tie's evidence chain (source string parses, IČO
   resolves, person bridge sound); flag defects.
2. **enrich** — corroboration dossier: ARES VR / justice.cz officer records
   (is the MP really jednatel/akcionář of this IČO, when?), Hlídač detail,
   contract counterparty (who paid — state org? municipality?). Web/news only
   as narrative context. Every claim: `{claim, url, accessedAt}`.
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

## First batch (calibration)

Top ~15 ties by triage; full four stages; deliberately modest. Establish:
signal-yield baseline, cost/unit, dossier schema, ledger format. Then reflect
and steer.
