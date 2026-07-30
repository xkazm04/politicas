# Batch 6 — Ecosystem (design doc)

> 5 features, one parallel wave.
> Package narrative: **the discipline goes public.** The parsing layer becomes a library any
> Czech civic-tech project can adopt; the lint doctrine becomes a publishable plugin; the claim
> gate becomes a verification surface newsrooms can use; data quality itself gets published
> scores; and the ingestion loop becomes something you can drive, not just watch.

## Shared design contract

**The full chain binds: BATCH-1 § Shared design contract + BATCH-2 add. 10–12 + BATCH-3
add. 13–15 + BATCH-4 add. 16–17 + BATCH-5 add. 19–22.** Read them all.

Batch-6 additions:

23. **The tree has moved again.** Since Batch 5: statute dossiers in features/lawwatch
    (/zakony/predpis), kompas in features/votetrack/kompas, change_event table +
    repositories/changes.ts, tripwires in lib/analysis + admin ("Hlídky grafu"), /kraj cards,
    PosterToolbar has a printLabel prop. Doctrine rules active; claims live in lib/claims;
    receipts in features/shared/provenance.
24. **In-repo packages, not npm publishes.** 6A/6B extract into `packages/<name>/` with their own
    package.json + README + tests, consumed via tsconfig path aliases or relative imports —
    NO registry publishing, NO new external deps, and the app's existing imports keep working
    via thin re-export shims. The package must stand alone (no imports back into app code).
25. **Drive actions need brakes (6E).** Any action that mutates loop state requires an explicit
    confirm affordance, is logged to the append-only audit (the hash-chain covers it if it flows
    through review repos — otherwise disclose non-chained), and no action may delete data.

## Items

### 6A. czech-civic-data — the shared standard library
- **Source proposal**: `data-ingestion.md` § Ingestion Normalization M1. Read fully.
- **Surface (exclusive)**: NEW `packages/czech-civic-data/**`, `lib/ingest/normalize.ts`,
  `lib/ingest/unl.ts`, `lib/ingest/zip.ts` (converted to re-export shims), root `tsconfig.json`
  (additive path alias only).
- **Essence**: extract the UNL/cp1250/zip/fold normalization layer into a standalone package:
  clean public API, typed, documented README (Czech + English) with real examples per source
  family (PSP UNL, Kiosek, Dataor), its own test suite (move + extend the existing coverage),
  zero app-code imports. App consumes it through the shims so nothing else changes.
- **Tests**: the moved suite passes inside the package; shim equivalence (same exports).

### 6B. eslint-plugin-civic-transparency — the doctrine ships
- **Source proposal**: `infrastructure-observability.md` § Custom ESLint Rules M2. Read fully.
- **Surface (exclusive)**: NEW `packages/eslint-plugin-civic-transparency/**`, `eslint-rules/**`
  (shims), `eslint.config.mjs`.
- **Essence**: package ALL the custom rules (the 6 originals + the 2 doctrine rules) as a proper
  flat-config ESLint plugin: plugin object, `configs.recommended` + `configs.strict` presets,
  per-rule docs (when-it-fires, escape hatches, why), RuleTester suites moved in, README with
  adoption guide for other projects. The app's eslint.config consumes the package; eslint-rules/
  becomes shims (or is consumed from the package path directly). Repo lint output must be
  IDENTICAL before/after (0 errors, same 30 warnings).
- **Tests**: all RuleTester suites pass from the package; config parity check.

### 6C. Civic Claim Gate — verification as a product surface
- **Source proposal**: `data-layer.md` § Scoring & Verdict Copy M2 ("Civic Claim Gate as a
  product"). Read fully.
- **Surface (exclusive)**: NEW `features/overeni/**` + `app/overeni/**`, `lib/claims/**`
  (additive extension).
- **Essence**: a public verification surface at `/overeni`: paste a politicas claim (a claim-ref,
  a /zdroj or /graf/p permalink, or a `data-claim-*` payload) → the gate re-derives it against
  the current record and answers: verified-as-stated / value-moved-since (with both values +
  dates) / unknown-ref — each with the full receipt (sources, review status, hash). A "jak
  citovat, aby to bylo ověřitelné" guide for newsrooms. NO free-text fact-checking — only
  politicas-issued refs; that boundary is stated prominently (it IS the product: fabrication-
  proofing of politicas-derived numbers).
- **Tests**: ref-type detection, re-derivation verdicts (verified/moved/unknown) over fixtures,
  guide-page claim examples stay valid.

### 6D. Open-Data Quality Atlas — publish the quality scores
- **Source proposal**: `data-layer.md` § Knowledge Graph Domain Model M2. Read fully.
- **Surface (exclusive)**: `lib/analysis/**` (new atlas module; coexist with tripwires), NEW
  `features/atlas/**` + `app/atlas/**`.
- **Essence**: per-source quality scores computed from what the record already knows: coverage
  (entities with/without provenance), freshness (last ingest per source vs cadence), integrity
  (Merkle-sealed runs via LedgerRepository), completeness (disclosed-gap counts from the
  contexts), each with the scoring rule printed. Published at `/atlas` as sortable source cards +
  a machine-readable `/atlas/atlas.json`.
- **Tests**: score derivations per dimension over fixtures, determinism, honest unknowns
  (a dimension without data scores "nehodnoceno", never 0).

### 6E. Loop mission control — the loop becomes drivable
- **Source proposal**: `data-ingestion.md` § Admin Console M2. Read fully.
- **Surface (exclusive)**: `features/admin/**`, `app/admin/**` (post-Tripwires state — Hlídky
  grafu stays intact), `scripts/case-loops/**` read-only.
- **Essence**: machine-readable loop state (`/admin/loops.json`: per-loop status, last pass,
  durations, failure causes, next-expected) + drive affordances per addition 25: re-queue a
  failed loop step, reorder pending work, acknowledge/silence an alert — each with confirm,
  each logged, none destructive. Alerts derive from state (stalled > cadence×2, failure streaks)
  — same freshness logic family as 6D but over loop runs, not sources.
- **Tests**: loop-state derivation from fixture runs, alert rules (stalled/streak boundaries),
  action log entries, machine-readable codec.

## Cross-feature coherence

- 6D (source freshness) and 6E (loop freshness) must share the cadence/staleness vocabulary —
  agree on wording via the design doc, not imports (different surfaces).
- 6C consumes lib/claims (2E) and receipt patterns (2A) — extend, never fork; if you need a
  claim-shape change, make it additive and note it for the ClaimReview-consolidation follow-up.
- 6A/6B READMEs cross-link each other and /data + /atlas as the public faces of the same
  ecosystem story.

## Orchestration

Single wave, 5 parallel builders, exclusive surfaces, no git. Commits `vibeman(moonshot-b6)`.
Gates: typecheck, lint (0 errors, warnings ≤30, output identical for 6B), full vitest (≥1074),
`next build`.
