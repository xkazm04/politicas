/**
 * ESLint rule: no-hardcoded-display-string (politicas doctrine pack)
 *
 * The catalog is only an authority if display strings actually pass through
 * it. This repo's catalog half is excellent — 2854/2854 cs/en keys, 0 missing
 * / 0 extra, enforced by 14+ colocated `features/*​/messages.test.ts` suites —
 * and until now NOTHING stopped the next author from typing Czech straight
 * into markup and never opening `messages/cs.json` at all. Extraction was held
 * culturally, which is the exact failure mode that cannot hold a line.
 *
 * ── The population, read BEFORE the pattern was written ──────────────────
 * Measured 2026-08-24 over 220 `.tsx` files under `app/`, `features/` and
 * `components/`, with an independent TypeScript-compiler scanner (deliberately
 * not this rule, so the two mechanisms can be cross-checked):
 *
 *   856  JSX text nodes            421  string literals in JSX child position
 *    30  literals in consumed attributes    63  `label:`-shaped const entries
 *
 * Reading them is what produced the threshold below. A naive "JSX text that
 * contains a letter" matcher returns 484 hits, and the tail of that list is
 * ENTIRELY technical: 95× `·`, route breadcrumbs (`/ penize / firma`), brand
 * (`Politicas`), and domain tokens (`IČO` ×7, `Sb.` ×9, `č.` ×8, `psp.cz`,
 * `RSS`, `JSON`, `e-Sbírka`, `manifest.json`, `co_votes_with`, `fnv-1a/32`).
 * Not one of those 86 tail hits is a display-copy gap.
 *
 * ── The threshold, and why it is exactly three ───────────────────────────
 * A candidate is flagged only when it carries **three or more whitespace-
 * separated tokens containing a letter**. Measured against the live tree:
 *
 *   ≥1 word  → 484 hits,  86 false positives outside the declared zones
 *   ≥2 words → 287 hits,   9 false positives (all route breadcrumbs)
 *   ≥3 words → 227 hits,   1 false positive  ← and that one is fixed below
 *   ≥4 words → 158 hits,   0                 (loses 69 true positives)
 *
 * The single false positive at ≥3 was a `<style>{`@media print {…}`}</style>`
 * block (features/money/EvidencePacketPage.tsx:47) — CSS, not copy — so
 * `<style>` and `<script>` children are excluded by element name and the
 * measured precision of the shipped matcher is **226/226 = 100 %**, with every
 * remaining hit hand-checked. Recall is knowingly traded for that: one- and
 * two-word display strings ("Uložit", "Zrušit") are NOT caught, and neither is
 * any string built at runtime, fetched, or laundered through a variable. The
 * detector is a floor, not the test — the end-to-end check is a pseudo-locale
 * sweep, and every unmarked string on screen is a gap whatever lint said.
 *
 * ── What it flags ────────────────────────────────────────────────────────
 *   1. JSX text nodes (not inside <style>/<script>).
 *   2. String literals rendered as JSX CHILDREN through an expression
 *      container — `{"text"}`, `{cond ? "Ano, …" : "Ne, …"}`, `{a || "…"}`.
 *      This is the obvious launder of trigger 1 and the scan found 27 live
 *      instances of it, so it is not hypothetical.
 *   3. String literals in the attributes users actually consume:
 *      placeholder, title, alt, aria-label, aria-description, aria-placeholder,
 *      aria-roledescription, aria-valuetext, and this repo's own `label` prop
 *      convention.
 *
 * ── What it deliberately does NOT flag: constant tables ──────────────────
 * The governing technique names display strings smuggled into constant tables
 * (`{ id: 'active', label: 'Active' }`) as a target. It was measured here and
 * REFUSED, with the numbers on the table. A `label:`/`text:`/`name:`/`title:`/
 * `description:` key heuristic returns 63 assignments in this tree, of which
 * 9 are CSS class names (`text: "text-cobalt"`), 6 are font families
 * (`name: "Archivo"`), and the rest are paper sizes (`"A4"`), source brands
 * (`"ARES VR"`) and domains (`"psp.cz"`). Applying the three-word threshold
 * to them leaves **zero hits outside the declared zones below** — i.e. the
 * defect class does not exist here, while the key heuristic is demonstrably
 * polluted. A rule with no live population and a noisy anchor is a gate that
 * can only ever cost trust, so it is not shipped. Re-open this if a constant
 * table with real copy ever lands; the scanner that measured it is trivial to
 * rerun.
 *
 * ── Escape hatch ─────────────────────────────────────────────────────────
 * `// i18n-ok: <reason>` on the flagged line or the line above, in the house
 * style of `// citation-ok:` and `// raw-format-ok:`. Use it for the shapes
 * the threshold cannot judge — a three-segment route breadcrumb, a technical
 * identifier that happens to contain spaces. A bare `eslint-disable` is not an
 * audit trail; the reason is the point.
 *
 * Zone exemptions are declared in eslint.config.mjs, never inline, and each
 * one states what it does NOT exempt — every exemption is a hole the next
 * hardcoded string will claim to fit.
 */

