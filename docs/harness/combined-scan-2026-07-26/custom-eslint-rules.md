# Custom ESLint Rules — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. `no-server-import-in-client` never inspects dynamic `import()` expressions
- **Lens**: Bug
- **Severity**: Critical
- **Category**: AST-matching gap (false negative)
- **File**: eslint-rules/no-server-import-in-client.cjs:32-52
- **Scenario**:
  ```tsx
  "use client";
  export function LazyPanel() {
    useEffect(() => {
      import("./getGoalData").then((m) => m.getGoalData().then(setData));
    }, []);
  }
  ```
  This pulls `getGoalData` (and transitively `getStore()`/PGlite WASM) into the client bundle exactly the way the rule exists to prevent, but it never fires.
- **Root cause**: The visitor only registers `ImportDeclaration`, i.e. static `import … from "…"` syntax. `import("...")` is parsed as an `ImportExpression` (a call-like node), which is a completely different AST node type and is never visited, so `SERVER_SOURCE.test(source)` is never even reached for dynamic imports.
- **Impact**: Anyone who code-splits a server loader behind `import()` — a common Next.js pattern for avoiding SSR-only deps in a client bundle, ironically — silently breaches the exact server/client boundary this rule was written to enforce, shipping DB/PGlite code to the browser with no lint signal.
- **Fix sketch**: Add an `ImportExpression(node)` visitor that extracts the source the same way when `node.source.type === "Literal"`, and run it through the same `SERVER_SOURCE` test (no `importKind`/type-only concept applies to dynamic import, so skip that check).

## 2. `no-silent-catch` only matches `try { } catch { }`, not `.catch(() => {})`
- **Lens**: Bug
- **Severity**: High
- **Category**: AST-matching gap (false negative)
- **File**: eslint-rules/no-silent-catch.cjs:31-42
- **Scenario**:
  ```ts
  fetchStandup().then(setStandup).catch(() => {});
  ```
  This is a textbook silent-catch — the rejection is discarded with zero trace — yet the rule reports nothing.
- **Root cause**: The rule's selector is `CatchClause`, which only exists for `try/catch` syntax. `Promise.prototype.catch(fn)` is a `CallExpression` whose callee is a `MemberExpression` named `catch`; it is a completely different part of the grammar that the rule's name ("no-silent-catch") strongly implies is in scope but the implementation never visits.
- **Impact**: Promise-chain error handling — arguably the more common async-error-swallowing idiom in a React/Next.js codebase using `.then()/.catch()` — is entirely unenforced. The invariant the rule exists for ("every caught error leaves a trace") has a large uncovered surface.
- **Fix sketch**: Add a `CallExpression` visitor that matches `callee.type === "MemberExpression" && callee.property.name === "catch"`, inspect the first argument if it's a function expression/arrow with an empty body, and report the same `emptyCatch` message.

## 3. `no-silent-null-catch` is defeated by adding any unrelated statement before the fallback return
- **Lens**: Bug
- **Severity**: High
- **Category**: AST-matching gap (false negative)
- **File**: eslint-rules/no-silent-null-catch.cjs:33-46
- **Scenario**:
  ```ts
  async function getGoalData() {
    try {
      return await db.query(...);
    } catch (err) {
      setLoading(false); // any statement at all, including a no-op
      return null;
    }
  }
  ```
  The catch still degrades silently to `null` with no call to `reportLoaderFailure`, but the rule does not fire because the block has two statements instead of one.
- **Root cause**: `if (!Array.isArray(body) || body.length !== 1) return;` hard-requires exactly one statement in the catch body before even looking at what that statement is. The check is structurally about shape ("single bare return") rather than about the actual invariant ("no `reportLoaderFailure` call before a fallback return"), so it is trivially bypassed by prepending literally anything.
- **Impact**: The exact production bug the rule's doc comment says cost a day of diagnosis (dead store indistinguishable from empty graph) can reappear in any catch block that happens to contain more than the single `return null;` line — which is likely the common case once a component also needs to reset loading/error state.
- **Fix sketch**: Instead of gating on `body.length === 1`, scan all statements in the catch body for a `ReturnStatement` with a null/empty-array argument, and separately check whether any statement anywhere in the block is a call to `reportLoaderFailure` (e.g. `CallExpression` whose callee name matches). Report only if the fallback return exists AND no such call exists.

