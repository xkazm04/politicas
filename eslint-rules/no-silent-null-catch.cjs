/**
 * ESLint rule: no-silent-null-catch (politicas /architect codification)
 *
 * Companion to no-silent-catch, for the server-loader boundary. That rule only
 * flags EMPTY catch blocks; the loaders' actual failure shape is
 * `catch { return null; }` (or `return []`), which passes it while still
 * swallowing every trace of the failure — the surface silently degrades to
 * mock/empty and a dead store becomes indistinguishable from an empty graph
 * (this class of bug cost a day of diagnosis on 2026-07-25; see
 * next.config.ts and docs/architect/decisions/2026-07-26-silent-degradation-observability.md).
 *
 * Fix: call `reportLoaderFailure("<loaderName>", err)` from
 * `@/lib/db/loaderGuard` before returning the fallback value.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag catch blocks whose only statement returns null/[] — a silent degradation with no failure trace.",
    },
    messages: {
      silentNullCatch:
        "Catch returns a fallback with no failure trace — the surface degrades silently. " +
        'Call reportLoaderFailure("<loaderName>", err) from @/lib/db/loaderGuard before the return.',
    },
    schema: [],
  },
  create(context) {
    return {
      CatchClause(node) {
        const body = node.body && node.body.body;
        if (!Array.isArray(body) || body.length !== 1) return;
        const stmt = body[0];
        if (stmt.type !== "ReturnStatement" || !stmt.argument) return;
        const arg = stmt.argument;
        const isNull = arg.type === "Literal" && arg.value === null;
        const isEmptyArray = arg.type === "ArrayExpression" && arg.elements.length === 0;
        if (isNull || isEmptyArray) {
          context.report({ node: node.body, messageId: "silentNullCatch" });
        }
      },
    };
  },
};
