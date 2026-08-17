# Knowledge-Library Field Report — politicas

> Run of the **Knowledge-Library Field-Test Kit v1** (portability test of the
> Personas golden-path corpus). Target: `politicas`. 12 assigned leaves
> (4 universal core + 8 frontend). Read-only against source; the only file
> written is this report. No commits, no source edits, no mutating commands.
>
> **Headline: 46 physics clauses scored — 27 holds / 6 violates / 8 partial / 5 n/a.**
> politicas is not a naive adopter — it maintains its *own* four-state adherence
> ledger against this very corpus (`scripts/census/rules.json`), and several
> leaves (`commit-path-gates`, `cross-artifact-drift-gate`, `number-and-cost-formatting`,
> `design-token-usage`) were partly authored *from* politicas or its personas
> parent. The corpus's ideals therefore land here as near-exact matches on
> error-handling, error-boundaries, view-state, formatting and design tokens.
> The genuine gaps are three: **no content-based secret scanning at all**, the
> repo's **own ratcheting gates (census / library:check) are wired to no hook or
> CI**, and **silent result-cap truncation** in the entity picker.

---

## 0. Orientation

**Stack.** Next.js 16.2 (App Router, RSC) · React 19.2 · TypeScript 5 · Tailwind 4 ·
next-intl 4 (cs primary, en) · Recharts 3 · Framer Motion 12 · Sentry (`@sentry/nextjs`) ·
PGlite (`@electric-sql/pglite`, embedded Postgres/WASM) · Vitest 4 · lefthook 2.

**Size (tracked files by ext, `git ls-files`).** 1,832 tracked: **683 `.ts`,
221 `.tsx`, 492 `.json`, 305 `.md`, 100 `.mjs`, 17 `.cjs`, 5 `.js`, 4 `.yml`,
1 `.sql`, 1 `.css`.** ~30 route groups under `app/`, ~30 feature modules under `features/`.

