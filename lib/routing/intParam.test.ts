import { describe, expect, it } from "vitest";
import { positiveIntParam } from "./intParam";

describe("positiveIntParam", () => {
  it("accepts a plain run of digits", () => {
    expect(positiveIntParam("822")).toBe(822);
    expect(positiveIntParam("1")).toBe(1);
  });
  it("rejects every other spelling Number() would accept", () => {
    for (const raw of ["", " 822", "822 ", "8.22", "1e3", "0x10", "-5", "+5", "0", "Infinity", "NaN"]) {
      expect(positiveIntParam(raw), raw).toBeNull();
    }
  });
});
