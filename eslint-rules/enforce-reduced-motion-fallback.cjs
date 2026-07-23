/**
 * ESLint rule: enforce-reduced-motion-fallback (ported from personas)
 *
 * Flags framer-motion `animate=` props that drive a *repeating* animation
 * (`transition: { repeat: ... }`) in a file with no reduced-motion fallback.
 * Looping animations are the real vestibular hazard (WCAG 2.3.3) — one-shot
 * entry fades are fine.
 *
 * Satisfy by referencing `useReducedMotion()` in the file (trusted to gate
 * itself), or annotate a one-off with `// reduced-motion-ok: <reason>`.
 */

const FALLBACK_TOKENS = ["useReducedMotion", "prefersReducedMotion", "shouldAnimate"];

function isMotionElement(node) {
  const name = node.name;
  return (
    name &&
    name.type === "JSXMemberExpression" &&
    name.object.type === "JSXIdentifier" &&
    (name.object.name === "motion" || name.object.name === "m")
  );
}

function getProp(objExpr, key) {
  if (!objExpr || objExpr.type !== "ObjectExpression") return null;
  return (
    objExpr.properties.find(
      (p) =>
        p.type === "Property" &&
        !p.computed &&
        ((p.key.type === "Identifier" && p.key.name === key) ||
          (p.key.type === "Literal" && p.key.value === key)),
    ) || null
  );
}

function transitionRepeats(transitionObj) {
  const repeatProp = getProp(transitionObj, "repeat");
  if (!repeatProp) return false;
  const v = repeatProp.value;
  if (v.type === "Literal" && (v.value === 0 || v.value === false)) return false;
  return true;
}

function attrObject(attr) {
  if (
    attr &&
    attr.value &&
    attr.value.type === "JSXExpressionContainer" &&
    attr.value.expression.type === "ObjectExpression"
  ) {
    return attr.value.expression;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Require a reduced-motion fallback for looping framer-motion animations.",
    },
    messages: {
      missingFallback:
        "Looping `animate` (transition.repeat) has no reduced-motion fallback — it keeps cycling even when the user sets " +
        "prefers-reduced-motion. Gate it behind useReducedMotion(), or add `// reduced-motion-ok: <reason>`. See WCAG 2.3.3.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const fileText = sourceCode.getText();
    if (FALLBACK_TOKENS.some((tok) => fileText.includes(tok))) return {};

    function hasInlineOptOut(node) {
      const comments = sourceCode.getAllComments();
      const line = node.loc.start.line;
      return comments.some(
        (c) =>
          /reduced-motion-ok/.test(c.value) &&
          c.loc.start.line >= line - 1 &&
          c.loc.start.line <= node.loc.end.line,
      );
    }

    return {
      JSXOpeningElement(node) {
        if (!isMotionElement(node)) return;

        const attrs = node.attributes.filter((a) => a.type === "JSXAttribute");
        const animateAttr = attrs.find((a) => a.name.name === "animate");
        if (!animateAttr) return;

        let repeats = false;
        const transitionObj = attrObject(attrs.find((a) => a.name.name === "transition"));
        if (transitionObj && transitionRepeats(transitionObj)) repeats = true;

        if (!repeats) {
          const animateObj = attrObject(animateAttr);
          if (animateObj) {
            const nested = getProp(animateObj, "transition");
            if (nested && nested.value.type === "ObjectExpression" && transitionRepeats(nested.value)) {
              repeats = true;
            }
          }
        }

        if (!repeats) return;
        if (hasInlineOptOut(node)) return;

        context.report({ node: animateAttr, messageId: "missingFallback" });
      },
    };
  },
};
