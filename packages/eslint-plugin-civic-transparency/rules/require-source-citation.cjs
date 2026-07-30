/**
 * ESLint rule: require-source-citation (politicas doctrine pack, batch-2 item 2D)
 *
 * The brand rule — "every rendered number carries its source" (politicas.md §6,
 * docs/DESIGN.md provenance discipline) — becomes a lint gate: a file that
 * RENDERS the result of a numeric formatter in JSX must also carry a provenance
 * marker. Until now this was enforced only by review.
 *
 * ── What counts as a rendered figure (the triggers) ──────────────────────
 * Precision over recall — every trigger requires positive evidence that the
 * value is a formatted domain number rendered to the reader:
 *
 *   1. `X.dec(...)` / `X.int(...)` / `X.czk(...)` member calls in JSX child
 *      position, in a file that imports from the formatting chokepoint
 *      (lib/format / lib/i18n/useFormat). `X` is any identifier so bound
 *      bundles (`const f = useFormat()`, destructured renames) all match, but
 *      without the chokepoint import the file is not using house formatters
 *      and stays silent.
 *   2. Direct calls to formatter names IMPORTED from the chokepoint
 *      (czech, czechInt, formatDecimal, formatInt, formatCzk) or to
 *      `compactCzk` (features/money/moneyTypes), again in JSX child position.
 *   3. An `<AnimatedScore …/>` element — the canonical score display.
 *
 * Deliberately NOT triggers: date formatting (`f.date`, czechDate — dates are
 * context, not claims), formatter calls in JSX *attributes* (aria-label,
 * title — not rendered claims), raw numeric literals/expressions (no way to
 * distinguish a claim from an index or a column count statically).
 *
 * ── What satisfies the rule (the satisfiers, FILE-scoped) ────────────────
 * Any of these anywhere in the same file:
 *   - a provenance element: <SourceNote>, <SourceRef>, <DataUnavailable>,
 *     <LiveDataNotice>, <CitableNumber>, <ProvenanceCapsule>
 *   - a `data-undisclosed` JSX attribute — the explicit "bez zdroje" marker.
 *     Convention (documented here, not yet machine-enforced on old code): an
 *     element carrying `data-undisclosed` must render a visible "bez zdroje"
 *     badge so the missing source is disclosed to the READER, not just to lint.
 *   - a per-site annotation `// citation-ok: <reason>` on the flagged line or
 *     the line above (e.g. the citation renders inline as a plain string, or
 *     lives in the parent component one file up).
 *
 * File scope (not JSX-subtree scope) is deliberate: many surfaces render the
 * figure in a leaf element and the SourceNote as a sibling caption, and a
 * subtree walk would flag exactly those correct layouts. A file-level check
 * cannot see a citation living in a DIFFERENT file (parent component) — that
 * is what `// citation-ok:` is for. Severity is `warn` repo-wide until the
 * inventory is burned down (eslint.config.mjs).
 */

const NUMERIC_MEMBER_FORMATTERS = new Set(["dec", "int", "czk"]);
const NUMERIC_NAMED_FORMATTERS = new Set([
  "czech",
  "czechInt",
  "formatDecimal",
  "formatInt",
  "formatCzk",
  "compactCzk",
]);
const CHOKEPOINT_SOURCE = /(^|\/)lib\/(format|i18n\/useFormat)$|(^|\/)moneyTypes$/;
const SATISFIER_ELEMENTS = new Set([
  "SourceNote",
  "SourceRef",
  "DataUnavailable",
  "LiveDataNotice",
  "CitableNumber",
  "ProvenanceCapsule",
]);

/** True when `node` is rendered as JSX CHILD content — i.e. its nearest
 * JSXExpressionContainer ancestor sits directly inside an element/fragment,
 * not inside a JSXAttribute (aria-label={f.int(n)} is not a rendered claim). */
