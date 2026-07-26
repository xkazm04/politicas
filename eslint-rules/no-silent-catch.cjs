/**
 * ESLint rule: no-silent-catch (ported from personas)
 *
 * Flags `catch` blocks with zero statements — they swallow errors entirely:
 * no log line, no trace of why the failure happened. A comment-only
 * justification is not enough; the next person debugging in production
 * needs the log line, not the comment.
 *
 * Minimum acceptable: `catch (err) { console.warn("[context]", err); }`.
 * The error-reporting layer now exists: prefer routing caught errors through
 * `Sentry.captureException(err)` from `@sentry/nextjs` over a bare log. It is a
 * silent no-op when NEXT_PUBLIC_SENTRY_DSN is unset (see instrumentation-client.ts
 * and sentry.server.config.ts), so it is always safe to call.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Flag empty catch blocks that swallow errors.",
    },
    messages: {
      emptyCatch:
        "Empty catch block swallows the error. At minimum `console.warn(\"[context]\", err)` so the failure leaves a trace; " +
        "a comment-only justification is not enough. If genuinely uninteresting, disable this line and say why.",
    },
    schema: [],
  },
  create(context) {
    return {
      CatchClause(node) {
        if (
          node.body &&
          node.body.type === "BlockStatement" &&
          Array.isArray(node.body.body) &&
          node.body.body.length === 0
        ) {
          context.report({ node: node.body, messageId: "emptyCatch" });
        }
      },
      // `promise.catch(() => {})` is the promise-chain equivalent of an empty
      // try/catch — a CallExpression, not a CatchClause, so the visitor above
      // never sees it even though it's arguably the more common
      // error-swallowing idiom in a .then()/.catch() codebase.
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.computed ||
          callee.property.type !== "Identifier" ||
          callee.property.name !== "catch"
        ) {
          return;
        }
        const handler = node.arguments[0];
        if (
          handler &&
          (handler.type === "ArrowFunctionExpression" || handler.type === "FunctionExpression") &&
          handler.body.type === "BlockStatement" &&
          handler.body.body.length === 0
        ) {
          context.report({ node: handler.body, messageId: "emptyCatch" });
        }
      },
    };
  },
};
