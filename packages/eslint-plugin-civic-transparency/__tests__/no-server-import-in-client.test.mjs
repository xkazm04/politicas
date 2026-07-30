/**
 * RuleTester coverage for rules/no-server-import-in-client.cjs.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/no-server-import-in-client.test.mjs`
 *
 * Uses @typescript-eslint/parser (already present via the host repo's Next
 * lint stack) because the rule's allowance for `import type` requires
 * `importKind` on the AST, which espree does not produce.
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/no-server-import-in-client.cjs");
const tsParser = require("@typescript-eslint/parser");

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

tester.run("no-server-import-in-client", rule, {
  valid: [
    {
      name: "server module import in a non-client file",
      code: `import { getMoneyData } from "./getMoneyData";`,
    },
    {
      name: "type-only import declaration erases at compile time",
      code: `"use client";\nimport type { MoneyData } from "./getMoneyData";`,
    },
    {
      name: "all-type specifier list erases too",
      code: `"use client";\nimport { type MoneyData, type MoneyRow } from "./getMoneyData";`,
    },
    {
      name: "non-server import in a client file",
      code: `"use client";\nimport { motion } from "framer-motion";`,
    },
    {
      name: "lib/db mentioned mid-word does not match",
      code: `"use client";\nimport x from "@/lib/dbg/tools";`,
    },
    {
      name: "dynamic import of a non-server module",
      code: `"use client";\nasync function f() { await import("./chartTheme"); }`,
    },
  ],
  invalid: [
    {
      name: "value import of a get* loader in a client file",
      code: `"use client";\nimport { getMoneyData } from "./getMoneyData";`,
      errors: [{ messageId: "serverImportInClient" }],
    },
    {
      name: "value import of a *Loader module",
      code: `"use client";\nimport { load } from "@/features/graph/graphLoader";`,
      errors: [{ messageId: "serverImportInClient" }],
    },
    {
      name: "value import of @/lib/db/*",
      code: `"use client";\nimport { getStore } from "@/lib/db/pglite/store";`,
      errors: [{ messageId: "serverImportInClient" }],
    },
    {
      name: "mixed value+type specifiers still pull the module",
      code: `"use client";\nimport { getMoneyData, type MoneyData } from "./getMoneyData";`,
      errors: [{ messageId: "serverImportInClient" }],
    },
    {
      name: "dynamic import of a server loader is always a breach",
      code: `"use client";\nasync function f() { await import("./getMoneyData"); }`,
      errors: [{ messageId: "serverImportInClient" }],
    },
  ],
});

console.log("PASS no-server-import-in-client (RuleTester)");
