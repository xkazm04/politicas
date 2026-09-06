import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the civic feed & verification routes (scan-sweep 2026-09-08,
 * civic-feeds-verification): thin routes read the repo's shared definitions. */

const src = (p: string) => readFileSync(p, "utf8");

describe("the dukazy feeds answer success with the feeds' one cache policy, like /denik", () => {
  for (const f of ["app/dukazy/feed.json/route.ts", "app/dukazy/feed.xml/route.ts"]) {
    it(`${f} imports FEED_CACHE_CONTROL and sends it on the 200 branch`, () => {
      const s = src(f);
      expect(s).toMatch(/import \{ [^}]*FEED_CACHE_CONTROL[^}]* \} from "@\/features\/denik\/feedRequest"/);
      expect(s).toMatch(/"cache-control": FEED_CACHE_CONTROL/);
    });
  }
});

describe("the receipt page reads the tree's one live-URL definition", () => {
  it("app/zdroj/[ref]/page.tsx imports liveUrl and carries no host + x-forwarded-proto copy", () => {
    const s = src("app/zdroj/[ref]/page.tsx");
    expect(s).toMatch(/import \{ liveUrl \} from "@\/lib\/routing\/liveUrl"/);
    expect(s).not.toMatch(/x-forwarded-proto/);
    expect(s).not.toMatch(/from "next\/headers"/);
  });
});
