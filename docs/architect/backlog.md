# Architect Backlog

Durable queue of architectural decisions. Sorted by `(reach × payoff) / (risk × effort)`.
Status values: `proposed | approved | in-progress | shipped | abandoned | blocked`.

## Pending

- **[2026-09-01] Moonshot deck — 47 L/XL cards in 9 corroborated themes, all pending a human decision** — type: portfolio, risk: n/a, effort: l–xl, payoff: see per-card scores, reach: 10 groups / 49 contexts
  Record: [[moonshot-2026-09-01]] (decision table + full §4.10 bodies) · Lens: ad-hoc `moonshot-architect` via scan-sweep · Status: triaged 2026-09-04 — 34 accepted, 3 folded, 10 rejected (per card in the record); nothing built yet
  Strongest spines by corroboration: as-of re-derivation from the bitemporal store (5 scouts), a claim address on every figure (5), one audited review door for every claim kind (5), the municipality as one graph subject (4).
- **[2026-07-26] One fallback-state contract (labelled mock / honest empty / DataUnavailable)** — type: weak-pattern, risk: 3, effort: l, payoff: 5, reach: 16 pages / 5 idioms / 6 mock-welded components
  ADR: [[decisions/2026-07-26-fallback-state-contract]] · Scan: [[scans/2026-07-26-data-loading-boundary]] · Status: proposed
  Notes: contains the highest-severity brand item — fabricated 2,1 mld Kč cited to the real contracts registry with no sample banner (`FollowTheMoneyPage.tsx:66-71`).
- **[2026-07-26] Ingest readiness guard + cardinality-floor test** — type: structural-bug-class, risk: 2, effort: m, payoff: 4, reach: 7 loaders / 0 ingest_run consumers / 0 cardinality tests
  ADR: [[decisions/2026-07-26-ingest-readiness-guard]] · Scan: [[scans/2026-07-26-data-loading-boundary]] · Status: in-progress (25a7b65 gate + floors + test shipped; /admin ingest-status surfacing remains)

- **[2026-09-01] Empty slices are scored, not withheld — `scoreSlice` gives a 0-row slice 1/5 on four criteria** — type: convention-gap (law: missing-is-not-zero), risk: 2, effort: m, payoff: 3, reach: every source×term×entity `slice-stats.ts` emits with 0 rows
  Found by: scan-sweep (analysis-quality, registry-conformance lens) · Site: `lib/analysis/quality.ts` `scoreSlice` (`fracScore(0) = 1`), emitted unconditionally by `scripts/data-analysis/slice-stats.ts` · Status: proposed (gate: contract — `SliceQualityRow.scores` would need a not-measured state, and `slice_quality` + DataHub consumers read the six numbers)
  Notes: the outbox finding cap was full when found, so this line is the record.

- **[2026-09-05] CLAUDE.md counts nine custom ESLint rules; the plugin, its self-test and its README count ten** — type: prose-rule-drift, risk: 1, effort: s, payoff: 3, reach: 2 lines in CLAUDE.md (138, 201) + "Next 16.2" vs package.json 16.3.1
  Found by: scan-sweep (app-config, parity-auditor) · Result: better (3 stale claims -> 0), gate: none · Status: proposed — vetoed in-round only because CLAUDE.md is outside app-config's paths
  Root cause is structural: `docs/feature-doc-map.json` couples NOTHING to `eslint.config.mjs`, so the commit-msg `doc-sync` hook could not owe a trailer when `a038aaa` added the tenth rule. Fix both: correct the count, and add an entry coupling `eslint.config.mjs` + `packages/eslint-plugin-civic-transparency/index.cjs` to CLAUDE.md and `eslint-rules/README.md`.
- **[2026-09-05] Widen `no-source-note-size-override` to static prop defaults — its declared blocker is gone** — type: gate-gap (renameable-detector-key: the override moves one hop and the matcher goes blind), risk: 2, effort: s–m, payoff: 4, reach: 404 `<SourceNote>` sites in 107 files; 0 hits today for `className = "… !text-[10px]"` defaults
  Found by: scan-sweep (app-config, parity-auditor) · Site: `packages/eslint-plugin-civic-transparency/rules/no-source-note-size-override.cjs:60-69` still says "fix that one default, then widen" — `BasisDisclosure.tsx` default is `mt-2` since 2026-08-24 · Result: better by probe (seed `className = "mt-2 !text-[10px]"` default -> 0 hits now, 1 after), gate: policy-tighten with a RuleTester case · Status: proposed — vetoed in-round (lint-rules context)
