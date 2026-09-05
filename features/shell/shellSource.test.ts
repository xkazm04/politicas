import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the app chrome (scan-sweep 2026-09-07, shell-navigation). */

const src = (p: string) => readFileSync(p, "utf8");

describe("the shell draws its logo once", () => {
  it("BrandMark lives in sidebarParts; MobileNav imports it instead of copying the SVG", () => {
    const parts = src("features/shell/sidebarParts.tsx");
    expect(parts).toMatch(/export function BrandMark\(/);
    expect(parts.match(/viewBox="0 0 32 32"/g)?.length).toBe(1);
    const mobile = src("features/shell/MobileNav.tsx");
    expect(mobile).not.toMatch(/viewBox="0 0 32 32"/);
    expect(mobile).toMatch(/<BrandMark className=/);
  });
});
