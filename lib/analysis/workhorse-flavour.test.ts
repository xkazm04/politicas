import { describe, expect, it } from "vitest";
import { isWorkhorseFlavour, workhorseFlavourCopy, WORKHORSE_FLAVOURS } from "./workhorse-flavour";

describe("isWorkhorseFlavour", () => {
  it("accepts both vocabulary values", () => {
    for (const f of WORKHORSE_FLAVOURS) expect(isWorkhorseFlavour(f)).toBe(true);
  });

  it("rejects unknown strings, non-strings, null and undefined", () => {
    expect(isWorkhorseFlavour("committee")).toBe(false);
    expect(isWorkhorseFlavour("")).toBe(false);
    expect(isWorkhorseFlavour(1)).toBe(false);
    expect(isWorkhorseFlavour(null)).toBe(false);
    expect(isWorkhorseFlavour(undefined)).toBe(false);
    expect(isWorkhorseFlavour({})).toBe(false);
  });
});

describe("workhorseFlavourCopy", () => {
  it("returns copy for both flavours with non-empty badge and detail", () => {
    for (const f of WORKHORSE_FLAVOURS) {
      const c = workhorseFlavourCopy(f);
      expect(c).not.toBeNull();
      expect(c!.badge.length).toBeGreaterThan(0);
      expect(c!.detail.length).toBeGreaterThan(0);
    }
  });

  it("degrades to null for missing or unrecognized flavours — never fabricates a label", () => {
    expect(workhorseFlavourCopy(undefined)).toBeNull();
    expect(workhorseFlavourCopy(null)).toBeNull();
    expect(workhorseFlavourCopy("some_other_flavour")).toBeNull();
  });

  it("treats legislative and oversight symmetrically — same shape, no tone hierarchy field", () => {
    const a = workhorseFlavourCopy("legislative")!;
    const b = workhorseFlavourCopy("oversight")!;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });
});
