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

/** The OUTERMOST function/component ancestor of `node` (not the innermost) —
 * groups a motion element nested inside a closure (a .map callback, a useEffect
 * body) under the SAME scope key as the top-level component function that
 * contains it, so a useReducedMotion() call at the top of the component still
 * counts as gating everything inside it. Two separate top-level components in
 * the same file get distinct keys, so one component's fallback no longer
 * exempts every other component's looping animation in the same file. `null`
 * means module scope (no enclosing function at all). */
function outermostFunctionAncestor(node) {
  let cur = node.parent;
  let found = null;
  while (cur) {
    if (
      cur.type === "FunctionDeclaration" ||
      cur.type === "FunctionExpression" ||
      cur.type === "ArrowFunctionExpression"
    ) {
      found = cur;
    }
    cur = cur.parent;
  }
  return found;
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

    // Real identifier references to a fallback token, keyed by their enclosing
    // component — NOT a raw file-wide substring match. A substring check
    // (fileText.includes("useReducedMotion")) matched inside an unrelated
    // identifier like `useReducedMotionValue` (a different framer API) or a
    // stray comment, exempting the whole file with no lint signal that
    // coverage was lost. Buffered during the walk and resolved once at
    // Program:exit since a fallback reference can appear anywhere in the
    // component relative to the motion element it gates.
    const fallbackScopes = new Set();
    const candidates = [];

    return {
      Identifier(node) {
        if (FALLBACK_TOKENS.includes(node.name)) {
          fallbackScopes.add(outermostFunctionAncestor(node));
        }
      },
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

        candidates.push({ animateAttr, scope: outermostFunctionAncestor(node) });
      },
      "Program:exit"() {
        for (const { animateAttr, scope } of candidates) {
          if (fallbackScopes.has(scope)) continue;
          context.report({ node: animateAttr, messageId: "missingFallback" });
        }
      },
    };
  },
};
