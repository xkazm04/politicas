import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the schránka (scan-sweep 2026-09-07, schranka-notifications):
 * the parts that touch the request or the clock read through the repo's shared definitions. */

const src = (p: string) => readFileSync(p, "utf8");

describe("feedRequest.ts builds the request origin through lib/routing/liveUrl", () => {
  const s = src("features/schranka/feedRequest.ts");
  it("imports liveUrl and carries no host + x-forwarded-proto copy", () => {
    expect(s).toMatch(/import \{ liveUrl \} from "@\/lib\/routing\/liveUrl"/);
    expect(s).not.toMatch(/x-forwarded-proto/);
    expect(s).not.toMatch(/from "next\/headers"/);
  });
});
