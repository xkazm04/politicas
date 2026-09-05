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
