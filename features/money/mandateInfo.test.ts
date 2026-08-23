import { describe, expect, it } from "vitest";
import { publicMandateInfo, roleRegisterContradiction } from "./moneyTypes";

describe("publicMandateInfo — one Czech reading of the company axis (batch 019)", () => {
  it("names every verdict and the unverified state, in Czech, with a tone", () => {
    for (const k of ["public-body", "publicly-owned", "private", "ownership-not-published", "unknown", null] as const) {
      const info = publicMandateInfo(k);
      expect(info.labelCs.length).toBeGreaterThan(3);
      expect(["signal", "muted", "neutral"]).toContain(info.tone);
      // Czech-first: no English leaks into a reader-facing label.
      expect(info.labelCs).not.toMatch(/ownership|unknown|private|public/i);
    }
  });

  it("an unpublished owner is a SIGNAL — that is the lane the reviewer works", () => {
    expect(publicMandateInfo("ownership-not-published").tone).toBe("signal");
    expect(publicMandateInfo("publicly-owned").tone).toBe("muted");
  });
});

describe("roleRegisterContradiction — steward by role, private BUSINESS by register", () => {
  const tie = (over: Partial<Parameters<typeof roleRegisterContradiction>[0]>) => ({
    tieClass: "steward",
    publicMandate: "private" as const,
    publicMandateLegalForm: "121",
    ...over,
  });

  it("THE LOVOCHEMIE CASE: a dozorčí rada seat at a private a.s. classed steward IS a contradiction", () => {
    expect(roleRegisterContradiction(tie({}))).toBe(true);
    expect(roleRegisterContradiction(tie({ publicMandateLegalForm: "112" }))).toBe(true);
  });

  it("a nonprofit private-law form is what steward MEANS — no contradiction", () => {
    // o.p.s. (141), nadace (117), nadační fond (118), ústav (161), spolek (706): 2/3 of the
    // raw 36 hits in batch 019 were these, and they are correctly steward.
    for (const form of ["141", "117", "118", "161", "706"]) expect(roleRegisterContradiction(tie({ publicMandateLegalForm: form })), form).toBe(false);
  });

  it("never fires without a verdict or a legal form — absence is not a contradiction", () => {
    expect(roleRegisterContradiction(tie({ publicMandate: null }))).toBe(false);
    expect(roleRegisterContradiction(tie({ publicMandateLegalForm: null }))).toBe(false);
    expect(roleRegisterContradiction(tie({ publicMandate: "ownership-not-published" }))).toBe(false);
  });

  it("only the steward class can contradict — an owner-operator at a private firm is the expected case", () => {
    expect(roleRegisterContradiction(tie({ tieClass: "owner-operator" }))).toBe(false);
  });
});
