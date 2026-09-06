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
