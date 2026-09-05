import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the spis loader and page (scan-sweep 2026-09-07, mp-profile).
 * getProfileData.ts is `server-only` and cannot be imported here; what CAN be pinned is that
 * it reads through the repo's shared definitions instead of copies. */

const src = (p: string) => readFileSync(p, "utf8");

describe("getProfileData.ts resolves an ally's id through the strict shared parser", () => {
  const s = src("features/profile/getProfileData.ts");
  it("imports pspIdFromNodeId and carries no last-segment Number() read", () => {
    expect(s).toMatch(/import \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/Number\(otherId\.split\(":"\)\.pop\(\)\)/);
  });
});
