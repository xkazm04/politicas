import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractJsonBlock, parseJsonBlock } from "./jsonBlock";

/* Three verdict contracts (kg-verdict.ts, law-verdict.ts, verdict.ts) each carried a
 * byte-identical `extractJsonBlock` and the same parse-then-validate prologue. One rule
 * — „first ```json fence whose body opens with `{`, else the outermost braces" — with
 * three copies is a rule that drifts (2026-09-06, scan-sweep, parity-auditor). */

describe("parseJsonBlock — the one prologue of every verdict parser (2026-09-06)", () => {
  it("prefers a fenced block whose body is an object", () => {
    expect(extractJsonBlock("text ```json\n{\"a\":1}\n``` tail {x}")).toBe('{"a":1}');
    expect(parseJsonBlock("```json\n{\"a\":1}\n```")).toEqual({ parsed: { a: 1 }, error: null });
  });

  it("falls back to the outermost braces; no braces is a named miss, not an exception", () => {
    expect(extractJsonBlock("prose {\"a\":{\"b\":2}} more")).toBe('{"a":{"b":2}}');
    expect(parseJsonBlock("no json here")).toEqual({ parsed: null, error: "no JSON block found in subagent output" });
  });

  it("a malformed block is a named parse error", () => {
    const r = parseJsonBlock("{not json}");
    expect(r.parsed).toBeNull();
    expect(r.error).toMatch(/^JSON parse error: /);
  });
});

describe("the extractor is defined once (2026-09-06, parity-auditor)", () => {
  it("only jsonBlock.ts defines extractJsonBlock; the contracts re-export it", () => {
    const files = globSync("lib/analysis/*.ts")
      .map((f) => f.replaceAll("\\", "/"))
      .filter((f) => !f.endsWith(".test.ts"));
    const definers = files.filter((f) => /export function extractJsonBlock\(/.test(readFileSync(f, "utf8")));
    expect(definers).toEqual(["lib/analysis/jsonBlock.ts"]);
    for (const f of ["lib/analysis/kg-verdict.ts", "lib/analysis/law-verdict.ts", "lib/analysis/verdict.ts"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/parseJsonBlock\(/);
    }
  });
});
