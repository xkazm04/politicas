import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DASHBOARD_REVALIDATE_SECONDS } from "@/features/dashboard/freshness";

/* Next reads `export const revalidate` statically, so every route that declares the window
 * must spell it as a literal; features/dashboard/freshness.ts owns the value and the routes'
 * comments say "the same window as /dashboard". Six routes carry the literal today. This test
 * is what holds them to the constant - a seventh window, or one route drifting, fails here
 * instead of two surfaces over one graph ageing differently. Lives in lib/testing because the
 * routes span four contexts and the rule is the repo's. */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const declarations = walk("app")
  .map((p) => ({ file: p.replaceAll("\\", "/"), src: readFileSync(p, "utf8") }))
  .flatMap(({ file, src }) => {
    const m = /^export const revalidate = ([\d_]+);/m.exec(src);
    return m ? [{ file, seconds: Number(m[1].replaceAll("_", "")) }] : [];
  });

describe("every route's revalidate literal is the declared window", () => {
  it("looked at a real tree", () => {
    expect(declarations.length).toBeGreaterThanOrEqual(6);
    expect(declarations.map((d) => d.file)).toContain("app/penize/strety/page.tsx");
  });

  it.each(declarations.map((d) => [d.file, d.seconds] as const))("%s = DASHBOARD_REVALIDATE_SECONDS", (_file, seconds) => {
    expect(seconds).toBe(DASHBOARD_REVALIDATE_SECONDS);
  });
});
