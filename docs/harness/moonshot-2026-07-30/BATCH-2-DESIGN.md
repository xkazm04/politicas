# Batch 2 — Provenance & Trust (design doc)

> 5 features, 5 parallel builders, one shared design contract.
> Package narrative: **every rendered claim becomes a verifiable receipt.** After this batch a
> reader can click any citation and see the underlying graph edge and its review status; the
> review audit trail is hash-chained and tamper-evident; every human verification decision is a
> public, citable event; the lint layer makes an unsourced claim a build error; and every
> formatted number carries machine-readable provenance. Batch 1 gave readers instruments —
> Batch 2 makes the instruments' honesty checkable.

## Shared design contract

**Identical to BATCH-1-DESIGN.md § "Shared design contract"** — read that section first and obey
all 9 points (house tokens via docs/DESIGN.md + globals.css, shared primitives, Czech UI copy,
lib/format helpers, custom lint rules are law, provenance discipline, no new npm deps, a11y +
reduced-motion, discoverability, exclusive surfaces, no git, tsc/eslint/vitest definition of done).

Batch-2 additions:

10. **Backward compatibility is sacred.** 2A/2B/2E touch shared substrate (SourceNote, the
    repository layer, the formatting layer) used by every feature. All changes must be additive —
    existing call sites keep compiling and keep rendering identically unless they opt in. Run the
    FULL test suite (`npx vitest run`) before finishing, not just your own tests. (Note: under
    parallel-builder load, PGlite store suites can flake on contention — if a store suite fails,
    re-run it in isolation before concluding you broke it.)
11. **DDL is additive-only** (new tables/columns/indexes fine; no drops, no rewrites of existing
    columns). The sample-data fallback path must keep working untouched.
