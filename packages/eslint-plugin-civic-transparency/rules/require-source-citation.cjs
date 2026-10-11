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
 *      (czech, czechInt, formatDecimal, formatInt, formatCzk, formatCompactCzk,
 *      formatByKind) or to `compactCzk` (features/money/moneyTypes), again in
 *      JSX child position. The list mirrors lib/format's string-returning
 *      exports; until 2026-09-08 it lagged two of them, so a compact money
 *      figure (the deník's amounts) was no trigger at all.
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
 *   - `<PosterFrame citation={…}>` — the print lane's provenance renderer.
 *     Added 2026-08-24 while graduating this rule to `error`. The poster
 *     subsystem is a DECLARED second provenance surface, not an ad-hoc
 *     override: features/shared/poster/citation.ts builds the citation object
 *     (source, retrieval date, live URL, methodology, provenance pass, and
 *     the stored-vs-declared formula mismatch) and PosterFrame renders those
 *     lines on the sheet. A sheet that carries one is cited; the rule simply
 *     could not see it across the file boundary, and nine `citation-ok`
 *     annotations on one file would have recorded that blindness as nine
 *     exceptions. The `citation` attribute is REQUIRED for the satisfaction —
 *     same precision-over-recall doctrine as the triggers: the element name
 *     alone is not evidence, the prop is.
 *   - a `data-undisclosed` JSX attribute — the explicit "bez zdroje" marker.
 *     Convention (documented here, not yet machine-enforced on old code): an
 *     element carrying `data-undisclosed` must render a visible "bez zdroje"
 *     badge so the missing source is disclosed to the READER, not just to lint.
 *   - a per-site annotation `// citation-ok: <reason>` on the flagged line or
 *     the line above (e.g. the citation renders inline as a plain string, or
 *     lives in the parent component one file up).
 *
 *   - the STRUCTURED form `// citation-ok(parent=<path>, key=<identifier>): <reason>`
 *     (added 2026-10-11). A bare `citation-ok` is a promise nobody re-checks;
 *     the structured form names the delegation and the rule VERIFIES it: the
 *     `parent` file (repo-root-relative or absolute; omit it for "this very
 *     file") must exist and mention `key` as a whole word OUTSIDE comments —
 *     so deleting the citation the annotation points at turns the figure red
 *     instead of leaving it silently exempt. The check is textual (the key
 *     appears in code), not semantic (it is rendered inside a SourceNote);
 *     it catches deletion and rename, which is how delegations actually rot.
 *     A bare `citation-ok:` keeps working unchanged.
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
  "formatCompactCzk",
  "formatByKind",
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

/** The one satisfier that needs positive evidence beyond its element name:
 *  the print lane's frame only proves provenance when it is actually handed a
 *  citation object to render. */
const CITATION_PROP_SATISFIER = "PosterFrame";

function hasCitationProp(openingElement) {
  return openingElement.attributes.some(
    (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "citation",
  );
}

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

const fs = require("node:fs");
const path = require("node:path");

/** `citation-ok(parent=a/b.tsx, key=someKey)` → { parent, key }; null when the
 *  comment is the bare form; { malformed: true } when parenthesised but unusable. */
function parseStructuredAnnotation(text) {
  const m = /citation-ok\(([^)]*)\)/.exec(text);
  if (!m) return null;
  const fields = {};
  for (const part of m[1].split(",")) {
    const eq = part.indexOf("=");
    if (eq > 0) fields[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  if (!fields.key || !/^[\w.$-]+$/.test(fields.key)) return { malformed: true };
  return { parent: fields.parent || null, key: fields.key };
}

/** Source text with comments removed — the key must live in CODE, or the
 *  annotation that names it would satisfy its own check. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(/\r?\n/)
    .filter((l) => !/^\s*\/\//.test(l))
    .join(" ");
}

function containsWord(text, key) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w$])${esc}($|[^\\w$])`).test(text);
}

/** Returns null when the delegation holds, else a human reason. */
function verifyDelegation(ann, ownText, cwd) {
  if (ann.malformed) return "the annotation needs key=<identifier> (and optionally parent=<path>)";
  let code;
  let where;
  if (!ann.parent) {
    code = ownText;
    where = "this file";
  } else {
    const abs = path.resolve(cwd, ann.parent);
    where = ann.parent;
    let raw;
    try {
      raw = fs.readFileSync(abs, "utf8");
    } catch {
      return `parent file ${ann.parent} does not exist or cannot be read`;
    }
    code = stripComments(raw);
  }
  return containsWord(code, ann.key) ? null : `key "${ann.key}" no longer appears in ${where}`;
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
        "`// citation-ok: <reason>` if the citation lives in the parent component " +
        "(prefer `// citation-ok(parent=<path>, key=<identifier>): <reason>` — the rule then verifies it).",
      brokenDelegation:
        "`citation-ok` names a delegated citation that no longer checks out: {{reason}}. " +
        "The figure is uncited until the citation is restored or the annotation is corrected.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();

    let hasChokepointImport = false;
    const importedFormatterNames = new Set();
    let fileSatisfied = false;
    const candidates = [];

    // The annotation counts when it ENDS on the flagged line or the line above,
    // not when it STARTS there. Matching on the start line silently rejected
    // every multi-line reason — which pushed authors toward one-line reasons
    // that say nothing, on the one construct whose entire value is the reason.
    // Returns null when no annotation applies, { ok: true } when one holds,
    // { reason } when only structured annotations apply and none verifies.
    function inlineOptOut(node) {
      const comments = sourceCode.getAllComments();
      const line = node.loc.start.line;
      const near = comments.filter(
        (c) =>
          /citation-ok/.test(c.value) &&
          c.loc.end.line >= line - 1 &&
          c.loc.start.line <= node.loc.end.line,
      );
      if (near.length === 0) return null;
      let reason = null;
      for (const c of near) {
        const ann = parseStructuredAnnotation(c.value);
        if (!ann) return { ok: true };
        const why = verifyDelegation(ann, ownCode(), context.cwd || process.cwd());
        if (!why) return { ok: true };
        reason = reason || why;
      }
      return { reason };
    }

    let ownCodeCache = null;
    function ownCode() {
      if (ownCodeCache === null) {
        const text = sourceCode.text;
        let out = "";
        let at = 0;
        for (const c of sourceCode.getAllComments()) {
          out += text.slice(at, c.range[0]) + " ";
          at = c.range[1];
        }
        ownCodeCache = out + text.slice(at);
      }
      return ownCodeCache;
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
        const optOut = inlineOptOut(node);
        if (optOut && optOut.ok) return;
        candidates.push({
          node,
          kind: isFigure,
          name: callee.type === "Identifier" ? callee.name : null,
          broken: optOut ? optOut.reason : null,
        });
      },
      JSXOpeningElement(node) {
        const name = jsxElementName(node);
        if (name && SATISFIER_ELEMENTS.has(name)) fileSatisfied = true;
        // <PosterFrame citation={…}> — the prop is the evidence, not the name.
        if (name === CITATION_PROP_SATISFIER && hasCitationProp(node)) fileSatisfied = true;
        if (name === "AnimatedScore") {
          const optOut = inlineOptOut(node);
          if (!(optOut && optOut.ok)) {
            candidates.push({ node, kind: "element", name, broken: optOut ? optOut.reason : null });
          }
        }
      },
      JSXAttribute(node) {
        if (node.name && node.name.type === "JSXIdentifier" && node.name.name === "data-undisclosed") {
          fileSatisfied = true;
        }
      },
      "Program:exit"() {
        if (fileSatisfied) return;
        for (const { node, kind, name, broken } of candidates) {
          if (kind === "member" && !hasChokepointImport) continue;
          if (kind === "named" && !importedFormatterNames.has(name)) continue;
          if (broken) context.report({ node, messageId: "brokenDelegation", data: { reason: broken } });
          else context.report({ node, messageId: "uncitedFigure" });
        }
      },
    };
  },
};
