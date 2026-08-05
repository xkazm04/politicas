import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The vitest alias in vitest.config.ts rewrites EVERY `server-only` import,
 * suite-wide, to an empty stub (lib/testing/server-only-stub.ts) — necessary
 * for the handful of lib-hosted tests that deliberately cross the
 * client/server boundary to test a loader directly, but it also means a
 * genuine boundary violation (a client component accidentally importing a
 * module tagged `import "server-only"` as a VALUE, which would break
 * `next build` and could ship broken to production) runs clean through
 * `npm test` with zero signal. There is no equivalent of "client compilation
 * still throws" in the test environment.
 *
 * This is a lightweight static/dependency-graph check standing in for that
 * missing signal: for every "use client" file in the app, follow its
 * first-party (relative or `@/`-aliased) VALUE imports (type-only imports are
 * erased at compile time and are the sanctioned way a client component reads
 * a server loader's exported TYPES — see e.g. ProfilePage.tsx's
 * `import type { ... } from "./getProfileData"`) up to a bounded depth, and
 * fail if any transitively-imported module itself contains a real
 * `import "server-only"` statement.
 *
 * Refs: docs/harness/combined-scan-2026-07-26/test-utilities-loader-coverage.md finding #1
 */

const ROOT = path.resolve(__dirname, "..", "..");
const SCAN_DIRS = ["app", "features", "components", "lib"];
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const SERVER_ONLY_IMPORT_RE = /^\s*import\s+["']server-only["']\s*;?\s*$/m;
const MAX_DEPTH = 12;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (!existsSync(cur)) continue;
    for (const entry of readdirSync(cur)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const full = path.join(cur, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (EXTENSIONS.includes(path.extname(entry))) out.push(full);
    }
  }
  return out;
}

function isClientFile(source: string): boolean {
  const firstStatement = source.trimStart().slice(0, 20);
  return firstStatement.startsWith('"use client"') || firstStatement.startsWith("'use client'");
}

/** A `"use server"` Server Action file is ALSO a real compilation boundary,
 * just like `"use client"` on the other side: Next.js compiles the client's
 * reference to it into an RPC stub, never inlining the real implementation
 * (or its imports) into the client bundle. A client component legitimately
 * importing a server action — and that action legitimately importing
 * server-only utilities — is the sanctioned pattern, not a violation; the
 * traversal below must stop at this boundary rather than walking through it. */
function isServerActionFile(source: string): boolean {
  const firstStatement = source.trimStart().slice(0, 20);
  return firstStatement.startsWith('"use server"') || firstStatement.startsWith("'use server'");
}

/** Value-import specifiers only — a whole `import type {...} from "x"` is
 * skipped entirely, and a mixed `import { a, type B } from "x"` is still
 * followed (it has at least one real value specifier), matching how the
 * project's own no-server-import-in-client.cjs ESLint rule treats type-only
 * imports as erased/safe. */
function valueImportSpecifiers(sourceText: string, fileName: string): string[] {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const wholeImportIsTypeOnly = clause?.isTypeOnly === true;
      if (!wholeImportIsTypeOnly) specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) specifiers.push(arg.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specifiers;
}

/** Resolve an import specifier to an absolute first-party file path, or null
 * for a bare package specifier (node_modules) or an unresolved path. */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = path.join(ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null; // bare package specifier — not first-party, not this check's concern
  }
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const indexFile = path.join(base, `index${ext}`);
    if (existsSync(indexFile)) return indexFile;
  }
  return null;
}

function importsServerOnly(entryFile: string): string[] | null {
  const visited = new Set<string>();
  const stack: { file: string; chain: string[] }[] = [{ file: entryFile, chain: [entryFile] }];
  while (stack.length > 0) {
    const { file, chain } = stack.pop()!;
    if (visited.has(file) || chain.length > MAX_DEPTH) continue;
    visited.add(file);
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // A "use server" file (other than the entry point, which is always the
    // "use client" component itself) is a real compilation boundary — stop
    // here rather than checking its own imports or flagging its own
    // server-only usage, both of which are sanctioned on that side.
    if (file !== entryFile && isServerActionFile(source)) continue;
    if (SERVER_ONLY_IMPORT_RE.test(source)) return chain;
    for (const specifier of valueImportSpecifiers(source, file)) {
      const resolved = resolveSpecifier(specifier, file);
      if (resolved && !visited.has(resolved)) {
        stack.push({ file: resolved, chain: [...chain, resolved] });
      }
    }
  }
  return null;
}

describe("client/server boundary (static check, stands in for the aliased server-only)", () => {
  it("no \"use client\" file transitively VALUE-imports a server-only-tagged module", () => {
    const clientFiles = SCAN_DIRS.flatMap((d) => listSourceFiles(path.join(ROOT, d))).filter((f) => {
      try {
        return isClientFile(readFileSync(f, "utf8"));
      } catch {
        return false;
      }
    });
    expect(clientFiles.length).toBeGreaterThan(0); // sanity: the scan itself found files to check

    const violations: { client: string; chain: string[] }[] = [];
    for (const file of clientFiles) {
      const chain = importsServerOnly(file);
      if (chain) violations.push({ client: path.relative(ROOT, file), chain: chain.map((f) => path.relative(ROOT, f)) });
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.client}\n    -> ${v.chain.join("\n    -> ")}`)
        .join("\n");
      throw new Error(`"use client" file(s) transitively VALUE-import a server-only-tagged module:\n${report}`);
    }
    // Whole-repo transitive import scan: ~60s+ when the full suite runs in
    // parallel workers (observed 64s in pre-push). Needs its own headroom
    // beyond the global testTimeout.
  }, 180_000);
});
