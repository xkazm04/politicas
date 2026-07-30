import { describe, expect, it } from "vitest";
import {
  claimRefPath,
  decodeClaimRef,
  edgeClaimRef,
  encodeClaimRef,
  nodeClaimRef,
  type ClaimRef,
} from "./claimRef";

describe("kodek adresy tvrzení (claimRef)", () => {
  it("hrana: encode → decode je identita (round-trip)", () => {
    const ref: ClaimRef = {
      kind: "edge",
      src: "psp:person:6202",
      rel: "linked_to",
      dst: "company:ico:25841991",
    };
    const encoded = encodeClaimRef(ref);
    expect(decodeClaimRef(encoded)).toEqual(ref);
  });

  it("uzel: encode → decode je identita", () => {
    const ref: ClaimRef = { kind: "node", id: "psp:organ:174" };
    expect(decodeClaimRef(encodeClaimRef(ref))).toEqual(ref);
  });

  it("přežije českou diakritiku i netriviální znaky v id (UTF-8)", () => {
    const ref: ClaimRef = { kind: "edge", src: "theme:obrana-a-bezpečnost", rel: "about", dst: "law:106/1999" };
    expect(decodeClaimRef(encodeClaimRef(ref))).toEqual(ref);
  });

  it("adresa je deterministická — týž ref, táž adresa", () => {
    expect(edgeClaimRef("a", "supplies", "b")).toBe(edgeClaimRef("a", "supplies", "b"));
    expect(nodeClaimRef("x")).toBe(nodeClaimRef("x"));
  });

  it("hrana a uzel se stejným obsahem nekolidují (různý prefix)", () => {
    expect(nodeClaimRef("a")).not.toBe(edgeClaimRef("a", "a", "a"));
  });

  it("nerozluštitelná adresa vrací null, nikdy polovičatý ref", () => {
    expect(decodeClaimRef("")).toBeNull();
    expect(decodeClaimRef("garbage")).toBeNull();
    expect(decodeClaimRef("x.YWJj")).toBeNull(); // neznámý prefix
    expect(decodeClaimRef("h.YWJj")).toBeNull(); // hrana se 2 segmenty
    expect(decodeClaimRef("u.YWJj.YWJj")).toBeNull(); // uzel se 3 segmenty
    expect(decodeClaimRef("u.%%%")).toBeNull(); // neplatné base64url znaky
    expect(decodeClaimRef("u.")).toBeNull(); // prázdné id není tvrzení
  });

  it("odmítá base64url s nemožnou délkou (len % 4 === 1)", () => {
    expect(decodeClaimRef("u.YWJjZ")).toBeNull();
  });

  it("odmítá zneužitě dlouhou adresu (přes 512 znaků)", () => {
    const long = `u.${"A".repeat(600)}`;
    expect(decodeClaimRef(long)).toBeNull();
  });

  it("claimRefPath skládá /zdroj/<ref> z refu i z hotového řetězce", () => {
    const ref: ClaimRef = { kind: "node", id: "psp:person:6202" };
    const encoded = encodeClaimRef(ref);
    expect(claimRefPath(ref)).toBe(`/zdroj/${encoded}`);
    expect(claimRefPath(encoded)).toBe(`/zdroj/${encoded}`);
  });

  it("adresa je URL-bezpečný segment (jen [A-Za-z0-9._-])", () => {
    const encoded = edgeClaimRef("psp:person:6202", "linked_to", "company:ico:25841991");
    expect(encoded).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});
