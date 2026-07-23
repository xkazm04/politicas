/**
 * ESLint rule: no-hardcoded-colors (politicas-specific)
 *
 * Flags literal colors (hex, rgb()/rgba(), hsl()/hsla()) in TS/TSX source.
 * Colors originate in app/globals.css design tokens; components consume
 * Tailwind classes (bg-paper, text-ink, fill-signal, …).
 *
 * The allowed exceptions are enforced by scoping in eslint.config.mjs, not
 * here: features/landing/palette.ts (recharts chrome mirror),
 * features/labs/** (archived fixed art directions), lib/civic/data.ts
 * (party colors are data). Everywhere else a literal color is UI drift.
 */

const COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\(|\bhsla?\(/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow literal colors outside the token layer (globals.css) and its declared mirrors.",
    },
    messages: {
      hardcodedColor:
        "Literal color '{{value}}' — colors originate in app/globals.css tokens; use a token class (bg-paper, text-ink, fill-signal, …). " +
        "Chart chrome belongs in features/landing/palette.ts; data-driven colors belong in lib/civic/data.ts.",
    },
    schema: [],
  },
  create(context) {
    function check(node, raw) {
      const match = raw.match(COLOR_RE);
      if (match) {
        context.report({
          node,
          messageId: "hardcodedColor",
          data: { value: match[0] },
        });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};
