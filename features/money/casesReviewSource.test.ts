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

describe("evidence packet: the compiled-at stamp is the Prague day", () => {
  it("calls pragueDay() and no longer slices the UTC ISO string", () => {
    const s = src("features/money/getEvidencePacket.ts");
    expect(s).toMatch(/import \{ pragueDay \} from "@\/features\/denik\/pragueDay"/);
    expect(s).toMatch(/const compiledAt = pragueDay\(\)/);
    expect(s).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});

describe("verification console: tie-class copy is imported, never re-worded", () => {
  const CODE = src("features/money/components/VerificationConsole.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  it("has no local class-label table and no literal class caption", () => {
    expect(CODE).not.toMatch(/CLASS_LABEL/);
    expect(CODE).not.toMatch(/"vlastník \/ jednatel"/);
    expect(CODE).not.toMatch(/"firma, kterou poslanec vlastní nebo řídí"/);
    expect(CODE).toMatch(/tieClassInfo\(/);
  });
});

describe("last human review: rendered as a day on every surface", () => {
  it("no surface interpolates the raw ISO timestamp", () => {
    for (const f of [
      "features/money/MpCaseFilePage.tsx",
      "features/money/EvidencePacketPage.tsx",
      "features/money/components/VerificationConsole.tsx",
      "features/money/packet.ts",
    ]) {
      const s = src(f);
      expect(s, f).not.toMatch(/\$\{tie\.lastReviewedAt\}/);
      expect(s, f).not.toMatch(/lastReviewedAt\.slice\(0, 10\)/);
      expect(s, f).toMatch(/reviewedDay\(/);
    }
  });
});

describe("verification queue: a capped audit read is reported, not silent", () => {
  it("warns when the ledger read returns as many rows as the cap", () => {
    const s = src("features/money/getVerificationData.ts");
    expect(s).toMatch(/rows\.length >= AUDIT_READ_CAP/);
  });
});
