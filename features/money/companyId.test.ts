import { describe, expect, it } from "vitest";
import { canonicalIco, companyNodeId, icoFromCompanyNodeId } from "./companyId";

describe("canonicalIco", () => {
  it("zero-pads to the 8 digits the graph keys on", () => {
    expect(canonicalIco("2867681")).toBe("02867681");
    expect(canonicalIco("1")).toBe("00000001");
  });

  it("leaves an already canonical IČO alone", () => {
    expect(canonicalIco("26185610")).toBe("26185610");
  });

  it("tolerates surrounding whitespace from a pasted URL", () => {
    expect(canonicalIco(" 60193468 ")).toBe("60193468");
  });

  it("rejects anything that cannot be an IČO — never repairs it", () => {
    expect(canonicalIco("")).toBeNull();
    expect(canonicalIco("123456789")).toBeNull(); // 9 digits is not an IČO
    expect(canonicalIco("26185610a")).toBeNull();
    expect(canonicalIco("psp:person:6751")).toBeNull();
    expect(canonicalIco("-1")).toBeNull();
  });
});

describe("companyNodeId / icoFromCompanyNodeId", () => {
  it("round-trips the canonical form", () => {
    const id = companyNodeId(canonicalIco("2867681")!);
    expect(id).toBe("company:ico:02867681");
    expect(icoFromCompanyNodeId(id)).toBe("02867681");
  });

  it("returns null for an id that is not a company node", () => {
    expect(icoFromCompanyNodeId("psp:person:6751")).toBeNull();
    expect(icoFromCompanyNodeId("bill:tisk:58")).toBeNull();
  });
});
