/**
 * ESLint rule: no-server-import-in-client (politicas /architect codification)
 *
 * In modules that begin with the `"use client"` directive, forbid VALUE imports
 * of server loader modules (`features/**\/get*.ts`, `*Loader.ts`) and of
 * `@/lib/db/*`. A value import would pull `getStore()` / PGlite WASM toward the
 * browser bundle; before this rule the boundary was enforced only by header
 * comments. `import type { X } from "./getXData"` is allowed — it erases at
 * compile time (though sibling `*Types.ts` modules are the preferred home;
 * see docs/architect/decisions/2026-07-26-server-only-boundary-enforcement.md).
 */

const SERVER_SOURCE = /(^|\/)(get[A-Z][A-Za-z]*|[a-zA-Z]+Loader)$|(^|\/)lib\/db(\/|$)/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Forbid value imports of server loader modules and @/lib/db/* inside "use client" files.',
    },
    messages: {
      serverImportInClient:
        'Client component imports server module "{{source}}" as a value — that drags getStore()/PGlite ' +
        "toward the browser bundle. Import only types (import type), or receive the data via props from the server page.",
    },
    schema: [],
  },
  create(context) {
    let isClientModule = false;
    return {
      Program(node) {
        const first = node.body[0];
        isClientModule =
          !!first &&
          first.type === "ExpressionStatement" &&
          first.expression.type === "Literal" &&
          first.expression.value === "use client";
      },
      ImportDeclaration(node) {
        if (!isClientModule) return;
        if (node.importKind === "type") return;
        // `import { type A, type B } from ...` — all-type specifier lists erase too.
        const specifiers = node.specifiers || [];
        if (specifiers.length > 0 && specifiers.every((s) => s.importKind === "type")) return;
        const source = String(node.source.value);
        if (SERVER_SOURCE.test(source)) {
          context.report({ node, messageId: "serverImportInClient", data: { source } });
        }
      },
      // `import("./getGoalData")` is a dynamic import — a completely different
      // AST node (ImportExpression, not ImportDeclaration) that the static-import
      // visitor above never sees. There is no type-only concept for a dynamic
      // import (it always pulls a real module at runtime), so no importKind check
      // applies here — every dynamic import of a server module is a real breach.
      ImportExpression(node) {
        if (!isClientModule) return;
        if (node.source.type !== "Literal" || typeof node.source.value !== "string") return;
        const source = node.source.value;
        if (SERVER_SOURCE.test(source)) {
          context.report({ node, messageId: "serverImportInClient", data: { source } });
        }
      },
    };
  },
};
