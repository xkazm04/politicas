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
