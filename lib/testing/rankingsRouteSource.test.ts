import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for the CivicScore / profile routes (scan-sweep 2026-09-07,
 * mp-rankings-routes). Routes are thin and `server-only`; what CAN be pinned is that they
 * read through the repo's shared definitions instead of copies. */

const src = (p: string) => readFileSync(p, "utf8");

describe("/poslanec/[id] reads its segment through lib/routing/pspIdParam", () => {
  const s = src("app/poslanec/[id]/page.tsx");
  it("imports pspIdFromParam and spells the digit rule nowhere", () => {
    expect(s).toMatch(/import \{ pspIdFromParam \} from "@\/lib\/routing\/pspIdParam"/);
    expect(s).not.toMatch(/\^\\d\+\$/);
    expect(s).not.toMatch(/Number\(id\)/);
  });
});

describe("live URL from request headers has one definition (lib/routing/liveUrl.ts)", () => {
  it.each(["app/kraj/[kraj]/page.tsx", "app/plakat/[view]/page.tsx"])("%s imports liveUrl and carries no copy", (f) => {
    const s = src(f);
    expect(s).toMatch(/import \{ liveUrl \} from "@\/lib\/routing\/liveUrl"/);
    expect(s).not.toMatch(/x-forwarded-proto/);
    expect(s).not.toMatch(/from "next\/headers"/);
  });
});

describe("the first search-param value has one definition (lib/routing/searchParam.ts)", () => {
  it.each(["app/referendum/page.tsx", "app/zebricek/page.tsx"])("%s imports firstParam and carries no copy", (f) => {
    const s = src(f);
    expect(s).toMatch(/import \{ firstParam \} from "@\/lib\/routing\/searchParam"/);
    expect(s).not.toMatch(/const one = /);
  });
});
