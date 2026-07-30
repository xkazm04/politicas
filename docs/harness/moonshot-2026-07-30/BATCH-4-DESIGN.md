# Batch 4 — Money (design doc)

> 5 features in TWO waves (surface collisions in features/money and features/budget force it):
> **Wave 4.1 (parallel)**: 4A Every Town's Mirror · 4B Kolizní radar · 4C Vote-Collision Engine
> **Wave 4.2 (parallel, after 4.1)**: 4D Municipal Money Trail · 4E Evidence Packet Compiler
> Package narrative: **financial transparency at full depth.** Every municipality gets a mirror,
> town budgets join the contract graph, "voted on their own company's money" becomes a computed
> (and human-gated) fact, case files compile themselves into sourced packets, and the drafting
> process gets an early-warning radar.

## Shared design contract

**The full chain binds you: BATCH-1-DESIGN.md § Shared design contract (9 points) + BATCH-2
additions 10–12 + BATCH-3 additions 13–15.** Read them all first.

Batch-4 additions:

16. **The tree has moved again.** Since Batch 3: `/denik` (features/denik, day anchors `#d-`),
    `/data` releases (features/data-releases), `/graf/p/[ref]` permalinks, bitemporal kg history
    + `asOf` (lib/db/pglite/repositories/kg.ts), career spine (features/profile/careerSpine.ts).
    Doctrine lint rules are active — cite everything.
17. **Accusatory-claim discipline is absolute.** 4C especially: a computed collision is a
    *candidate*, never a published accusation — it must flow through the human review gate
    (features/money reviewActions pattern) before any public surface states it as fact. Computed
    candidates may render only in gated/internal surfaces or with explicit "vyžaduje ověření"
    framing. Follow the moneyLoader parity rule: absent review_state = pending, never verified.
18. **External data reality check (4A).** "Live MONITOR data" requires ingestion. Investigate
    what budget data exists today (features/budget, lib/ingest). Build the full-coverage
    architecture: an ingest adapter with fixture-tested parsing (lib/ingest/sources pattern),
    real data wired as far as practical THIS session (no long network crawls; a small real probe
    is fine if quick), coverage disclosed honestly on-page ("N z 6 254 obcí v záznamu").
    Architecture that scales to 6,254 + honest coverage beats fake completeness.

## Wave 4.1

### 4A. Every Town's Mirror — all 6,254 municipalities
- **Source proposal**: `financial-transparency.md` § BudgetMirror M1. Read fully.
- **Surface (exclusive)**: `features/budget/**`, `app/rozpocty/**`, NEW `lib/ingest/sources/monitor.ts`
  (+ colocated test) only.
- **Essence**: BudgetMirror escapes the 10-town mock: a real municipality dataset (MONITOR /
  státní pokladna shapes), computed peer groups (population band + region rule, disclosed),
  town search/picker over everything in the record, per-town mirror page state; coverage
  disclosure is a first-class UI element.
- **UX bar**: the picker must make 6k towns navigable (search-first, kraj grouping); peer-group
  rule printed; metric duos keep the existing instrument style.
- **Tests**: peer-group derivation, adapter parsing over fixtures, coverage stats.

### 4B. Kolizní radar — early warning for the drafting process
- **Source proposal**: `voting-legislation.md` § LawWatch M2. Read fully.
- **Surface (exclusive)**: `features/lawwatch/**`, `app/zakony/**`.
- **Essence**: the existing collision view becomes a radar: chronological early-warning ledger of
  newly-detected drafting conflicts (Case-1 flags + statute-collision candidates as they enter
  the record), each with a `#r-<id>` anchor, severity-free factual framing, RSS/JSON feed (reuse
  dukazy/denik codec pattern read-only), and embeddable per-conflict citation blocks.
- **UX bar**: radar strip + ledger in the LawWatch voice; the gated forensic posudek stays gated.
- **Tests**: radar derivation ordering/dedup, anchor ids, feed round-trip.

### 4C. Vote-Collision Engine — "hlasoval o penězích své firmy," computed
- **Source proposal**: `financial-transparency.md` § FollowTheMoney Graph M1. Read fully.
- **Surface (exclusive)**: NEW `features/money/collisions/**` + NEW `app/penize/strety/**` ONLY.
  You may READ everything (moneyLoader, moneyTypes, votes repositories, bill→statute graph,
  trailPath) but must NOT edit any existing features/money file — 4D/4E work there next wave.
- **Essence**: deterministic join of verified tie role-periods × real ballots × bill→statute
  edges → collision *candidates*: MP X held role at company Y during vote V on bill B affecting
  Y's sector/contract. Disclosed join rule; every candidate framed "vyžaduje lidské ověření";
  a reviewer-facing queue shape compatible with the existing review gate (write NO review rows —
  render candidates from derivation each request).
- **UX bar**: /penize/strety is forensic and calm: join-rule methodology block first, candidates
  as sourced fact rows (FactRow voice), per-candidate anchors, absolutely no scandal framing.
- **Tests**: join determinism over fixtures, role-period × vote-date window logic (boundary
  days), verified-only filtering, zero-candidate honest state.

## Wave 4.2 (dispatched after wave 4.1 returns)

### 4D. Municipal Money Trail — town budgets join the contract graph
- **Source proposal**: `financial-transparency.md` § BudgetMirror M2. Read fully.
- **Surface (exclusive)**: `features/budget/**`, `app/rozpocty/**` (post-4A state — integrate,
  don't fork), reading money graph loaders read-only.
- **Essence**: per-town supplier view: contracts from the money graph joined by IČO to the town
  as purchaser (where hlídač-of-contracts data exists in the kg), spend-vs-peers per supplier,
  links into FollowTheMoney entities and /graf permalinks.
- **Tests**: IČO join derivation, peer comparison, absent-data honesty.

### 4E. Evidence Packet Compiler — case files compile themselves
- **Source proposal**: `financial-transparency.md` § Money Case Files M2. Read fully.
- **Surface (exclusive)**: `features/money/**` (except `collisions/` — 4C's, read-only) +
  `app/penize/**` (except `strety/`).
- **Essence**: one click on a lead/case file compiles a sourced dossier packet: all verified
  ties, timeline, registry links, review provenance, ready-to-cite blocks; citation gate =
  unverified material is excluded and the exclusion is stated; печатable via PosterFrame
  (features/shared/poster) if it fits, else print CSS within your surface.
- **Tests**: packet derivation (verified-only gate, ordering, exclusion disclosure).

## Cross-feature coherence

- 4A/4D are two layers of the same page — 4D reads 4A's landed picker/peer structures.
- 4B/4C both produce "watch feeds" — same codec family (dukazy/denik precedent), different
  anchors (`#r-` drafting, `#s-` střety).
- 4C candidates + 4E packets must share the verified-only discipline; a 4C candidate NEVER
  appears in a 4E packet (packets are verified-material-only by definition).

## Orchestration

Wave 4.1: 3 parallel builders → orchestrator reviews, commits per item (`vibeman(moonshot-b4)`),
inter-wave gate (tsc + affected suites). Wave 4.2: 2 parallel builders → review, commits, then
full batch gates: typecheck, lint (0 errors, warnings ≤30), full vitest (≥867), `next build`.
