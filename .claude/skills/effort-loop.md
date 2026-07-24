---
name: effort-loop
description: Run the Effort/contribution analyst-builder loop over the 207 PSP10 MPs — triage-rank by contribution outliers vs club baselines, dispatch a subagent army MP-by-MP (deep work dossiers, bill fates, speech/interpellation substance, cross-case absentee and quiet-workhorse signals), and ship /zebricek + /poslanec increments (PSP9 trend restoration first). Use when the user says "run the effort loop", "process the MPs", "deepen contribution profiles", or wants Case ② to advance.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch
---

# Effort loop — Case ② contribution analyst-builder

Extends the shared kernel — **read `docs/case-loops.md` first**, then
`lib/analysis/contribution.ts` (the transparent 100-point index: 6 weighted
components, named saturation caps) and the person rows of `[[graph-schema]]`.
Vault home: `docs/data-analysis/case-effort/`.

## Population & unit

**207 `person` nodes** (all PSP10 mandate-holders), each already carrying the
pass-11 contribution props: `contribution_score`, `participation_rate`,
`committee_count`, `leadership_count`, `absence_rate`, `bills_authored`,
`interpellations`, `speech_turns`, `absentee_manager_lead`. Full population is
feasible — ranking decides *depth*, not *whether*.

## Triage signals (deterministic)

- **Component outliers vs club baseline** — an MP whose participation is 2σ
  below their club's mean is a different story than one matching a low-energy
  club norm. PGlite SQL over 207 nodes + club map; DuckDB (R3) only if
  recomputing from the 406k-ballot table.
- **Extremes first** — top 10 + bottom 10 composite, all `absentee_manager_lead`
  leads (money crossover), and **quiet workhorses** (high committee/legislative
  components, low speech/visibility) — the positive-symmetry signal.
- **Component divergence** — high score built one-sidedly (all speech, no
  committee work) vs balanced.
- **Contested-vote overlap** — `contested_vote_rebellion` (analytical-loop
  prop) × contribution: who does the hard work AND breaks on close votes.

## Stages per unit (MP)

1. **clean** — cross-check props against raw tables (mandate present, ballots
   nonzero, committee memberships resolve); flag placeholder dates.
2. **enrich** — the work dossier: what did their bills DO and what happened to
   them (tisky fate via `bill` nodes + `sponsors` edges + psp.cz historie);
   interpellation subjects; committee roles vs `assigned_to` bill flow through
   their committees (pass 12); public roles (web, registries — public-role
   facts only).
3. **wire** — proposals: per-MP enrichment props (bill success rate,
   interpellation themes, committee-load), possible `interpellates` edges if
   the data sustains them (new rel → enum change via handoff/finalize).
4. **signal** — story-worthiness + the honest headline the profile page could
   carry (derived from real props, positive or negative).

## Case gates

Kernel gates plus: (a) the score and every component come ONLY from
`computeContribution` — an analyst may call a score hollow but never adjust
it; (b) no fabricated time series — trends require actually-ingested history;
(c) club ≠ elected party list (the classic error); (d) voided votes and the
merged K bucket never count against anyone.

## Seed build backlog

1. **PSP9 term ingest → real trend restoration.** The adapter is
   term-parameterized (`--term=`); ingest PSP9 votes/ballots/absences,
   compute the prior-term contribution, and restore the delta/trend UI that
   was honestly deleted — with real history this time. Highest-value build,
   fully autonomous (open psp.cz bulk).
2. Steno speech ingest (psp.cz steno dumps) → speech substance beyond turn
   counts; index with tsvector+GIN from the start (R9–R11).
3. Quiet-workhorse + absentee story surfaces on `/zebricek` (labelled,
   sourced, symmetric).
4. Profile deepening: bill-fate section, committee-flow section on
   `/poslanec/<pspId>`.

## First batch (calibration)

~20 MPs: top 5 + bottom 5 composite, 5 absentee leads, 5 quiet workhorses.
Full stages; establish dossier schema, signal-yield baseline, cost/unit.
Then reflect and steer.