const CONSUMED_ATTRS = new Set([
  "placeholder",
  "title",
  "alt",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  // The repo's own prop convention: features/shared primitives take `label`
  // for the visible caption (LoopProgressGrid, ReviewHubSection, PosterToolbar).
  "label",
]);

/** Children of these are never human copy. The measured case: a print
 *  stylesheet rendered as `<style>{`@media print {…}`}</style>`. */
const NON_TEXT_ELEMENTS = new Set(["style", "script"]);

/** Three, because two produced nine route-breadcrumb false positives and one
 *  produced eighty-six. See the header for the full calibration table. */
const MIN_LETTER_WORDS = 3;

function letterWordCount(raw) {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length === 0) return 0;
  let n = 0;
  for (const token of text.split(" ")) {
    if (/\p{L}/u.test(token)) n += 1;
  }
  return n;
}

function isProse(raw) {
  return letterWordCount(raw) >= MIN_LETTER_WORDS;
}

function jsxElementName(node) {
  if (node.type !== "JSXElement") return null;
  const name = node.openingElement.name;
  return name && name.type === "JSXIdentifier" ? name.name : null;
}

/** A literal string carried by `expr`, following the branches an author uses
 *  to pick between two pieces of copy. Returns every literal found. */
function literalStrings(expr, out) {
  if (expr == null) return out;
  if (expr.type === "Literal") {
    if (typeof expr.value === "string") out.push({ node: expr, text: expr.value });
    return out;
  }
  if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) {
    out.push({ node: expr, text: expr.quasis[0].value.cooked ?? "" });
    return out;
  }
  if (expr.type === "ConditionalExpression") {
    literalStrings(expr.consequent, out);
    literalStrings(expr.alternate, out);
    return out;
  }
  if (expr.type === "LogicalExpression") {
    literalStrings(expr.left, out);
    literalStrings(expr.right, out);
    return out;
  }
  return out;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hardcoded human-language display text in JSX — copy goes through the message catalog.",
    },
    messages: {
      hardcodedText:
        "Hardcoded display text in markup: {{sample}} — copy goes through the catalog " +
        "(messages/cs.json + messages/en.json, parity-gated). Add a key and render it with " +
        "useTranslations()/getTranslations(), or annotate `// i18n-ok: <reason>` if this is a " +
        "technical token rather than copy.",
      hardcodedAttr:
        "Hardcoded display text in `{{attr}}`: {{sample}} — this attribute is read by users and " +
        "screen readers, so it goes through the catalog like any other copy. Add a key and render " +
        "it with useTranslations()/getTranslations(), or annotate `// i18n-ok: <reason>`.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();

    // The annotation counts when it ENDS on the flagged line or the line above
    // — same fix as require-source-citation, so a multi-line reason works and
    // authors are not pushed toward one-liners that say nothing.
    function hasInlineOptOut(node) {
      const line = node.loc.start.line;
      return sourceCode
        .getAllComments()
        .some(
          (c) =>
            /i18n-ok/.test(c.value) &&
            c.loc.end.line >= line - 1 &&
            c.loc.start.line <= node.loc.end.line,
        );
    }

    function sample(text) {
      const flat = text.replace(/\s+/g, " ").trim();
      return JSON.stringify(flat.length > 60 ? `${flat.slice(0, 57)}…` : flat);
    }

    function reportText(node, text) {
      if (!isProse(text)) return;
      if (hasInlineOptOut(node)) return;
      context.report({ node, messageId: "hardcodedText", data: { sample: sample(text) } });
    }

    return {
      JSXText(node) {
        if (NON_TEXT_ELEMENTS.has(jsxElementName(node.parent))) return;
        reportText(node, node.value);
      },

      JSXExpressionContainer(node) {
        const parent = node.parent;
        if (parent == null || (parent.type !== "JSXElement" && parent.type !== "JSXFragment")) {
          return; // attribute values are handled by JSXAttribute below
        }
        if (NON_TEXT_ELEMENTS.has(jsxElementName(parent))) return;
        for (const { node: lit, text } of literalStrings(node.expression, [])) {
          reportText(lit, text);
        }
      },

      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" && node.name.type !== "JSXNamespacedName") return;
        const attr =
          node.name.type === "JSXIdentifier"
            ? node.name.name
            : `${node.name.namespace.name}:${node.name.name.name}`;
        if (!CONSUMED_ATTRS.has(attr)) return;
        const value = node.value;
        if (value == null) return;
        const exprs =
          value.type === "JSXExpressionContainer"
            ? literalStrings(value.expression, [])
            : value.type === "Literal" && typeof value.value === "string"
              ? [{ node: value, text: value.value }]
              : [];
        for (const { node: lit, text } of exprs) {
          if (!isProse(text)) continue;
          if (hasInlineOptOut(lit)) continue;
          context.report({
            node: lit,
            messageId: "hardcodedAttr",
            data: { attr, sample: sample(text) },
          });
        }
      },
    };
  },
};
