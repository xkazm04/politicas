import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// The custom rule pack lives in the in-repo package (moonshot batch-6, 6B) —
// see packages/eslint-plugin-civic-transparency/README.md for the adoption
// guide and per-rule docs. `eslint-rules/*.cjs` remain as compat shims.
// Registered here under the historical `custom` prefix (NOT via the package's
// `configs.recommended`, which uses the canonical `civic-transparency` prefix)
// so every rule ID, severity, and scope below stays byte-identical to the
// pre-extraction config; the presets exist for external adopters.
const civicTransparency = require("./packages/eslint-plugin-civic-transparency/index.cjs");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `.justice-samples/` holds raw downloaded source samples (gitignored) for the
  // open-data assessments in docs/data-analysis/justice-sources-*.md — vendored
  // third-party bytes, never our code, so they are not linted.
  // `.claude/worktrees/**` holds live git worktrees (parallel agent sessions).
  // They are full checkouts of this same repo, so linting them double-reports
  // every file — and reports the DECLARED token exceptions (features/labs,
  // features/landing/palette.ts, lib/civic/data.ts) as errors, because the
  // path-scoped exemptions below no longer match under the nested prefix. The
  // worktree's own `npm run lint` covers that code; from here it is noise.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".justice-samples/**",
    ".claude/worktrees/**",
    // Census fixtures are a corpus of DELIBERATE violations — the self-test
    // hand-counts hits in them, so their defects are the point and must not be
    // "fixed". `hits.tsx` renders an undefined `ThemedSelect` on purpose; linting
    // it produced this repo's only lint error the moment the runner was ported.
    // Same category as the vendored tooling above: bytes we do not author as
    // product code. Exempts no source under app/, components/, features/ or lib/.
    "scripts/census/__fixtures__/**",
    // `.claude/skills/**` and `.claude/agents/**` are vendored agent tooling —
    // impeccable v4.0.3 ships ~90 `.mjs` files that are its code, not ours. They
    // are the same case as `.justice-samples/**`: third-party bytes we do not
    // author and cannot fix, and linting them buried this repo's own output
    // under 144 warnings the moment they were installed. This exempts nobody's
    // source code — no rule loses coverage of anything under `app/`,
    // `features/`, `lib/` or `scripts/`.
    ".claude/skills/**",
    ".claude/agents/**",
  ]),
  // The rule pack and its compat shims are CommonJS by contract (ESLint loads
  // them via createRequire) — `require()` IS their module system, so the
  // TS-style no-require-imports ban does not apply to them. Every other rule
  // still covers these files.
  {
    files: ["eslint-rules/**/*.cjs", "packages/eslint-plugin-civic-transparency/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      custom: civicTransparency,
    },
    rules: {
      "custom/no-silent-catch": "error",
      // typeImports: "forbid" since 2026-09-01 — every loader's prop types live in a sibling
      // pure *Types.ts module, so a "use client" file imports nothing from a loader, not even a type
      // (docs/architect/decisions/2026-07-26-server-only-boundary-enforcement.md).
      "custom/no-server-import-in-client": ["error", { typeImports: "forbid" }],
      "custom/role-button-requires-keydown": "error",
      "custom/enforce-reduced-motion-fallback": "error",
      "custom/no-hardcoded-colors": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  // Doctrine pack scoping (batch-2, item 2D — see eslint-rules/README.md):
  // provenance rules apply to reader-facing surfaces only; `lib/` is the
  // formatting chokepoint and legitimately calls toFixed. Both shipped at `warn`
  // while the existing-violation inventory burned down; `app/**` measured clean
  // for BOTH rules (2026-07-30 inventory: 29 warnings, all under features/**),
  // so app routes went to `error` immediately.
  //
  // RATCHET ADVANCED 2026-08-24. Re-measured repo-wide (`eslint --format json`):
  // 29 -> 11 warnings, and `no-raw-number-display` is now at ZERO everywhere.
  // A warning-only rule with an empty inventory protects nothing (`npm run lint`
  // has no --max-warnings, so eslint exits 0 at any warning count; the pre-commit
  // hook ran `eslint --quiet` until 2026-08-24, when lefthook.yml dropped the flag
  // after fault-injection showed it hid warnings without blocking anything), so
  // the measured-clean rule is promoted to `error` here — the burn-down is locked
  // in and cannot regress.
  // SECOND RATCHET CLOSED 2026-08-24. The note above named the exit — "fixing
  // those three files, not an exemption for them" — and that is what happened,
  // so `require-source-citation` joins `no-raw-number-display` at `error`:
  //   * LeaderboardPoster.tsx (9 of the 11) was never uncited. It builds a real
  //     citation with buildPosterCitation() and hands it to <PosterFrame>, which
  //     renders source, retrieval date, live URL and methodology on the sheet.
  //     The rule is FILE-scoped and could not see across that boundary. Fixed in
  //     the rule, not in the config: `<PosterFrame citation={…}>` now satisfies
  //     it, and the `citation` prop is required for the satisfaction — nine
  //     `citation-ok` annotations would have recorded the rule's blindness as
  //     nine exceptions and taught the next author that the poster lane is
  //     exempt.
  //   * FactRow.tsx and NodeSearch.tsx carry a `citation-ok:` reason each,
  //     which is what that construct is for: the fact row prints its source
  //     inline next to the amount, and a node's degree describes the rendered
  //     graph rather than making a claim the reader could go and check.
  // Re-measured repo-wide after those three: `eslint features app lib scripts
  // packages` = 0 errors, 2 warnings, and NEITHER is a provenance rule. A
  // warn-level rule with an empty inventory protects nothing here — `npm run
  // lint` sets no --max-warnings — so an empty inventory is the moment to
  // promote, or the burn-down silently reverses.
  //
  // THIRD DOCTRINE RULE, 2026-08-24: `no-source-note-size-override` joins them
  // at `error` on arrival, for the same reason and by the same evidence.
  // DESIGN.md §3 has forbidden `className="!text-[10px]"` on a <SourceNote> in
  // plain words since 2026-07-29 ("Two such overrides existed on the landing and
  // were removed. Do not add another."). On 2026-08-24 there were 72, across 29
  // files — 66 at 10 px, 6 at 11 px — removed in 776f01a. A cultural rule that
  // failed 72 times is not a rule.
  // Measured AFTER that sweep, repo-wide (`eslint --format json` over features
  // app lib scripts packages): 0 hits for the shape this rule matches, against a
  // live population of 404 <SourceNote> call sites in 107 files. Precision is
  // therefore stated on the negative side and on the fixture side: 8 live colour
  // overrides (`!text-ochre` ×6, `!text-cobalt`, `!${tone.text}`) and every
  // spacing/case/tracking override stay silent, because the matcher requires
  // positive evidence that a `text-*` token sets FONT-SIZE. Ships at `error`
  // rather than `warn` for the reason written twice above: no `--max-warnings`
  // exists here, so warn enforces nothing by construction.
  // ONE VIOLATION WAS OUT OF THE MATCHER'S REACH on arrival:
  // features/money/components/BasisDisclosure.tsx laundered `!text-[10px]`
  // through a prop default (`className = "mt-2 !text-[10px]"`) and passed it as
  // `className={className}`. That default was fixed the same day (it is `mt-2`
  // now; the file's own comment records the removal), so the matcher's intended
  // widening — resolving single-definition static initialisers — is no longer
  // blocked by a red-on-arrival site. The widening itself has NOT happened yet
  // (2026-09-05: the rule reads className ON the element only), so a new prop
  // default carrying a size override would still pass. Tracked in
  // docs/architect/backlog.md.
  // `components/**` JOINED 2026-09-08. The display-string rule below already
  // calls app + features + components "the reader-facing tree", and the tree is
  // real: app/poslanec/[id] mounts components/MpProfileBeacon.tsx, the shell and
  // the landing header mount components/LanguageSwitcher.tsx. Yet the three
  // provenance rules stopped at features/** and app/**, so a raw number or an
  // uncited figure in components/ passed lint. Measured before widening with a
  // synthetic components/__probe.tsx carrying a raw `{12345}`, no citation and a
  // `!text-[10px]` SourceNote: 0 reports under the old scope, 1 under this one
  // (the size override; the SourceNote itself satisfies the citation rule), and
  // the two real files report 0 - an empty inventory, promoted on arrival for
  // the reason written three times above.
  {
    files: ["features/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "custom/require-source-citation": "error",
      "custom/no-raw-number-display": "error",
      "custom/no-source-note-size-override": "error",
    },
  },
  // ── Catalog discipline for display copy (2026-08-24) ──────────────────────
  // `custom/no-hardcoded-display-string` at `error` on the reader-facing tree.
  // The catalog half of this repo is excellent — 2854/2854 cs/en keys, 0 missing
  // / 0 extra, enforced by 14+ colocated messages.test.ts suites — and until now
  // NOTHING stopped the next author typing Czech straight into markup and never
  // opening messages/cs.json. Extraction was held culturally, which is exactly
  // what cannot hold a line.
  //
  // Measured before the severity was chosen, with the shipped matcher over
  // app/**, features/** and components/**: 226 hits in THIRTEEN files, and every
  // one of those files is a declared zone below. Outside them the count is ZERO,
  // which is why this ships blocking rather than advisory — `npm run lint` sets
  // no --max-warnings, so `warn` would enforce nothing by construction, and an
  // empty inventory is precisely the moment to promote.
  //
  // Scoped to the reader-facing tree only. lib/**, scripts/** and packages/**
  // are not rendered to anyone and are deliberately out of scope, not exempt.
  {
    files: ["app/**/*.{ts,tsx}", "features/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "custom/no-hardcoded-display-string": "error",
    },
  },
  // The zones, each with what it does NOT exempt. Two of them are whole areas
  // sharing one audience; the other four are named FILES, deliberately — a
  // directory exemption would be inherited by the next file created beside
  // them, and these decisions belong to these surfaces, not to their folders.
  {
    // The internal operator console: one shared token, one operator, no user
    // accounts (app/admin/AdminGate.tsx). Its audience is the person running
    // the ingest pipeline, and it is Czech-only by construction — translating
    // a tripwire label serves nobody. Exempts nothing on any public route.
    files: ["app/admin/**/*.{ts,tsx}", "features/admin/**/*.{ts,tsx}"],
    rules: { "custom/no-hardcoded-display-string": "off" },
  },
  {
    // /penize/kontrola — the human review gate. Same audience as the admin
    // console (it is unlocked by REVIEWER_TOKEN, not by being a reader) and
    // Czech-first by its own header. Named as a file: the next component under
    // features/money/components/ is a reader surface and inherits nothing.
    files: ["features/money/components/VerificationConsole.tsx"],
    rules: { "custom/no-hardcoded-display-string": "off" },
  },
  {
    // The global error boundary renders OUTSIDE the providers — it cannot reach
    // next-intl at all, which is why its copy is hardcoded AND bilingual on
    // purpose (read the file's header). An architectural boundary, not a gap.
    files: ["app/global-error.tsx"],
    rules: { "custom/no-hardcoded-display-string": "off" },
  },
  {
    // Two surfaces holding a WRITTEN, dated counter-position: Czech copy inline,
    // catalog off-boundary for this surface (precedent /kompas, /denik,
    // WeightPanel). DependencyRadar's header records the incident that settled
    // it — an in-flight edit converted it to useTranslations against keys that
    // were never added to either catalog and rendered the whole section as
    // MISSING_MESSAGE in both locales (batch-015-audit.md N8). Exempting them
    // by FILE keeps the decision attached to the files that argued for it; a
    // new file under features/landing/referendum/ or features/lawwatch/
    // components/ is covered.
    files: [
      "features/landing/referendum/ReferendumPage.tsx",
      "features/lawwatch/components/DependencyRadar.tsx",
    ],
    rules: { "custom/no-hardcoded-display-string": "off" },
  },
  // features/labs is the archived fixed-art-direction zone (same rationale as
  // its no-hardcoded-colors exemption below) — not reader-facing product.
  {
    files: ["features/labs/**/*.{ts,tsx}"],
    rules: {
      "custom/require-source-citation": "off",
      "custom/no-raw-number-display": "off",
      // Same reason for display copy: an archived art direction is not product
      // anyone reads, so its Czech literals are not a catalog gap.
      "custom/no-hardcoded-display-string": "off",
    },
  },
  // Declared token-mirror + fixed-art-direction + data-color zones (rationale:
  // packages/eslint-plugin-civic-transparency/docs/rules/no-hardcoded-colors.md —
  // eslint-rules/no-hardcoded-colors.cjs is a one-line compat shim now).
  {
    files: ["features/landing/palette.ts", "features/labs/**/*.{ts,tsx}", "lib/civic/data.ts"],
    rules: {
      "custom/no-hardcoded-colors": "off",
    },
  },
  // Loader-boundary observability (/architect 2026-07-26): a loader's
  // `catch { return null }` silently degrades the surface to mock — require
  // reportLoaderFailure() so every degradation leaves a trace. Scoped to the
  // loader files.
  //
  // The `features/graph/**` exclusion is GONE (2026-08-13). It was written as a
  // temporary carve-out "until the in-flight round-4 rework lands", and the
  // round-4 work has since moved on without it — meanwhile the exclusion hid a
  // real class-2 site (`getNodeDetail`'s bare `catch { return null }`) and the
  // memoised null it sat next to, which pinned an empty `/graf` for the whole
  // process lifetime. Both are fixed in graphLoader.ts; no zone is exempt now.
  {
    files: ["features/**/get*.ts", "features/**/*Loader.ts"],
    rules: {
      "custom/no-silent-null-catch": "error",
    },
  },
  // Catalog boundary (personas pattern): features/shared is the domain-agnostic
  // primitive catalog. It must not import domain data or feature code — pass
  // data via props, or the component belongs to a feature.
  //
  // SCOPE WIDENED 2026-08-13 from `components/**` to all of `features/shared/**`.
  // The rule guarded ten small components while `poster/`, `provenance/` and
  // `forensic/` — 20 files, including `PosterFrame.tsx` (the canonical export
  // primitive), `ProvenanceCapsule.tsx` and `receipt.ts` — held the same
  // boundary by CONVENTION ALONE. Verified by probe before widening: two
  // synthetic files — `poster/__probe.tsx` importing `@/lib/civic/data` and
  // `forensic/__probe.tsx` importing `@/features/graph/stagePalette` — were
  // accepted by the old scope and are rejected by the new one, and the widening
  // is a NO-OP on today's code (repo-wide lint unchanged at 0 errors / 12
  // warnings) — which is exactly why now is the moment. The `!@/features/shared`
  // negation keeps shared→shared legal (SourceNote → ProvenanceCapsule).
  {
    files: ["features/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/civic/*", "**/lib/civic/*"],
              message:
                "features/shared is the domain-agnostic catalog — no domain-data imports. Pass data via props, or move the module to its owning feature.",
            },
            {
              group: ["@/features/*", "!@/features/shared"],
              message:
                "features/shared is the catalog — it must not import from a feature. Pass via props, or relocate the module.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
