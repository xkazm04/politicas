import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the app shell's own files (scan-sweep 2026-09-08, app-shell). */

const src = (p: string) => readFileSync(p, "utf8");

describe("robots and the sitemap read the tree's one live-URL definition", () => {
  it("neither file spells host + x-forwarded-proto itself; both import lib/routing/liveUrl", () => {
    for (const p of ["app/robots.ts", "app/sitemap.ts"]) {
      const s = src(p);
      expect(s, p).not.toMatch(/x-forwarded-proto/);
      expect(s, p).toMatch(/from "@\/lib\/routing\/liveUrl"/);
    }
  });
});

describe("the error boundaries keep small red text and hover buttons above AA (globals.css: signal 4,10:1, signal-deep 5,31:1)", () => {
  it("app/error.tsx's 11 px kicker uses signal-deep like global-error's", () => {
    const s = src("app/error.tsx");
    expect(s).not.toMatch(/text-\[11px\][^"]*\btext-signal"/);
    expect(s).toMatch(/text-\[11px\][^"]*\btext-signal-deep\b/);
  });
  it("neither boundary's paper-text button hovers onto bare signal", () => {
    for (const p of ["app/error.tsx", "app/global-error.tsx"]) {
      const s = src(p);
      expect(s, p).not.toMatch(/hover:bg-signal\b(?!-deep)/);
      expect(s, p).toMatch(/text-paper[^"]*hover:bg-signal-deep|hover:bg-signal-deep[^"]*text-paper/);
    }
  });
});

describe("every path robots disallows is also noindex on its own page (one declaration, two readers)", () => {
  it("DISALLOWED_PATHS is read from app/robots.ts and each page declares robots: { index: false }", () => {
    const robots = src("app/robots.ts");
    const list = robots.match(/DISALLOWED_PATHS = \[([^\]]*)\]/)?.[1] ?? "";
    const paths = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const p of paths) {
      const page = src(`app${p}/page.tsx`);
      expect(page, p).toMatch(/robots:\s*\{\s*index:\s*false/);
    }
  });
});
