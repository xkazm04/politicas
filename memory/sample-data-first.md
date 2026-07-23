---
name: sample-data-first
description: UI is built against final data shapes over a deterministic mock layer BEFORE real ingestion — a deliberate strategy.
---

# Deterministic sample-data-first — the core build strategy

Phases 1–3 shipped every module surface over a **deterministic, test-pinned
sample-data layer** (`lib/civic/`), with **no live ingestion**. This is a
deliberate bet, not a shortcut: the UI is built against the *final* data shapes
now, so real ingestion (psp.cz vote dumps, Hlídač, ARES, Registr smluv →
entity resolution → Postgres) becomes a swap of `lib/civic` internals with the
component layer already correct.

Hard rules the mock layer enforces (and `lib/civic/data.test.ts` pins as
invariants, 22 checks):
- **No `Math.random` / `Date` in data generation** — SSR must equal CSR, or
  hydration mismatches. The 200-MP leaderboard is a deterministic generator
  (`leaderboard.ts`) with sample MPs anchored at exact ranks, party seats
  reconciled, and `score == composite(pillars)`.
- **The mock is labeled as mock in the UI** ("ilustrativní mock nad tvarem …")
  — never presented as real data.
- Extend `lib/civic/data.ts`; don't inline one-off mocks in components.

**Why it matters:** when replacing mocks with real ingestion, *keep the current
data shapes* — the entire UI depends on them. And any new sample data must stay
deterministic and reconcile with the pinned invariants, or `npm run check`
fails on hydration/consistency.
