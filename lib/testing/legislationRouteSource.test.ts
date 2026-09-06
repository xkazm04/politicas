import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the voting & legislation routes (scan-sweep 2026-09-07,
 * voting-legislation-routes): thin routes read the repo's shared definitions. */

const src = (p: string) => readFileSync(p, "utf8");
const FEEDS = ["app/zakony/kolize/feed.json/route.ts", "app/zakony/kolize/feed.xml/route.ts"];

describe("the collision-radar feeds build their origin through features/denik/feedRequest", () => {
  for (const f of FEEDS) {
    it(`${f} imports requestOrigin and carries no host + x-forwarded-proto copy`, () => {
      const s = src(f);
      expect(s).toMatch(/import \{ [^}]*requestOrigin[^}]* \} from "@\/features\/denik\/feedRequest"/);
      expect(s).not.toMatch(/x-forwarded-proto/);
      expect(s).not.toMatch(/from "next\/headers"/);
    });
  }
});

describe("a radar feed's 503 carries cache-control: no-store, like the dukazy feeds", () => {
  for (const f of FEEDS) {
    it(`${f} sends no-store with its 503`, () => {
      const s = src(f);
      const block = /status: 503,[\s\S]*?\}\)/.exec(s)?.[0] ?? "";
      expect(block).toMatch(/"cache-control": "no-store"/);
    });
  }
});
