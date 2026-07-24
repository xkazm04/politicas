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
   **Code-first phantom-mandate check** (batch 001, C5): `participation_rate
   == 0 && committee_count == 0` ⇒ candidate `never_cast_ballot` (elected,
   never sworn / relinquished for executive office) — classify BEFORE the
   absentee-manager crossover so Opus never dossiers a structural false
   positive. (Now implemented in `scripts/case-loops/effort/triage.ts`.)
   Young-term caveat (P30): the score floor is dominated by role
   artifacts, not disengagement; comparisons must be component-level.
   **Second floor-artifact class (batch 002, P38): replacement MPs** —
   mid-term seatings genuinely serve but score low on tenure alone
   (contribution.ts has no tenure normalization, Q-effort-5); annotate,
   don't alarm. `componentDivergence` is near-degenerate as defined
   (Q-effort-6) — re-tune before trusting it.
   **Money-crossover units route through an Opus verification step** even
   in a Sonnet army (batch 002: both quality gaps were money-touching
   claims — kernel tiering rule (b)).
2. **enrich** — the work dossier: what did their bills DO and what happened to
   them (tisky fate via `bill` nodes + `sponsors` edges + psp.cz historie);
   interpellation subjects; committee roles vs `assigned_to` bill flow through
   their committees (pass 12); public roles (web, registries — public-role
   facts only).
3. **wire** — proposals: per-MP enrichment props (bill success rate,
   interpellation themes, committee-load), possible `interpellates` edges if
   the data sustains them (new rel → enum change via handoff/finalize).
   For MP↔company tie semantics use the money loop's LIVE `tie_class`
   vocabulary (owner-operator | manager | steward, pass 13) — do not mint a
   parallel `link_kind`/`officer_by_office` scheme on the same edges; the
   `linked_to` edges are the money loop's boundary.
4. **signal** — story-worthiness + the honest headline the profile page could
   carry (derived from real props, positive or negative).

## Case gates

Kernel gates plus: (a) the score and every component come ONLY from
`computeContribution` — an analyst may call a score hollow but never adjust
it; (b) no fabricated time series — trends require actually-ingested history;
(c) club ≠ elected party list (the classic error); (d) voided votes and the
merged K bucket never count against anyone; (e) `bills_authored` conflates
first-signatory with co-signer (Q-effort-2) — profiles may say
"spolupodepsal" vs "předložil" only from the předkladatel rank, and the
number stays untouched.

**Army mechanics (proven batch 001):** pre-extract all unit context into
`dossier-inputs.json`; grouped Sonnet agents hold quality at 3–5 MPs each;
quiet-workhorse slots (both flavours, P31) are FIXED allocation every batch.

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
