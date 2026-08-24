/**
 * ESLint rule: no-source-note-size-override (politicas doctrine pack)
 *
 * `docs/DESIGN.md` §3 ends with a rule in plain words:
 *
 *   > One consequence to respect: `className="!text-[10px]"` on a `SourceNote`
 *   > defeats the fix from the call site. Two such overrides existed on the
 *   > landing and were removed. **Do not add another.**
 *
 * On 2026-08-24 there were **72 of them, across 29 files** (66 at 10 px, 6 at
 * 11 px), removed in 776f01a. A cultural rule that failed 72 times is not a
 * rule; this is its gate.
 *
 * ── Why the primitive owns its own size ──────────────────────────────────
 * `SourceNote` MEASURES its own children (`textLength` vs `LABEL_MAX_CHARS`)
 * and picks label-vs-sentence typesetting, both at `text-xs` (12 px) in
 * `steel-aa`. That is not a style preference: the 2026-07-29 `/impeccable`
 * audit found the primitive carrying the brand rule — "every rendered number
 * carries its source" — set at 4,11:1 contrast, sometimes 10 px, in
 * letter-spaced verzálky on runs up to 115 characters. A citation that cannot
 * be read has not been made. Every call-site size override put the citations
 * back under the 11 px readability floor of DESIGN.md §5.
 *
 * ── What is flagged: FONT-SIZE utilities only ────────────────────────────
 * Tailwind's `text-*` namespace is overloaded — it carries colors
 * (`text-ochre`, `text-steel-aa`, `text-paper/90`) as well as font sizes.
 * Only the SIZE half is a violation, and the repo has 8 live colour overrides
 * on `SourceNote` (`!text-ochre` ×6, `!text-cobalt`, `!${tone.text}`) that are
 * deliberate and must not be flagged. So the matcher requires positive
 * evidence that a token sets FONT-SIZE:
 *
 *   - the named scale: `text-xs` … `text-9xl` (a closed list — no colour
 *     token in `app/globals.css` collides with it);
 *   - an arbitrary value whose contents PARSE AS A LENGTH: `text-[10px]`,
 *     `text-[0.625rem]`, `text-[length:var(--x)]`, `text-[clamp(…)]`.
 *     `text-[#c8102e]` and `text-[var(--color-ochre)]` are colours and stay
 *     silent.
 *   - the v4 CSS-variable shorthand with an explicit hint: `text-(length:--x)`.
 *
 * Variant prefixes (`sm:`, `hover:`, `data-[state=open]:`) are stripped before
 * matching, and so is the important marker in BOTH spellings — `!text-xs`
 * (v3, which is what this repo writes) and `text-xs!` (v4, the current
 * syntax). The rule does not care whether the override actually WINS the
 * cascade: without `!` a second font-size utility wins or loses by generated
 * stylesheet order, which is worse than losing — it is nondeterministic from
 * the call site, and a redundant `text-xs` is the seed the next author edits
 * into `text-[10px]`.
 *
 * ── The escape hatch is a MODE, not a size ───────────────────────────────
 * `SourceNote` already ships the hatch for when the measurement genuinely
 * lies: `as="label" | "sentence"` forces the typesetting mode without
 * touching the size. That is what the message names. There is deliberately no
 * `// size-ok:` annotation — DESIGN.md does not permit an exception, it
 * permits a MODE override, and inventing a second hatch here would reopen the
 * hole 72 call sites already walked through.
 *
 * ── Known recall gap (measured, recorded as a decision) ──────────────────
 * The matcher reads STATIC class text only: a string literal, or the static
 * quasis of a template literal. A class string laundered through a variable
 * or a prop default is invisible to it. That is not hypothetical — as of
 * 2026-08-24 exactly one such site survives 776f01a's sweep:
 *
 *   features/money/components/BasisDisclosure.tsx:61
 *     className = "mt-2 !text-[10px]",   // default param, then <SourceNote className={className}>
 *
 * Scope-resolving that identifier is implementable (single-definition static
 * initialisers), and it is the intended widening — deliberately NOT taken in
 * the same change that introduces the rule, because it would ship a rule that
 * is red on arrival against product source. Fix that one default, then widen.
 * Zones and matchers in this repo shrink and sharpen; they do not get
 * exemptions.
 */

const PRIMITIVE = "SourceNote";

/** Tailwind's named font-size scale. A closed list on purpose: it is the only
 *  way to tell `text-xs` (size) from `text-ochre` (colour) without a theme
 *  lookup, and every entry was checked against `app/globals.css`'s `@theme`
 *  colour tokens for collisions (there are none). */
const NAMED_SIZES = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);

/** A CSS length or percentage — the positive evidence that an arbitrary
 *  `text-[…]` value is a FONT SIZE and not a colour. */
