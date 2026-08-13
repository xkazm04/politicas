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
      "custom/no-server-import-in-client": "error",
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
  // formatting chokepoint and legitimately calls toFixed. Both ship at `warn`
  // while the existing-violation inventory burns down; `app/**` measured clean
  // for BOTH rules (2026-07-30 inventory: 29 warnings, all under features/**),
  // so app routes are already at `error`.
  {
    files: ["features/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "custom/require-source-citation": "warn",
      "custom/no-raw-number-display": "warn",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "custom/require-source-citation": "error",
      "custom/no-raw-number-display": "error",
    },
  },
  // features/labs is the archived fixed-art-direction zone (same rationale as
  // its no-hardcoded-colors exemption below) — not reader-facing product.
  {
    files: ["features/labs/**/*.{ts,tsx}"],
    rules: {
      "custom/require-source-citation": "off",
      "custom/no-raw-number-display": "off",
    },
  },
  // Declared token-mirror + fixed-art-direction + data-color zones (see
  // eslint-rules/no-hardcoded-colors.cjs for the rationale).
  {
    files: ["features/landing/palette.ts", "features/labs/**/*.{ts,tsx}", "lib/civic/data.ts"],
    rules: {
      "custom/no-hardcoded-colors": "off",
    },
  },
  // Loader-boundary observability (/architect 2026-07-26): a loader's
  // `catch { return null }` silently degrades the surface to mock — require
  // reportLoaderFailure() so every degradation leaves a trace. Scoped to the
  // loader files; features/graph is excluded until its in-flight round-4
  // rework lands (its 4 sites are queued in the ADR).
  {
    files: ["features/**/get*.ts", "features/**/*Loader.ts"],
    ignores: ["features/graph/**"],
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
