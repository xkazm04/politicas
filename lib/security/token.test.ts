import { describe, expect, it } from "vitest";
import { checkSharedToken, tokensMatch } from "./token";

describe("tokensMatch", () => {
  it("accepts an exact match", () => {
    expect(tokensMatch("s3cret", "s3cret")).toBe(true);
  });

  it("rejects a mismatch, including one of a different length", () => {
    expect(tokensMatch("s3cret", "s3crets")).toBe(false);
    expect(tokensMatch("", "s3cret")).toBe(false);
    // Length mismatch must NOT throw — the sha256 pre-hash is what makes
    // timingSafeEqual's equal-length precondition always hold.
    expect(() => tokensMatch("a", "aaaaaaaaaaaaaaaaaaaa")).not.toThrow();
  });
});

describe("checkSharedToken — fails closed", () => {
  it("reports not-configured when no token is set server-side", () => {
    expect(checkSharedToken("anything", undefined)).toBe("not-configured");
    expect(checkSharedToken("anything", "")).toBe("not-configured");
    expect(checkSharedToken("anything", "   ")).toBe("not-configured");
    // …and never "ok": an unconfigured surface denies, it does not open.
    expect(checkSharedToken(undefined, undefined)).toBe("not-configured");
  });

  it("reports unauthorized for a missing or wrong submission", () => {
    expect(checkSharedToken(undefined, "s3cret")).toBe("unauthorized");
    expect(checkSharedToken("", "s3cret")).toBe("unauthorized");
    expect(checkSharedToken("nope", "s3cret")).toBe("unauthorized");
  });

  it("accepts a matching submission, ignoring surrounding whitespace", () => {
    expect(checkSharedToken("s3cret", "s3cret")).toBe("ok");
    expect(checkSharedToken(" s3cret\n", "s3cret")).toBe("ok");
  });
});
