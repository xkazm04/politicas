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

describe("the admin loaders read at the one app cap, never an ad-hoc literal", () => {
  it("getTripwireData lists vote events at KG_READ_CAP", () => {
    const s = src("features/admin/getTripwireData.ts");
    expect(s).toMatch(/listVoteEvents\(\{ termCode: TERM, limit: KG_READ_CAP \}\)/);
    expect(s).not.toMatch(/limit: 100_000/);
  });
  it("getAdminData names its audit cap and warns when a read fills it", () => {
    const s = src("features/admin/getAdminData.ts");
    expect(s).toMatch(/const AUDIT_READ_CAP = 10_000;/);
    expect(s).toMatch(/listReviewAudit\(\{ limit: AUDIT_READ_CAP \}\)/);
    expect(s).toMatch(/rows\.length >= AUDIT_READ_CAP/);
  });
});
