/**
 * ESLint rule: no-silent-catch (ported from personas)
 *
 * Flags `catch` blocks with zero statements — they swallow errors entirely:
 * no log line, no trace of why the failure happened. A comment-only
 * justification is not enough; the next person debugging in production
 * needs the log line, not the comment.
 *
 * Minimum acceptable: `catch (err) { console.warn("[context]", err); }`.
 * Once an error-reporting layer exists (Sentry etc.), route through it.
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
    };
  },
};
