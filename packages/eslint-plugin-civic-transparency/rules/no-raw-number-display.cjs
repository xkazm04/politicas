/**
 * ESLint rule: no-raw-number-display (politicas doctrine pack, batch-2 item 2D)
 *
 * Flags direct `.toFixed()` / `.toLocaleString()` / `.toLocaleDateString()` /
 * `.toLocaleTimeString()` calls. Formatting is decided ONCE in `lib/format.ts`
 * (deterministic, no Intl — server and client can ship different ICU versions,
 * so `toLocaleString` output can differ byte-for-byte and break hydration; see
 * the header of lib/format.ts). Components consume `useFormat()` /
 * `formattersFor()` (`f.dec`, `f.int`, `f.czk`, `f.date`) instead.
 *
 * Until now this was prose in docs/DESIGN.md §Typography; this rule makes it a
 * build gate. Scoped in eslint.config.mjs to `features/**` and `app/**` — the
 * `lib/` formatting chokepoint itself legitimately calls `toFixed`.
 *
 * Escape hatch for a deliberate exception (e.g. an internal admin console that
 * never server-renders): annotate the line (or the line above) with
 * `// raw-format-ok: <reason>`.
 */

const RAW_FORMATTERS = new Set([
  "toFixed",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow raw number/date formatting (.toFixed, .toLocaleString*) outside the lib/format chokepoint.",
    },
    messages: {
      rawFormat:
        "Raw `.{{method}}()` in a feature surface — formatting is decided once in lib/format.ts " +
        "(deterministic, hydration-safe; no Intl drift). Use useFormat()/formattersFor() " +
        "(f.dec, f.int, f.czk, f.date), or annotate a deliberate exception with `// raw-format-ok: <reason>`.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();

    function hasInlineOptOut(node) {
      const comments = sourceCode.getAllComments();
      const line = node.loc.start.line;
      return comments.some(
        (c) =>
          /raw-format-ok/.test(c.value) &&
          c.loc.start.line >= line - 1 &&
          c.loc.start.line <= node.loc.end.line,
      );
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.computed ||
          callee.property.type !== "Identifier" ||
          !RAW_FORMATTERS.has(callee.property.name)
        ) {
          return;
        }
        if (hasInlineOptOut(node)) return;
        context.report({
          node: callee.property,
          messageId: "rawFormat",
          data: { method: callee.property.name },
        });
      },
    };
  },
};