12. **Czech copy stays colocated in your feature** (messages/*.json remains shared/out of bounds —
    Batch 1 precedent).

## Items

### 2A. Provenance Capsule — every citation becomes a verifiable receipt
- **Source proposal**: `shared-ui-primitives.md` § Shared Display Primitives M1. Read it fully.
- **Essence**: `SourceNote` gains a click-through: a capsule popover/page showing the receipt —
  the underlying kg edge(s), review status (verified/pending + who-gated pattern), source links,
  and a stable claim reference. Existing SourceNote call sites render unchanged; the capsule
  activates where richer provenance props are supplied (opt-in prop, additive).
- **Surface (exclusive)**: `features/shared/components/**` (NOT `features/shared/poster/`), new
  `features/shared/provenance/**`, and a receipt route `app/zdroj/[ref]/**` if a standalone page
  earns its keep. Read `lib/analysis/kg*.ts`, `lib/db/**` read-only.
- **UX bar**: the capsule is a small masterpiece — museum-receipt typography consistent with
  Batch 1's Exponát; keyboard/focus complete (popover is focus-trapped, ESC closes); the
  verified/pending distinction is unmistakable but calm.
- **Tests**: claim-ref codec round-trip; capsule view-model derivation from fixture kg rows.

### 2B. Tamper-Evident Ledger — hash-chain the audit trail
- **Source proposal**: `data-layer.md` § PGlite Repositories M1. Read it fully.
- **Essence**: review/audit events get a hash chain (each row stores prev-hash + row-hash over a
  canonical serialization) and per-ingest-run Merkle roots; a verification function walks the
  chain and reports first divergence; heads are exposed via a repository API (rendering them is
  Admin's job — the existing VaultHeadsPanel already shows vault heads; extend the *data* it can
  read, do not edit `features/admin/**`).
- **Surface (exclusive)**: `lib/db/pglite/**` (+ colocated tests), additive DDL only.
- **Bar**: canonical serialization is stable and documented in code (key order, encoding);
  chain survives process restart; verification is O(n) single pass; all existing repository
  tests keep passing.
- **Tests**: chain append/verify, tamper detection (bit-flip → first-divergence reported),
  Merkle root determinism, empty-chain edge case.

### 2C. Deník důkazů — the review console becomes a public evidence wire
- **Source proposal**: `data-ingestion.md` § Admin Console M1. Read it fully.
- **Essence**: every human verification decision (verified/rejected money ties, promoted
  verdicts) becomes a public, citable, chronological feed — a new public route `/dukazy` with
  dated decision entries (what was gated, decision, evidence links, stable anchor per entry), an
  RSS/JSON representation, and a cross-link from the admin ReviewHub ("zveřejněno v Deníku
  důkazů"). Read review state via existing loaders/repositories read-only where possible; add
  admin-side surfacing only inside your surface.
- **Surface (exclusive)**: `features/admin/**`, `app/admin/**`, new `features/dukazy/**` +
  `app/dukazy/**`.
- **UX bar**: the public feed reads like a court gazette — austere, dated, anchor-linked
  (`#z-<id>`), SourceNote on every entry; honest empty state when no decisions exist yet;
  feed formats (RSS/JSON) linked from the page header.
- **Tests**: feed derivation from fixture review rows (ordering, anchors, RSS/JSON codecs).

### 2D. Doctrine Compiler — evidence-citation as a compile-time guarantee
- **Source proposal**: `infrastructure-observability.md` § Custom ESLint Rules M1. Read it fully.
- **Essence**: a new lint rule family that statically requires provenance on rendered claims —
  e.g. components rendering score/money/vote figures must carry a SourceNote/disclosed-rule in
  the same JSX region. Detection heuristics documented in the rule; escape hatch is an explicit
  `data-undisclosed` marker that itself renders a visible "bez zdroje" badge convention
  (documented in rule docs, not enforced on old code yet).
- **Surface (exclusive)**: `eslint-rules/**`, `eslint.config.*` (root config), rule docs.
- **CRITICAL constraint**: the repo's lint MUST stay green — ship the rule at `warn` severity
  repo-wide, `error` only where the codebase is already clean (measure, then scope). Report the
  warning inventory (file → count) in your reply so escalation can be planned.
- **Tests**: ESLint RuleTester cases (positive/negative/escape-hatch) following the existing
  eslint-rules test pattern (check how existing rules are tested; if they aren't, add RuleTester
  coverage for yours as the new precedent).

### 2E. Numbers That Testify — provenance-bound formatting
- **Source proposal**: `infrastructure-observability.md` § i18n & Number Formatting M2. Read it fully.
- **Essence**: an additive formatting API — `formatCitable(value, claim)` (and a
  `<CitableNumber>` helper if it earns its keep) — that renders the same visible number as today
  but emits machine-readable claim metadata (data-attributes + optional JSON-LD ClaimReview-shaped
  block) tying the figure to its source/methodology/date. Adopt it in ONE reference surface you
  own: a small, self-contained demo integration is fine; broad adoption is later batches' work.
- **Surface (exclusive)**: `lib/i18n/**`, `lib/format.ts` (additive), new `lib/claims/**`,
  plus a minimal demo route `app/svedectvi/**` if needed for the reference integration.
- **Bar**: zero visual change to existing numbers; claim vocabulary documented in code; the
  JSON-LD validates against schema.org ClaimReview shape (structural, no network).
- **Tests**: claim serialization determinism, data-attribute emission, existing format tests
  untouched and passing.

## Cross-feature coherence

- 2A's claim-ref and 2E's claim vocabulary must not fork: 2E owns the claim *shape*
  (`lib/claims/**`); 2A consumes it for capsule references if present (soft dependency — if the
  other builder's module isn't there yet at your build time, define your interface locally in the
  same shape and note it; the orchestrator reconciles at review).
- 2B's chain heads and 2C's public feed are two views of the same trust story — 2C should link
  "ověřitelnost záznamu" to where heads live (admin VaultHeadsPanel today), not re-derive chains.
- Anchor id conventions follow Batch 1: `#h-<id>` votes, `#z-<id>` decisions.

## Orchestration

Same loop as Batch 1: parallel builders, exclusive surfaces, no git; orchestrator reviews against
this doc, commits per item (`vibeman(moonshot-b2): <item>`), then batch gates: `npm run typecheck`,
lint, full vitest (≥698 passing), `npx next build`.
