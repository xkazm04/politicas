import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for /admin (scan-sweep 2026-09-07, admin-control, second sweep). */

const src = (p: string) => readFileSync(p, "utf8");

describe("getAdminData classifies a tie's review state through reviewStateOf", () => {
  it("imports reviewStateOf and spells no verified/rejected ladder of its own", () => {
    const s = src("features/admin/getAdminData.ts");
    expect(s).toMatch(/reviewStateOf/);
    expect(s).not.toMatch(/rawState === "verified"\) verified\+\+/);
  });
});