const LENGTH_RE =
  /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|pt|pc|in|q|cm|mm|ex|ch|cap|ic|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|%)$/i;

/** Size-shaped functional values. `calc`/`clamp`/`min`/`max` in a `text-[…]`
 *  slot are font sizes in every real use; a colour would be `rgb(`/`oklch(`/
 *  `color-mix(`, none of which appear here. */
const SIZE_FN_RE = /^(?:calc|clamp|min|max)\(/i;

/** Cut every variant prefix off a class token. Bracket-aware, so
 *  `data-[state=open]:text-xs` loses only the variant and
 *  `text-[calc(1rem/2)]` keeps its colon-free arbitrary value intact. */
function stripVariants(token) {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i];
    if (ch === "[" || ch === "(") depth += 1;
    else if (ch === "]" || ch === ")") depth -= 1;
    else if (ch === ":" && depth === 0) cut = i;
  }
  return cut === -1 ? token : token.slice(cut + 1);
}

/** Strip the important marker in both spellings: `!text-xs` (Tailwind v3, the
 *  spelling this repo writes) and `text-xs!` (Tailwind v4, current). */
function stripImportant(token) {
  let t = token;
  if (t.startsWith("!")) t = t.slice(1);
  if (t.endsWith("!")) t = t.slice(0, -1);
  return t;
}

/** Drop a trailing line-height modifier (`text-[10px]/[1.2]`, `text-sm/6`)
 *  once the utility body has been isolated. Bracket-aware for the same reason
 *  stripVariants is. */
function stripLineHeight(token) {
  let depth = 0;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i];
    if (ch === "[" || ch === "(") depth += 1;
    else if (ch === "]" || ch === ")") depth -= 1;
    else if (ch === "/" && depth === 0) return token.slice(0, i);
  }
  return token;
}

/** True when this class token sets font-size. Precision over recall: the
 *  token must be a `text-` utility AND carry positive size evidence. */
function isFontSizeUtility(rawToken) {
  const token = stripLineHeight(stripImportant(stripVariants(rawToken)));
  if (!token.startsWith("text-")) return false;
  const value = token.slice("text-".length);
  if (value.length === 0) return false;

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (/^length:/i.test(inner)) return true;
    if (SIZE_FN_RE.test(inner)) return true;
    return LENGTH_RE.test(inner);
  }
  if (value.startsWith("(") && value.endsWith(")")) {
    // v4 CSS-variable shorthand: only the explicitly hinted form is a size.
    return /^\(length:/i.test(value);
  }
  return NAMED_SIZES.has(value);
}

/** Every offending token in a static class string. */
function offendingTokens(text) {
  return text.split(/\s+/).filter((t) => t.length > 0 && isFontSizeUtility(t));
}

/** Static class text carried by a className attribute value, or null when the
 *  value is an expression this rule cannot read (see the recall gap above).
 *  A template literal contributes its QUASIS only — `` `!${tone.text}` ``
 *  yields the empty static text and is correctly silent. */
function staticClassText(value) {
  if (value == null) return null;
  if (value.type === "Literal") {
    return typeof value.value === "string" ? value.value : null;
  }
  if (value.type === "JSXExpressionContainer") {
    const expr = value.expression;
    if (expr.type === "Literal") {
      return typeof expr.value === "string" ? expr.value : null;
    }
    if (expr.type === "TemplateLiteral") {
      return expr.quasis.map((q) => q.value.cooked ?? "").join(" ");
    }
    return null;
  }
  return null;
}

function elementName(openingElement) {
  const name = openingElement.name;
  return name && name.type === "JSXIdentifier" ? name.name : null;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow font-size utilities in a <SourceNote> className — the citation primitive sets its own size by measuring its children.",
    },
    messages: {
      sizeOverride:
        "`{{token}}` in a <SourceNote> className overrides the size the primitive sets for itself " +
        "(docs/DESIGN.md §3). SourceNote measures its children and typesets label-vs-sentence, both at " +
        "text-xs (12 px) in steel-aa — the 2026-07-29 /impeccable fix for citations rendered under the " +
        "readability floor. If the measurement genuinely lies, force the mode with `as=\"label\"` or " +
        "`as=\"sentence\"`; the size is not the call site's to set.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (elementName(node) !== PRIMITIVE) return;
        for (const attr of node.attributes) {
          if (
            attr.type !== "JSXAttribute" ||
            attr.name.type !== "JSXIdentifier" ||
            attr.name.name !== "className"
          ) {
            continue;
          }
          const text = staticClassText(attr.value);
          if (text == null) continue;
          for (const token of offendingTokens(text)) {
            context.report({
              node: attr,
              messageId: "sizeOverride",
              data: { token },
            });
          }
        }
      },
    };
  },
};
