import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Custom rules ported/adapted from the personas repo — see docs/DESIGN.md §Lint.
const noSilentCatch = require("./eslint-rules/no-silent-catch.cjs");
const noSilentNullCatch = require("./eslint-rules/no-silent-null-catch.cjs");
const noServerImportInClient = require("./eslint-rules/no-server-import-in-client.cjs");
const roleButtonRequiresKeydown = require("./eslint-rules/role-button-requires-keydown.cjs");
const enforceReducedMotionFallback = require("./eslint-rules/enforce-reduced-motion-fallback.cjs");
const noHardcodedColors = require("./eslint-rules/no-hardcoded-colors.cjs");

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
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      custom: {
        rules: {
          "no-silent-catch": noSilentCatch,
          "no-silent-null-catch": noSilentNullCatch,
          "no-server-import-in-client": noServerImportInClient,
          "role-button-requires-keydown": roleButtonRequiresKeydown,
          "enforce-reduced-motion-fallback": enforceReducedMotionFallback,
          "no-hardcoded-colors": noHardcodedColors,
        },
      },
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
  // Catalog boundary (personas pattern): features/shared/components is the
  // domain-agnostic primitive catalog. It must not import domain data or
  // feature code — pass data via props, or the component belongs to a feature.
  {
    files: ["features/shared/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/civic/*", "**/lib/civic/*"],
              message:
                "features/shared/components is the domain-agnostic catalog — no domain-data imports. Pass data via props, or move the component to its owning feature.",
            },
            {
              group: ["@/features/*", "!@/features/shared"],
              message:
                "features/shared/components is the catalog — it must not import from a feature. Pass via props, or relocate the component.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
