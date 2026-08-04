import { describe, expect, it } from "vitest";
import { caseFileLinkFor } from "./caseFileLink";

describe("spis ke koncovému bodu účtenky", () => {
  it("osoba a firma vedou na svůj spis", () => {
    expect(caseFileLinkFor({ id: "psp:person:6881", kind: "person" })).toEqual({
      href: "/poslanec/6881",
      target: "poslanec",
    });
    expect(caseFileLinkFor({ id: "company:ico:46347534", kind: "company" })).toEqual({
      href: "/penize/firma/46347534",
      target: "firma",
    });
  });

  it("neznámý tvar id NEDOSTANE odkaz — nikdy se nehádá", () => {
    expect(caseFileLinkFor({ id: "person-42", kind: "person" })).toBeNull();
    expect(caseFileLinkFor({ id: "company:ico:abcdefgh", kind: "company" })).toBeNull();
    expect(caseFileLinkFor({ id: "company:ico:123456789", kind: "company" })).toBeNull();
    expect(caseFileLinkFor({ id: "psp:person:6881", kind: "unknown" })).toBeNull();
  });

  it("druhy uzlů bez vlastní plochy odkaz nedostanou", () => {
    for (const kind of ["contract", "bill", "law", "party", "organ", "bloc", "theme"]) {
      expect(caseFileLinkFor({ id: `${kind}:x:1`, kind }), kind).toBeNull();
    }
  });
});