function isJsxChildExpression(node) {
  let cur = node.parent;
  while (cur) {
    if (cur.type === "JSXExpressionContainer") {
      const p = cur.parent;
      return p != null && (p.type === "JSXElement" || p.type === "JSXFragment");
    }
    if (cur.type === "JSXAttribute") return false;
    // Stop at statement/function boundaries — past these we are no longer an
    // expression that could be rendered.
    if (/Statement|Declaration$/.test(cur.type) && cur.type !== "ExpressionStatement") return false;
    if (
      cur.type === "FunctionDeclaration" ||
      cur.type === "FunctionExpression" ||
      cur.type === "ArrowFunctionExpression"
    ) {
      // A callback INSIDE JSX (e.g. {items.map(x => <li>{f.int(x)}</li>)}) is
      // handled because we walk from the call site upward and meet the inner
      // JSXExpressionContainer first; reaching a function boundary without
      // having met one means the call is not in rendered position.
      return false;
    }
    cur = cur.parent;
  }
  return false;
}

function jsxElementName(openingElement) {
  const name = openingElement.name;
  return name && name.type === "JSXIdentifier" ? name.name : null;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require a provenance marker (SourceNote family or data-undisclosed) in files that render formatted domain numbers.",
    },
    messages: {
      uncitedFigure:
        "Rendered figure without provenance in this file — every rendered number carries its source " +
        "(docs/DESIGN.md). Add a SourceNote/DataUnavailable in this file, mark the element " +
        "`data-undisclosed` (must render a visible „bez zdroje“ badge), or annotate " +
        "`// citation-ok: <reason>` if the citation lives in the parent component.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();

    let hasChokepointImport = false;
    const importedFormatterNames = new Set();
    let fileSatisfied = false;
    const candidates = [];

    function hasInlineOptOut(node) {
      const comments = sourceCode.getAllComments();
      const line = node.loc.start.line;
      return comments.some(
        (c) =>
          /citation-ok/.test(c.value) &&
          c.loc.start.line >= line - 1 &&
          c.loc.start.line <= node.loc.end.line,
      );
    }

    return {
      ImportDeclaration(node) {
        if (typeof node.source.value !== "string" || !CHOKEPOINT_SOURCE.test(node.source.value)) {
          return;
        }
        hasChokepointImport = true;
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported.type === "Identifier" &&
            NUMERIC_NAMED_FORMATTERS.has(spec.imported.name)
          ) {
            // Track the LOCAL name so renamed imports still match.
            importedFormatterNames.add(spec.local.name);
          }
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        let isFigure = false;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.object.type === "Identifier" &&
          callee.property.type === "Identifier" &&
          NUMERIC_MEMBER_FORMATTERS.has(callee.property.name)
        ) {
          // f.dec(...) — trust only files wired to the chokepoint (resolved at
          // Program:exit, since imports may be visited after in theory-free
          // orderings; in practice they come first, but buffering is cheap).
          isFigure = "member";
        } else if (callee.type === "Identifier") {
          isFigure = "named";
        }
        if (!isFigure) return;
        if (!isJsxChildExpression(node)) return;
        if (hasInlineOptOut(node)) return;
        candidates.push({ node, kind: isFigure, name: callee.type === "Identifier" ? callee.name : null });
      },
      JSXOpeningElement(node) {
        const name = jsxElementName(node);
        if (name && SATISFIER_ELEMENTS.has(name)) fileSatisfied = true;
        if (name === "AnimatedScore" && !hasInlineOptOut(node)) {
          candidates.push({ node, kind: "element", name });
        }
      },
      JSXAttribute(node) {
        if (node.name && node.name.type === "JSXIdentifier" && node.name.name === "data-undisclosed") {
          fileSatisfied = true;
        }
      },
      "Program:exit"() {
        if (fileSatisfied) return;
        for (const { node, kind, name } of candidates) {
          if (kind === "member" && !hasChokepointImport) continue;
          if (kind === "named" && !importedFormatterNames.has(name)) continue;
          context.report({ node, messageId: "uncitedFigure" });
        }
      },
    };
  },
};
