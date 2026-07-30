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

// JSX attributes whose value is never a CSS color even when it happens to be
// hex-shaped — a URL fragment identifier (href="#deadbeef"), a DOM id, a
// short git SHA used as a label (id="a3f5c9"). Flagging these produced a
// false positive with a misleading "colors originate in globals.css tokens"
// fix suggestion that actively doesn't apply.
const NON_COLOR_ATTRS = new Set([
  "href", "id", "to", "rel", "name", "key", "htmlFor", "target", "alt", "title",
  "placeholder", "download", "src", "action", "method", "role", "tabIndex",
  "type", "form", "for",
]);

/** True when `node` (a Literal or TemplateElement) is the value of a JSX
 * attribute whose name is known to never carry a CSS color. */
function isNonColorAttrValue(node) {
  let cur = node.parent;
  // Unwrap `attr={"literal"}` / `` attr={`template ${x}`} `` — a TemplateElement's
  // direct parent is its TemplateLiteral, and a JSXExpressionContainer sits
  // between the attribute and either wrapper for any non-bare-string JSX value.
  if (cur && cur.type === "TemplateLiteral") cur = cur.parent;
  if (cur && cur.type === "JSXExpressionContainer") cur = cur.parent;
  if (!cur || cur.type !== "JSXAttribute") return false;
  const attrName = cur.name && (cur.name.name || (cur.name.namespace && cur.name.namespace.name));
  if (typeof attrName !== "string") return false;
  return NON_COLOR_ATTRS.has(attrName) || attrName.startsWith("aria-") || attrName === "data-testid";
}

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
        if (typeof node.value === "string" && !isNonColorAttrValue(node)) check(node, node.value);
      },
      TemplateElement(node) {
        if (!isNonColorAttrValue(node)) check(node, node.value.raw);
      },
    };
  },
};
