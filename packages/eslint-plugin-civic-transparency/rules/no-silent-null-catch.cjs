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
    /** True for `return null;` / `return [];` — the fallback-degradation shape. */
    function isNullyReturn(stmt) {
      if (stmt.type !== "ReturnStatement" || !stmt.argument) return false;
      const arg = stmt.argument;
      const isNull = arg.type === "Literal" && arg.value === null;
      const isEmptyArray = arg.type === "ArrayExpression" && arg.elements.length === 0;
      return isNull || isEmptyArray;
    }
    /** True for an expression-statement call to reportLoaderFailure(...). */
    function isReportLoaderFailureCall(stmt) {
      if (stmt.type !== "ExpressionStatement" || stmt.expression.type !== "CallExpression") return false;
      const callee = stmt.expression.callee;
      return callee.type === "Identifier" && callee.name === "reportLoaderFailure";
    }
    return {
      CatchClause(node) {
        const body = node.body && node.body.body;
        // Gating on body.length === 1 made this trivially bypassed by prepending
        // ANY statement (setLoading(false), a comment-adjacent no-op) before the
        // fallback return — the actual invariant is "no reportLoaderFailure call
        // anywhere in the block", not "the block is exactly one line". Scan every
        // statement instead of requiring a single-statement shape.
        if (!Array.isArray(body) || body.length === 0) return;
        const hasNullyReturn = body.some(isNullyReturn);
        if (!hasNullyReturn) return;
        const hasReportCall = body.some(isReportLoaderFailureCall);
        if (!hasReportCall) {
          context.report({ node: node.body, messageId: "silentNullCatch" });
        }
      },
    };
  },
};