- **[2026-09-05] `/:path*` sends no `Permissions-Policy`** — type: hardening, risk: 1, effort: s (+ s instrument), payoff: 3, reach: every response (4 security headers today, measured via the config's resolved `headers()`: 2 rules)
  Found by: scan-sweep (app-config, security-auditor) · Result: better (4 -> 5 headers), gate: policy-tighten — auto-acceptable ONLY once a header contract test pins the set. Instrument: a vitest that imports `next.config.ts` (the export is double-wrapped: unwrap `.default` twice, then `await cfg.headers()`; probed 2026-09-05, resolves to 2 rules) and asserts the `/:path*` key set + `frame-ancestors *` on `/embed/:path*`. Not built in-round: it drags `@sentry/nextjs` + `next-intl/plugin` into the unit lane and its file must live under `lib/**`, outside app-config's paths · Status: proposed
- **[2026-09-05] The catalog boundary bans `lib/civic` and `features/*` only, while `features/shared` imports `lib/db` ×6, `lib/analysis` ×3, `lib/kg`, `lib/claims`** — type: stated-rule-vs-enforced-rule, risk: 3, effort: m, payoff: 4, reach: 11 import sites in 6 files (`provenance/getReceiptData.ts`, `provenance/receipt.ts`, `components/AnimatedScore.tsx`, 3 tests)
  Found by: scan-sweep (app-config, architecture-analyst) · `eslint.config.mjs:257-259` says the catalog "must not import domain data or feature code"; the `no-restricted-imports` groups enforce a narrower rule, and CLAUDE.md states the narrower one · Result: measurable (11 -> 0) but every fix relocates a module out of `features/shared` (a loader lives IN the catalog) — escalation: architecture · Status: proposed; decide whether the principle or the enforced rule is the contract
- **[2026-09-05] context-map `app-config` entry is stale** — type: map-drift, risk: 1, effort: s, payoff: 2, reach: 1 entry
  Found by: scan-sweep (app-config) · description says "4 custom rules" (10 registered), names tsconfig/lefthook/env template that `file_paths` does not carry (only `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`), `entry_points` lists `tsconfig.json` outside its own `file_paths` · escalation: architecture (context-map edit) · Status: proposed

- **[2026-09-05] One request-base-URL helper instead of twelve copies — and one canonical origin instead of two** — type: duplication (pair rule: env `metadataBase` in `app/layout.tsx` vs `host` + `x-forwarded-proto` at 12 sites), risk: 2, effort: m, payoff: 4, reach: 12 sites (`app/robots.ts`, `app/sitemap.ts`, 4 feed routes, `/kraj/[kraj]`, `/plakat/[view]`, `/zdroj/[ref]`, `features/denik/feedRequest.ts`, `features/schranka/feedRequest.ts`, `features/graph/getPermalinkData.ts`) all defaulting proto to `http`
  Found by: scan-sweep (app-shell, parity-auditor) · Two mechanisms answer "what is this deployment's origin": `NEXT_PUBLIC_SITE_URL` for social cards only (`.env.example` says so on purpose), request headers everywhere else — so a proxy that drops `x-forwarded-proto` yields `http://` in the sitemap while og:image is `https://`, and a Host header is trusted verbatim in a crawler-facing file. Result: measurable (12 -> 1 derivation site; 2 -> 1 origins of truth) · escalation: architecture — a new `lib/` module consumed by six contexts, and the env-vs-header precedence is a deploy-contract decision (the record's "never a guessed domain" rule must survive it) · Status: proposed
- **[2026-09-05] context-map `app-shell` says Next.js 16.2; package.json is 16.3.1 — the exact delta that broke both error boundaries** — type: map-drift, risk: 1, effort: s, payoff: 3, reach: 1 entry (`tech_stack`), same drift as CLAUDE.md "Next 16.2"
  Found by: scan-sweep (app-shell, dependency-auditor) · The 16.2 -> 16.3 upgrade renamed `unstable_retry` to `retry` (fixed in 3731550); a version pinned in prose in two places and in code in one is how it went unnoticed · escalation: architecture (context-map edit) · Status: proposed

## Shipped

- **[2026-07-26] Bring the loader chain under test** — shipped 2026-09-02 via `/architect resume` (commits 6753f8b, 366e866, 1c035c4, b9684ae, 75798b1)
  ADR: [[decisions/2026-07-26-loader-test-coverage]] · every wired loader has a direct test (loaders.test.ts, one boot), the row mappers have parity + coercion tests, the getStore() lockstep contract is pinned, and the absorbed duplicate suite is gone.

- **[2026-07-26] Enforce the server-only loader boundary mechanically** — code complete 2026-09-01 via `/architect resume`, browser smoke pending (commits 431d147, 4e1f112, 45d8fea, 09004fa, 751b100, b22d1a9, 0b217ff)
  ADR: [[decisions/2026-07-26-server-only-boundary-enforcement]] · 9 loaders' prop types moved to sibling `*Types.ts` (29 client import sites), `getPermalinkData` guarded, and the rule now runs with `typeImports: "forbid"` — a `"use client"` file imports nothing from a loader, not even a type. Not browser-verified (no JSX touched).

- **[2026-07-26] One mapper for the money tie** — shipped same day (commit 8dddf90, live-verified)
  ADR: [[decisions/2026-07-26-money-tie-mapper-dedup]] · `mapLinkedToTie()` owns the projection; ReviewTie deliberately left as a separate projection (rationale in the ADR).

- **[2026-07-26] Rejected first `open()` poisons the process** — shipped same day (commit 45220bb, with regression test)
  ADR: [[decisions/2026-07-26-memoised-rejection-open]] · graphLoader null-memo invalidation deferred to the round-4 session.

- **[2026-07-26] Narrow `kg_*.props` by guard, never by `as`** — shipped same day (commit a2a70cd)
  ADR: [[decisions/2026-07-26-props-union-narrowing]] · 4 of 6 casts fixed via `asUnion()`; graphLoader's 2 deferred to the round-4 session.

- **[2026-07-26] Silent degradation to mock — observability for `catch { return null }`** — shipped same day (commits d315eb7, 223a727, cd80b51)
  ADR: [[decisions/2026-07-26-silent-degradation-observability]] · 14 sites wired + lint rule; `features/graph` (4 sites) deferred to the concurrent round-4 session.

## Abandoned / Blocked
_None yet._