## 4. `enforce-reduced-motion-fallback` exempts an entire file on a raw substring match of the fallback token, not per-component usage
- **Lens**: Bug
- **Severity**: Medium
- **Category**: Overly broad matching (false negative)
- **File**: eslint-rules/enforce-reduced-motion-fallback.cjs:73-75
- **Scenario**:
  ```tsx
  // Imported for an unrelated tooltip offset, not accessibility gating:
  import { useReducedMotionValue } from "./legacy-helpers"; // note: "…Value", a different framer API

  export function PulsingBadge() {
    return <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity }} />;
  }
  ```
  `fileText.includes("useReducedMotion")` matches the substring inside `useReducedMotionValue`, so `create()` returns `{}` immediately and the looping, un-gated `PulsingBadge` animation is never inspected.
- **Root cause**: The opt-out check is a raw string `.includes()` over the whole file's source text, done once before any node is visited (`return {}`). It is neither identifier-bound (matches inside unrelated identifiers/comments/string literals) nor scoped to the specific `motion` element being checked (one genuinely-gated animation elsewhere in the file exempts every other looping animation in the same file).
- **Impact**: A file with ten `motion` elements where only one is actually wired to `useReducedMotion()` gets a free pass for the other nine; a stray comment or an unrelated same-prefix identifier (`useReducedMotionValue`, `useReducedMotionConfig`) silently disables the rule for the whole file with no lint signal that coverage was lost.
- **Fix sketch**: Track fallback usage as a real identifier reference (`Identifier` node whose name is exactly one of `FALLBACK_TOKENS`, not a text substring), and prefer scoping the check to the enclosing function/component (find the nearest function declaration ancestor and search within it) rather than the entire file.

## 5. `no-hardcoded-colors` false-positives on any 6/8-hex-digit string that isn't a color (anchor IDs, commit SHAs, error codes)
- **Lens**: Bug
- **Severity**: Medium
- **Category**: Overly broad matching (false positive)
- **File**: eslint-rules/no-hardcoded-colors.cjs:14-40
- **Scenario**:
  ```tsx
  <a href="#deadbeef">Jump to section</a>
  const issueRef = "#a3f5c9"; // shorthand link text to a 6-char commit SHA
  ```
  `"#deadbeef"` is 8 hex digits and `"#a3f5c9"` is 6 hex digits, so both match `COLOR_RE`'s hex alternatives and get flagged as `hardcodedColor`, even though neither is a CSS color — one is a URL fragment identifier, the other a SHA-prefixed label.
- **Root cause**: `COLOR_RE` treats any string containing `#` followed by 3/4/6/8 hex characters as a color literal with no additional context check (no requirement that it appear in a `style`/className/color-ish prop, no CSS-value shape validation). Any non-color data that happens to be valid hex of the right length — anchor IDs, short git SHAs prefixed with `#` (issue/PR refs like `"#a3f5c9"`), hex error codes — trips the same messageId.
- **Impact**: Developers hit an incorrect lint error on legitimate code with no color content, and the fix instructions ("colors originate in app/globals.css tokens; use a token class") are actively misleading for a URL fragment or SHA, degrading trust in the rule and encouraging blanket `eslint-disable` usage that also suppresses genuine violations nearby.
- **Fix sketch**: Narrow matching to actual color-bearing contexts — require the literal to appear as the value of a `style` object property, a `className`/`cn(...)` Tailwind arbitrary-value segment, or a CSS-in-JS template — rather than pattern-matching arbitrary string literals project-wide; at minimum, require the hex run to not be immediately preceded by `#` used in a non-CSS attribute (e.g. skip `href`/`id`/`to` string literals).