**What it is.** A Czech civic-transparency data product ("the poster as a data
instrument") — parliamentary votes, money flows, laws, budgets, rendered as
functionalist information design. It ingests public open data into a local
PGlite store and renders server-first pages, each figure carrying a source citation.

**Own conventions (rich).** `CLAUDE.md` + `AGENTS.md` + `DESIGN.md` + `PRODUCT.md` +
`MEMORY.md` at root; `context-map.json`; **8 custom ESLint rules** in
`eslint-rules/*.cjs`, canonically packaged as an in-repo
`packages/eslint-plugin-civic-transparency`; a **census system**
(`scripts/census/`) that is a self-described *port* of personas' golden-path gate
engine, with a **library-adherence ledger** (`rules.json` — four states:
adopted / satisfied / declined / unreviewed) tracking this repo against the
shared corpus; a `memory/` system; `lefthook.yml`; two CI workflows
(`ci.yml`, `sentinel.yml`).

**Instrumentation note.** `rg` CLI is **absent** on this machine (`which rg` →
none). Two independent engines used for every count that matters: the harness
**Grep tool (ripgrep)** and **GNU grep 3.0**; `git grep` and `node -e` as
tie-breakers. Exit codes were read **directly, never through a pipe** (one
self-correction below where I initially did).

---

## 1. Scorecard

One row per scored physics clause. `executed?` = yes when a command/inspection
produced the evidence. Local-calibration clauses excluded per kit.

| leaf | clause | verdict | evidence (file:line, count, executed?) |
|---|---|---|---|
| swallowed-error-telemetry | durable record (not console/screen only) | holds | `lib/db/loaderGuard.ts:13-16` `reportLoaderFailure` = `console.error` + `Sentry.captureException`; **163** call sites (grep, exec). Result-typed returns e.g. `features/money/reviewActions.ts`. |
| swallowed-error-telemetry | one chokepoint (call site can't decide) | holds | single `reportLoaderFailure`; enforced by `custom/no-silent-null-catch` at `error` on `features/**/get*.ts`+`*Loader.ts` (`eslint.config.mjs:127-132`, exec). |
| swallowed-error-telemetry | stable call-site tag for aggregation | holds | `Sentry.captureException(err,{tags:{loader}})` `loaderGuard.ts:15`; boundaries tag `{boundary}` (`app/error.tsx:45`,`app/global-error.tsx:53`). |
| swallowed-error-telemetry | user vs operator = different door | holds | operator door = Sentry chokepoint; user door = Result return type surfaced (`{status:'error',message}`). `custom/no-silent-catch` at `error`, **0** empty-body findings. |
| swallowed-error-telemetry | (bind the error, always) | partial | **24** parameterless `catch {` (both engines) discard the value; sampled 5 — all benign input-normalization (`followCodec.ts:136`, `pumper.ts:99`), value carries no info. Escapes both custom rules (they see empty *body* only). |
| secret-leak-scanning | explicit control when scanner absent | violates | No scanner exists; no documented decision. Only reference to "gitleaks" is a stale comment in ported `scripts/census/run-census.mjs:35` pointing at a `scripts/secret-scan.mjs` that **does not exist here** (exec: `ls` → absent). |
| secret-leak-scanning | blocking control at last reversible moment (push) | violates | No secret gate on pre-commit, pre-push, or CI (read `lefthook.yml`, `.github/workflows/*.yml`). |
| secret-leak-scanning | name AND content defence both | violates | Only name-defence: `.gitignore:34` `.env*`. No content-based scan anywhere. |
| secret-leak-scanning | narrow allowlist / redaction reach / exclusion inventory | n/a (×3) | No scanner, redactor, or shareable-artifact redaction subject exists. |
| commit-path-gates | failure arm exits non-zero | holds | `lefthook.yml` jobs run `eslint`/`tsc`/`vitest` (natural non-zero); no `\|\| true`. |
| commit-path-gates | hook chosen by cost/blast radius | holds | pre-commit = staged `eslint --quiet` (`:14-16`); pre-push = `tsc`+`vitest` (`:20-23`); CI = full+build. Correct tiering. |
| commit-path-gates | glob scopes files read | holds | `glob: "*.{ts,tsx,mjs,cjs}"` (`lefthook.yml:15`). |
| commit-path-gates | no `\|\|true`/continue-on-error/`--max-warnings>0` | holds | none present; the one `continue-on-error:true` (`ci.yml:65`, npm audit) is explicitly documented as non-blocking advisory (`ci.yml:53-64`) — the corpus-sanctioned exception. |
| commit-path-gates | absence loud (exit non-zero when input missing) | holds | `sentinel.yml` exits 2 + uploads report when store absent (`:19-26`, exec-read); `db:snapshot --check` exits 1 on drift; census fail-loud contract. |
| commit-path-gates | ratcheting gate is actually sited on a hook | partial | `census --check` + `library:check` are in `npm run check` (`package.json:13`) but **wired to NO hook or CI** (grep `census\|library:check` over `.github/workflows/*` + `lefthook.yml` → only a comment). The repo's own ratchet runs nowhere automatically. |
| commit-path-gates | commit-message vocab as shared enum | n/a | No commit-msg hook / commitlint / changelog classifier exists here (those cited in the leaf are the *personas* parent). |
| cross-artifact-drift-gate | prove freshness by regen+compare, not diff | holds | `scripts/gen-migration.ts:30-48` regenerates from `CORE_DDL` and byte-compares; `db:snapshot --check` in `ci.yml:47-48`. |
| cross-artifact-drift-gate | determinism (LF/CRLF normalised) | holds | `gen-migration.ts:40-44` CRLF-normalises before compare; census artifacts sorted. |
| cross-artifact-drift-gate | register `--check` in >1 place | partial | `db:snapshot --check` in CI only (1 place); `census --check` in no automation. |
| cross-artifact-drift-gate | act on exit code (print ≠ gate) | holds | CI acts on `db:snapshot` exit; census exit is honoured *when* run. |
| cross-artifact-drift-gate | precondition fails loud on empty set | holds | **Executed:** `node scripts/census/run-census.mjs --check` on the empty registry → prints "checked nothing at all" and **exits 1** (true exit, non-piped). Literal match to the leaf's ideal. |
| cross-artifact-drift-gate | inventory direction for orphans | holds | `check-library-adherence.mjs` re-hashes the ported engine vs `personas@f9e3a33fd` and reports drift; `library-index.json` enumerates unreviewed principles (36) — inventory, not diff. |
| metric-tile | tile can express "not measured" (P1) | partial | `StatTile` `value:string` (`features/shared/components/StatTile.tsx:26`) — absence spent before the tile; mitigated by `lib/format.ts:15` `NOT_A_NUMBER_PLACEHOLDER "—"` upstream. |
| metric-tile | no stringify-before-tile (P3) | partial | Same: tile takes pre-formatted string; relies on formatter returning `—`, a favour not a type. |
| metric-tile | refusing to render is available (P5) | holds | `variant="illustrative"` + persistent ochre tag + changed plane/numeral colour, greyscale-safe (`StatTile.tsx:35-56`) — the exact "persistent banner over fixtures" the corpus praises. Plus **mandatory** `source` prop. |
| metric-tile | delta names baseline (P4) / polarity (P6) / sparkline domain (P7) | n/a (×3) | `StatTile` renders no delta, no up/down colour, no sparkline. |
| long-list-rendering | list is told how many rows to render (P1) | holds | `TownPicker` `RESULT_LIMIT=40` (`features/budget/TownPicker.tsx:21`) over 6,254 municipalities; `searchMunicipalities … .slice(0,limit)` (`mirrorData.ts:200-215`). No unbounded large DOM list found. |
| long-list-rendering | fetch-bound ≠ render-bound (P2) | holds | render bounded to 40 regardless of registry size. |
| long-list-rendering | disclose truncation, where rows stop (P5) | violates | 40-of-6,254 shown with **no "showing 40 of N"** anywhere in `TownPicker` (grep `results.length\|total\|of ` → only keyboard math). The cap is silent. |
| long-list-rendering | bound survives redesign / lives in primitive (P7) | partial | Caps are per-call-site `.slice(0,N)` (**27** sites, exec) — the "habit not a decision" shape; no shared windowing primitive. |
| long-list-rendering | sort-over-window (P3) / append stability (P4) / consistent threshold (P6) | n/a (×3) | No client-sorted paginated corpus, no load-more-append, no windowing observed (caps are top-N summaries). |
| error-boundary | latch resets on identity change (P1) | holds | Next route-scoped `error.tsx` + `unstable_retry` (`app/error.tsx:39,77`). |
| error-boundary | blast radius chosen at placement (P2) | partial | Only **2** boundaries repo-wide (`app/error.tsx`, `app/global-error.tsx`); no per-feature/per-panel `error.tsx`. All routes share one net. |
| error-boundary | fallback must not deref the broken thing (P3) | holds | `global-error.tsx` uses **static bilingual copy, no `useTranslations`** (renders outside the intl provider) — documented `:23-26`. Inner `error.tsx` may use the hook because a parent boundary exists. Exemplary. |
| error-boundary | retry only for non-deterministic (P4) | holds | offers retry **and** a navigation escape (`/dashboard`; hard `window.location.href='/'`). |
| error-boundary | every escape must actually leave (P5) | holds | `global-error.tsx:106-117` uses a hard reload (not `<Link>`) because the root layout is broken — documented. |
| error-boundary | boundary reports itself (P6) | holds | both call `Sentry.captureException(error,{tags:{boundary:…}})` (`:45`/`:53`). Leaf comment even records removing a false "a report has been sent" claim. |
| error-boundary | render/lifecycle-only; global handler needed (P7) | holds | `@sentry/nextjs` installs global `unhandledrejection`/`error` handlers (`instrumentation-client.ts`), covering the class boundaries miss. |
| error-boundary | report from captured state (P8) | holds | reads `error` from framework-supplied props, not re-read live state. |
| view-state-persistence | restored value is untrusted (P4) | holds | validate-on-read everywhere; no `JSON.parse` of storage outside an accessor (grep → 0). |
| view-state-persistence | check against what exists now, not shape (P5) | holds | `features/graph/GraphPage.tsx:41,55` `isVariant()` enum-membership guard → falls back to `"mapa"`. Textbook. |
| view-state-persistence | versionless migration = permanent rewrite (P9) | holds | `features/schranka/followCodec.ts:25` puts the **schema version in the key** (`politicas:schranka:v1`) — shape change = new key, zero migration code. `rules.json` says this was contributed **upstream**. |
| view-state-persistence | state has a home / lifetime by layout (P1,P2) | holds | 3 getItem sites total (both engines + rules.json agree), each a deliberate key/lifetime choice; existence-only at `ReferendumPage.tsx:95`. |
| entity-picker | hide only options that would fail; else visible (P1) | holds | non-covered municipalities are **shown and marked** (`inRecord`/`noNumbers` badge, `TownPicker.tsx:180`), never hidden. |
| entity-picker | empty state must not blame the query (P2) | holds | no hidden predicate excludes matchable rows, so empty = genuine no-match; `noResults` is truthful (`:140-143`). |
| entity-picker | show the distinguishing fact, not the name (P3) | holds | each option carries name + district + population + coverage status, grouped by region (`:145-184`) — the "4–7 facts" ideal. |
| entity-picker | disclose the discarded count, accurately (P5) | violates | `RESULT_LIMIT=40` over 6,254 with **no count disclosure** — same silent cap as long-list P5. |
| entity-picker | "the thing you chose is gone" (P4) | n/a | static 6,254-row registry, deletion not a real state; no dead-ref affordance but low risk. |
| entity-picker | four states not three (P6) | partial | data pre-loaded via props (server page), so only a no-match empty state exists; loading/failed collapse into the parent loader — acceptable given the architecture. |
| translation-completeness | language-substitution fallback hides failures (P4) | holds | `lib/i18n/request.ts:15` loads a **single** per-locale catalog; a missing key surfaces as the raw key (next-intl default), not silent English — a detectable failure. |
| translation-completeness | parity ≠ completeness; only domain-vs-catalog decides (P1) | partial | No completeness gate of **any** kind — neither the flawed locale-parity kind nor the correct domain-vs-catalog kind (grep `parity\|missing.*key\|i18n.*check` over `scripts/`+`package.json` → 0). cs/en are both 27 top-level keys but nothing enforces it. |
| translation-completeness | governance: gate keyed to right edit / strict-default / commit-not-tree (P5,P6,P7) | violates | No i18n gate exists to have a mode or an edit-trigger. |
| design-token-usage | write in the system's name (P1) | holds | semantic tokens (`ink/paper/signal/steel/cobalt/ochre…`, `DESIGN.md`); `custom/no-hardcoded-colors` at **error** everywhere except declared zones. |
| design-token-usage | re-pointing scale makes raw classes lie (P2) | n/a | No in-place Tailwind `--radius-*` override found (`app/globals.css` has only `9999px` pills). **Corpus's politicas radius claim is stale** — self-correction below. |
| design-token-usage | token-defining layer uses tokens most (P3) | holds | `features/landing/palette.ts` is the mirror source, exempted **and documented** (`eslint.config.mjs:108-115`). |
| design-token-usage | token = a decision made once (P4) | holds | single `DESIGN.md` palette → `globals.css` variables. |
| design-token-usage | exemption names the gap (P8) | holds | every `globalIgnores`/rule-off zone carries an inline rationale (`eslint.config.mjs:19-51,99-115`) — exemplary. Hardcoded hex = **43, in only 2 files, both exempt** (both engines agree). |
| number-and-cost-formatting | hand to a locale layer (P1) | holds | `lib/format.ts` `formattersFor(locale)`; every entry point takes `locale`. |
| number-and-cost-formatting | rounding = loss contract (P2) | holds | `formatCompactCzk` (`:135-156`) chooses magnitude suffix per quantity. |
| number-and-cost-formatting | quantity+unit is one value (P3) | holds | currency placed per locale (`2 300 Kč` vs `CZK 2,300`, `:118-119`), not naive concatenation. |
| number-and-cost-formatting | zero/unknown/too-small distinct (P4) | holds | finite → number; non-finite → `—` (`:15,36,63`), so unknown ≠ 0. |
| number-and-cost-formatting | formatter that defaults a locale is blind (P5) | holds | locale **bound inside** `useFormat()` (`lib/i18n/useFormat.ts:13-16`) — no argument to forget. The corpus's own cited reference fix. |
| number-and-cost-formatting | checker keys on output, not syntax position (P6) | partial | `custom/no-raw-number-display` triggers on JSX-child syntax position (the exact P6 shape); `lib/` chokepoint deliberately exempt. 10 `toFixed`/`toLocaleString` sites remain, concentrated in `lib/`. |
| number-and-cost-formatting | two primitives disagreeing on locale source (P7) | holds | single `lib/format` chokepoint; `useFormat` the only binder. |

**Summary: 46 physics clauses scored — 27 holds / 6 violates / 8 partial / 5 n/a.**
(n/a rows collapse multiple absent-subject clauses; the leaf-level picture:
5 leaves HOLD strongly [swallowed-error, error-boundary, view-state, design-token,
number-formatting], 4 PARTIAL [commit-path, cross-artifact-drift, long-list,
entity-picker, translation-completeness], 1 VIOLATES [secret-leak], metric-tile HOLDS-with-P3-partial.)

---

## 2. Deviations (APPLY lane — nothing applied)

**D1 — No content-based secret scanning (secret-leak-scanning, severity: HIGH).**
Site: absent across `lefthook.yml`, `ci.yml`, `sentinel.yml`. politicas is a
public open-data product, so leak *risk* is lower than a credentialed app — but
not zero (ingest scripts hold source URLs/keys, Sentry DSN, a Fly deploy). The
fix is a content gate at the last reversible moment: a `gitleaks` (or
`trufflehog`) pre-push job **that exits non-zero when the binary is absent**
(the leaf's clause 1), plus a CI job. **Held:** adding a gate changes contributor
workflow and needs a baseline scan first (existing history may contain the DSN,
which is `NEXT_PUBLIC` and intentionally public) — a behaviour/process change,
not a code edit.

**D2 — The repo's own ratcheting gates run in no automation (commit-path-gates
+ cross-artifact-drift-gate, severity: MEDIUM).** `census --check` and
`library:check` exist, are correct, and fail loudly (verified: exit 1 on empty
registry) — but are invoked only by `npm run check`, which no hook or CI calls.
Fix: add a `census-check` job to `ci.yml` and/or a pre-push job. **Held:**
`rules.json` currently declares `rules: []` (all principles are `satisfied`/
`declined`, none `adopted`), so `census --check` exits 1 on the empty registry
*today* — wiring it to CI without first adding at least one adopted rule (or a
"non-empty-or-skip" guard) would red every build. The fix is real but must be
sequenced with a rule adoption. A measurement, not a gate, exactly as the leaf warns.

**D3 — Silent result-cap truncation in the entity picker (entity-picker P5 +
long-list P5, severity: MEDIUM).** `features/budget/TownPicker.tsx` shows at most
40 of 6,254 municipalities with no signal that more exist; `searchMunicipalities`
(`mirrorData.ts:200-215`) caps via `.slice(0,limit)` silently. Fix: when
`results.length === RESULT_LIMIT`, render a "showing first 40 — refine your
search" footer (the leaf's "say so where the rows stop"). **Held:** it is a
user-facing copy addition (needs cs+en strings) — a UI/behaviour change.

**D4 — 24 parameterless `catch {` discard the error value (swallowed-error P
"bind always", severity: LOW).** All 5 sampled are benign input-normalization
where the error carries no information (URL parse, JSON.parse of local state).
Fix would be `catch (err)` + a comment, but the value genuinely adds nothing
here; the custom rules correctly don't flag them. Lowest priority; note only.

**D5 — Only 2 error boundaries (error-boundary P2, severity: LOW).** A crash in
any of ~30 route groups is caught by the same `app/error.tsx`; a per-feature
`error.tsx` at the heaviest data surfaces (`/graf`, `/penize`) would shrink the
blast radius. **Held:** placement is *correct* (below root layout, left nav
survives) — this is a refinement, not a defect.

**D6 — No translation-completeness gate (translation-completeness, severity: LOW-MEDIUM).**
Neither a locale-parity check nor a domain-vs-catalog check exists. The P4 safety
(no silent language fallback) means gaps surface as raw keys rather than fake
English, which caps the damage — hence LOW-MEDIUM. Fix: a domain-vs-catalog gate
keyed to the enums the labels must cover (party/status tokens), per the leaf.

---

## 3. Enrichment (BRING-BACK lane)

Candidates this repo does that the corpus lacks or states differently. `in_corpus`
checked against `personas/docs/concepts/golden-paths/index.json`.

**E1 — SSR/RSC number-formatting must be deterministic across server/client ICU
versions (lane: frontend / code-quality). in_corpus: NO (partial).** `lib/format.ts`
deliberately avoids `Intl`/`toLocaleString` *entirely* and hand-rolls digit
grouping (`groupDigits`, `:22`) because `toLocaleString("cs-CZ")` emits the Czech
thousands separator as **U+00A0 on some ICU versions and U+202F on others**
(`:142-149`, `:48-51`), so server and client render the same number as **different
bytes and break React hydration**. Executed: the file's four surviving
`toLocaleString` calls were removed for exactly this reason (documented in-file).
**Physics:** any SSR/RSC framework (Next, Remix, Astro islands) that formats
numbers in shared code hits this independently — it is correctness, not taste.
The corpus's `number-and-cost-formatting.md` covers *locale correctness*
(OS-locale vs app-locale) but **grep of that leaf for `hydrat` → 0 hits**; the
determinism-for-hydration clause is absent. Propose as a new P-clause there.

**E2 — Lint-enforced per-render provenance + byte-identical machine claim (lane:
frontend / code-quality). in_corpus: NO.** `custom/require-source-citation`
(`packages/eslint-plugin-civic-transparency/rules/require-source-citation.cjs`)
**fails the build** when a file that renders a formatted domain number in JSX
lacks a provenance element (`<SourceNote>`/`<CitableNumber>`/…), at `error` in
`app/**` (`eslint.config.mjs:92-98`). It is paired with `formatCitable`
(`lib/format.ts:188-195`) whose contract is that the **visible text is
byte-identical to the machine `data-claim-value`**. **Physics:** in any
data-journalism / analytics / transparency product a displayed figure without a
machine-verifiable citation is an unfalsifiable claim, and review alone doesn't
hold the line — so it must be a gate keyed to the render site. `index.json` has
`data-provenance-disclosure.md` but grep of it for `citation`/`eslint`/
`byte-identical`/`every number` → **0**; the *enforcement + byte-identity* angle
is net-new.

**E3 — Server/client import boundary as a lint rule (lane: code-quality).
in_corpus: NO (`server-import` → 0 in index).** `custom/no-server-import-in-client`
forbids **value** imports of server loaders (`get*.ts`/`*Loader.ts`) and
`@/lib/db/*` inside `"use client"` files, allowing `import type` (erases at
compile). Rationale: a value import "drags `getStore()`/PGlite WASM toward the
browser bundle." **Physics:** every framework with a server/client bundle split
has this exact hazard — a server-only module (DB driver, secrets, `fs`, native
WASM) reachable from a client component leaks into the browser bundle, a
correctness *and* security boundary. Header comments alone don't enforce it.

**E4 — A consuming repo's four-state adherence ledger against a shared knowledge
library (lane: process / code-quality). in_corpus: NO (`adherence`/`library-index`
→ 0 in index).** `scripts/census/rules.json` records this repo's stance on every
corpus principle in **four states** — `adopted` (a local gate + measured
baseline), `satisfied` (already met by a *named, reproducible* mechanism),
`declined` (reviewed + reason), `unreviewed` (reported, never failed on) — and
`check-library-adherence.mjs` (a) re-hashes the ported census engine against
`personas@f9e3a33fd` to detect local drift and (b) prints the unreviewed
principles **ranked by recurrence** (executed: `typed-error-contract` 2562,
`design-token-usage` 2104, `i18n-string-authoring` 1454…). Each `satisfied`
entry carries a `verifiedBy` command and an `upstream` backflow note.
**Physics:** any organization running one knowledge library across N repos needs
per-repo adherence state that is *not* binary — the two-state (rule/no-rule)
model forces a repo to either write a bad gate or look non-compliant, and this
repo learned that the hard way ("the first two adoptions BOTH measured 0 true
positives"). This is the meta-protocol the field test itself implicitly wants.

**E5 — "Unevaluable ≠ ok"; a SKIPPED CI step reads as green (lane: process / data).
in_corpus: NO (`unevaluable` → 0).** `sentinel.yml` was rewritten (2026-08-13) so
its invariant-audit step is **unconditional**: when the data store is absent it
reports every invariant as `unevaluable` (never `ok`), **exits 2**, and uploads
the report anyway — because the previous guard-`if` made a store-less run render
as "a green check mark with zero invariants evaluated" (`:10-26`). **Physics:**
this is the fail-loud-on-empty doctrine (already in `commit-path-gates` /
`cross-artifact-drift-gate`) but sharpened with a GitHub-Actions-specific trap
worth its own note: **a skipped step does not fail a job**, so any `if:`-gated
verification silently disappears into a pass. Propose as an addendum, not a new leaf.

**E6 — Result-typed error contract as a first-class alternative to the reporting
door (lane: code-quality). in_corpus: YES — `typed-error-contract.md` exists
(`typed-error` → 7 in index).** Recorded as convergence, not net-new: politicas's
`swallowed-error-telemetry` `satisfied` entry argues the error becomes part of
the **return type** (`{status:'error'}` / `{ok:false,errors:[]}`), typechecker-
enforced, which a caller cannot ignore the way it can ignore an unreported side
effect. Evidence that the corpus's own `typed-error-contract` clause reinvents
independently. Worth cross-linking from `swallowed-error-telemetry` as the
"stronger door" for Result-shaped codebases.

---

## 4. Methodics compliance

- **clauses_scored:** 46 physics clauses across 12 leaves (n/a rows collapse
  same-subject-absent clauses).
- **executed vs read:** ~34 measurements **executed** (greps on both engines,
  4 gate runs by true exit code, `node -e` parity, file inspections that
  produced counts); the corpus `## Principle` heads and a handful of long source
  files were **read** for clause definitions and to characterize (not count).
  Every *verdict* points at a `file:line` produced by execution or direct inspection.
- **two-implementation counts:**
  - catch-with-binding clauses: GNU grep **115** vs ripgrep(Grep) **115** — agree.
  - hardcoded hex: grep **43 / 2 files** vs Grep **43 / 2 files** (palette.ts 8, VariantRentgen.tsx 35) — agree.
  - `localStorage.getItem` sites: grep **3**, cross-checked against `rules.json`'s
    prior independent measurement (**3**) — agree.
  - No disagreements encountered; samples hand-verified (5 catch bodies, 3 getItem sites, TownPicker cap).
- **gate exit codes (executed, non-piped):** `census --check` = **1**
  (fail-loud on empty registry); `census self-test` = **0** (23/23);
  `library:check` = **0** (adherence OK); `db:snapshot --check` via tsx = **0**
  (schema fresh).
- **self-corrections during the run:**
  1. **Pipe-exit-code error (the doctrine's own warning).** First read
     `census`/`db:snapshot` exit via `node … | tail; echo $?` — that reported
     `tail`'s exit (0), masking census's real **1**. Re-ran without the pipe;
     corrected all four gate exits.
  2. **`node` vs `tsx`.** `node scripts/gen-migration.ts --check` exited 1 by
     failing to resolve the `@/` alias / TS, not by drift; re-ran with `npx tsx`
     → true exit 0. Discarded the bogus result.
  3. **Corpus staleness caught.** `design-token-usage.md` claims politicas
     overrides `--radius-lg` in `globals.css`; current tree has only `9999px`
     pills, no in-place `--radius-*` override → scored P2 **n/a** and flagged the
     corpus claim stale rather than inheriting it.
  4. **Phantom infrastructure avoided.** `commit-path-gates` / `cross-artifact-
     drift-gate` / `secret-leak-scanning` cite `lefthook.yml:15-51`, `.ai/doctor.mjs`,
     `scripts/generate-changelog.mjs`, `scripts/secret-scan.mjs` — none of which
     exist in politicas (they are the **personas parent**'s). Verified by `ls`
     and scored politicas's real, simpler infra instead of the phantom.
- **instrument absence reported honestly:** `rg` CLI absent → substituted two
  other ripgrep/grep engines; said so rather than fabricating an `rg` result.
- **credentials:** no secret value printed; secret-scan finding is stated as
  shape/location only. No DB opened (the PGlite store is gitignored and was not
  touched).
