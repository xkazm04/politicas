// Paměť zákona — kodek adres předpisu a §-kotev (moonshot 5A). Adresy a
// kotvy jsou veřejné API: round-trip a přísnost parsování se přibíjejí testem.

import { describe, expect, it } from "vitest";
import {
  NON_PARAGRAPH_KEY,
  lawNodeId,
  paragraphAnchor,
  paragraphKeyOf,
  paragraphLabel,
  parseStatuteSlug,
  refFromLawNodeId,
  statuteSlug,
} from "./statuteRef";

describe("statute ref codec", () => {
  it("round-trips canonical refs", () => {
    for (const ref of ["586/1992", "40/2009", "1/1993", "427/2011"]) {
      const slug = statuteSlug(ref);
      expect(slug).not.toBeNull();
      expect(parseStatuteSlug(slug!)).toBe(ref);
    }
    expect(statuteSlug("586/1992")).toBe("586-1992");
  });

  it("rejects non-canonical refs and slugs — strict, never guessed", () => {
    expect(statuteSlug("586/92")).toBeNull(); // dvouciferný rok
    expect(statuteSlug("Sb. 586/1992")).toBeNull();
    expect(statuteSlug("586-1992")).toBeNull(); // slug není ref
    expect(parseStatuteSlug("586/1992")).toBeNull(); // ref není slug
    expect(parseStatuteSlug("586-92")).toBeNull();
    expect(parseStatuteSlug("..%2F..-1992")).toBeNull();
    expect(parseStatuteSlug("")).toBeNull();
  });
});

describe("law node id codec", () => {
  it("round-trips a canonical ref through the graph's own node id", () => {
    for (const ref of ["586/1992", "40/2009", "1/1993"]) {
      const id = lawNodeId(ref);
      expect(id).toBe(`law:sb:${statuteSlug(ref)}`);
      expect(refFromLawNodeId(id!)).toBe(ref);
    }
  });

  it("refuses a ref it cannot canonically form — no half-built address", () => {
    // Předmět claimu je adresa. Kdyby se tu vrátil „law:sb:586/92", vypadal by
    // správně a neukazoval by na nic — přesně to, čemu se odmítnutí brání.
    expect(lawNodeId("586/92")).toBeNull();
    expect(lawNodeId("586-1992")).toBeNull();
    expect(lawNodeId("")).toBeNull();
  });

  it("refuses a node id outside the canonical shape, prefix included", () => {
    expect(refFromLawNodeId("law:sb:586-92")).toBeNull();
    expect(refFromLawNodeId("law:sb:")).toBeNull();
    expect(refFromLawNodeId("psp:person:6751")).toBeNull();
    expect(refFromLawNodeId("586-1992")).toBeNull();
    expect(refFromLawNodeId("bill:tisk:72")).toBeNull();
  });
});

describe("paragraph key + #p-<§> anchor", () => {
  it("extracts the top-level § from verbatim e-Sbírka fragments", () => {
    expect(paragraphKeyOf("§ 35ba odst. 1 písm. b)")).toBe("35ba");
    expect(paragraphKeyOf("§ 88")).toBe("88");
    expect(paragraphKeyOf("§60 odst. 2")).toBe("60"); // bez mezery za §
    expect(paragraphKeyOf("  § 35c odst. 1 ")).toBe("35c");
  });

  it("routes non-§ fragments into the honest residual group", () => {
    expect(paragraphKeyOf("Příloha č. 1")).toBe(NON_PARAGRAPH_KEY);
    expect(paragraphKeyOf("")).toBe(NON_PARAGRAPH_KEY);
    expect(paragraphLabel(NON_PARAGRAPH_KEY)).toBe("mimo §");
  });

  it("anchor is the public #p-<§> namespace, sanitized and lowercased", () => {
    expect(paragraphAnchor("35ba")).toBe("p-35ba");
    expect(paragraphAnchor("35BA")).toBe("p-35ba");
    expect(paragraphAnchor(NON_PARAGRAPH_KEY)).toBe("p-ostatni");
    expect(paragraphAnchor("###")).toBe(`p-${NON_PARAGRAPH_KEY}`); // nikdy prázdná kotva
    expect(paragraphLabel("35ba")).toBe("§ 35ba");
  });
});
