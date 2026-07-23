import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Custom rules ported/adapted from the personas repo — see docs/DESIGN.md §Lint.
const noSilentCatch = require("./eslint-rules/no-silent-catch.cjs");
const roleButtonRequiresKeydown = require("./eslint-rules/role-button-requires-keydown.cjs");
const enforceReducedMotionFallback = require("./eslint-rules/enforce-reduced-motion-fallback.cjs");
const noHardcodedColors = require("./eslint-rules/no-hardcoded-colors.cjs");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      custom: {
        rules: {
          "no-silent-catch": noSilentCatch,
          "role-button-requires-keydown": roleButtonRequiresKeydown,
          "enforce-reduced-motion-fallback": enforceReducedMotionFallback,
          "no-hardcoded-colors": noHardcodedColors,
        },
      },
    },
    rules: {
      "custom/no-silent-catch": "error",
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
