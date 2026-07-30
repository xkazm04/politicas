import { describe, expect, it } from "vitest";
import { FORENSIC_PARAM, FORENSIC_VALUE, isForensic, withForensic } from "./forensicMode";

describe("isForensic — přísná shoda hodnoty", () => {
  it("zapíná jen přesnou hodnotu forenzni", () => {
    expect(isForensic(new URLSearchParams("rezim=forenzni"))).toBe(true);
  });

  it("cokoli jiného režim NEzapíná — adresa je tvrzení, neopravujeme", () => {
    for (const q of ["", "rezim=", "rezim=Forenzni", "rezim=FORENZNI", "rezim=forensic", "rezim=plakat", "mode=forenzni"]) {
      expect(isForensic(new URLSearchParams(q))).toBe(false);
    }
  });

  it("null/undefined parametry = vypnuto", () => {
    expect(isForensic(null)).toBe(false);
    expect(isForensic(undefined)).toBe(false);
  });
});

describe("withForensic — adresa nese režim, ostatní parametry nedotčené", () => {
  it("zapnutí přidá parametr", () => {
    expect(withForensic("/graf", "", true)).toBe(`/graf?${FORENSIC_PARAM}=${FORENSIC_VALUE}`);
  });

  it("vypnutí parametr odebere a prázdný query se nesází", () => {
    expect(withForensic("/graf", "rezim=forenzni", false)).toBe("/graf");
  });

  it("cizí parametry přežijí oběma směry (režim je ortogonální)", () => {
    const on = withForensic("/zebricek", "vahy=a1b2&tab=x", true);
    expect(new URLSearchParams(on.split("?")[1]).get("vahy")).toBe("a1b2");
    expect(new URLSearchParams(on.split("?")[1]).get("tab")).toBe("x");
    const off = withForensic("/zebricek", on.split("?")[1], false);
    expect(off).toBe("/zebricek?vahy=a1b2&tab=x");
  });

  it("kruh: zapnout → isForensic true → vypnout → false", () => {
    const on = withForensic("/graf", "", true);
    expect(isForensic(new URLSearchParams(on.split("?")[1]))).toBe(true);
    const off = withForensic("/graf", on.split("?")[1] ?? "", false);
    expect(isForensic(new URLSearchParams(off.split("?")[1] ?? ""))).toBe(false);
  });

  it("idempotence: dvojí zapnutí nezdvojí parametr", () => {
    const once = withForensic("/graf", "", true);
    const twice = withForensic("/graf", once.split("?")[1], true);
    expect(twice).toBe(once);
  });

  it("přijímá i URLSearchParams instanci", () => {
    expect(withForensic("/graf", new URLSearchParams("a=1"), true)).toBe("/graf?a=1&rezim=forenzni");
  });
});
