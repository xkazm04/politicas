import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REVIEW_STATES, reviewStateOf } from "./reviewTypes";

/* Source-grep tests for the case-file loaders and pages (scan-sweep, money-cases-review).
 * Same honest gap as console.a11y.test.ts: no jsdom here, so a grep proves the wiring is in
 * the SOURCE; the pure rules are exercised directly. */

const src = (p: string) => readFileSync(p, "utf8");

describe("review state: one runtime vocabulary (reviewTypes.ts)", () => {
  it("lists exactly the three gate states", () => {
    expect([...REVIEW_STATES].sort()).toEqual(["pending_review", "rejected", "verified"]);
  });
  it.each([
    ["verified", "verified"],
    ["rejected", "rejected"],
    ["pending_review", "pending_review"],
  ] as const)("keeps a stored %s", (raw, state) => {
    expect(reviewStateOf(raw)).toBe(state);
  });
  it.each([undefined, null, "", "confirmed", "VERIFIED", 1])("reads %j as pending (never ruled on)", (raw) => {
    expect(reviewStateOf(raw)).toBe("pending_review");
  });
  it("the verification loader narrows through it, not through its own ternary", () => {
    const s = src("features/money/getVerificationData.ts");
    expect(s).toMatch(/reviewStateOf\(/);
    expect(s).not.toMatch(/rawState === "verified" \?/);
  });
});

describe("collision candidates: statute ref from a law node id", () => {
  it("imports the lawwatch inverse instead of re-spelling the urn grammar", () => {
    const s = src("features/money/collisions/getCollisionCandidates.ts");
    expect(s).toMatch(/import \{ refFromLawNodeId \} from "@\/features\/lawwatch\/statuteRef"/);
    expect(s).not.toMatch(/replace\(\/\^law:sb:\//);
  });
});
