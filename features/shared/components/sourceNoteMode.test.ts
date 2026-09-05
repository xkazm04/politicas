import { describe, expect, it } from "vitest";
import { citationMode, LABEL_MAX_CHARS, textLength } from "./sourceNoteMode";

/* SourceNote is the brand primitive - every rendered number cites through it - and its one
 * rule ("a citation is a tracked label up to 48 characters and a sentence beyond") was
 * enforced by an unexported walker nobody could test (scan-sweep 2026-09-07). The two
 * strings in the primitive's own header are the calibration points. */

const el = (children: unknown) => ({ props: { children } });

describe("textLength counts the rendered text of a children tree", () => {
  it("strings, numbers and nested elements count; null, undefined and booleans do not", () => {
    expect(textLength("abc")).toBe(3);
    expect(textLength(42)).toBe(2);
    expect(textLength(["ab", null, undefined, false, el("cd"), 7])).toBe(5);
    expect(textLength(el([el("x"), "yz"]))).toBe(3);
  });
});

describe("citationMode", () => {
  it("the header's calibration strings fall on the right sides of 48", () => {
    expect(LABEL_MAX_CHARS).toBe(48);
    expect(citationMode("obr. 4 — ověřené veřejné zdroje")).toBe("label");
    expect(citationMode("ilustrativní schéma — ilustrativní ukázka — nejde o reálná data")).toBe("sentence");
  });
  it("decides on the WHOLE tree, not the first string", () => {
    expect(citationMode(["zdroj: ", el("psp.cz · hlasování PSP10 · "), "výpočet politicas"])).toBe("sentence");
    expect(citationMode(["zdroj: ", el("psp.cz")])).toBe("label");
  });
  it("exactly 48 characters is still a label; 49 is a sentence", () => {
    expect(citationMode("x".repeat(48))).toBe("label");
    expect(citationMode("x".repeat(49))).toBe("sentence");
  });
});
