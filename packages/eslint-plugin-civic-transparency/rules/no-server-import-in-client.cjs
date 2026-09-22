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
      typeImportInClient:
        'Client component imports types from server module "{{source}}". Move the shapes into a sibling pure ' +
        "*Types.ts module that both the loader and the client import (features/votetrack/themeTypes.ts is the canonical shape).",
    },
    schema: [
      {
        type: "object",
        properties: {
          typeImports: { enum: ["allow", "forbid"] },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    // `typeImports: "forbid"` also reports `import type` from a loader — a type-only
    // import still couples the client file to the server module, and the next
    // value specifier added to that line is a bundle breach that reads as "a type
    // moved". Default stays "allow" so the package presets keep their contract;
    // politicas sets "forbid" (docs/architect/decisions/2026-07-26-server-only-boundary-enforcement.md).
    const forbidTypeImports = (context.options[0] && context.options[0].typeImports) === "forbid";
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
        const specifiers = node.specifiers || [];
        // `import type {...}` and `import { type A, type B }` erase at compile time.
        const typeOnly =
          node.importKind === "type" ||
          (specifiers.length > 0 && specifiers.every((s) => s.importKind === "type"));
        const source = String(node.source.value);
        if (!SERVER_SOURCE.test(source)) return;
        if (!typeOnly) {
          context.report({ node, messageId: "serverImportInClient", data: { source } });
        } else if (forbidTypeImports) {
          context.report({ node, messageId: "typeImportInClient", data: { source } });
        }
      },
      // `export { getX } from "./getX"` and `export * from "./getX"` pull the
      // module exactly like an import — they are ExportNamedDeclaration /
      // ExportAllDeclaration nodes WITH a source, which the import visitor never
      // sees. Until 2026-09-05 a client barrel could re-export a loader with no
      // report. `export type { X } from` erases like `import type`.
      ExportNamedDeclaration(node) {
        if (!isClientModule || !node.source) return;
        const source = String(node.source.value);
        if (!SERVER_SOURCE.test(source)) return;
        const specifiers = node.specifiers || [];
        const typeOnly =
          node.exportKind === "type" ||
          (specifiers.length > 0 && specifiers.every((s) => s.exportKind === "type"));
        if (!typeOnly) {
          context.report({ node, messageId: "serverImportInClient", data: { source } });
        } else if (forbidTypeImports) {
          context.report({ node, messageId: "typeImportInClient", data: { source } });
        }
      },
      ExportAllDeclaration(node) {
        if (!isClientModule) return;
        const source = String(node.source.value);
        if (!SERVER_SOURCE.test(source)) return;
        if (node.exportKind === "type") {
          if (forbidTypeImports) context.report({ node, messageId: "typeImportInClient", data: { source } });
          return;
        }
        context.report({ node, messageId: "serverImportInClient", data: { source } });
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
