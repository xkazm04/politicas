// The instruction grammar against the 141 cached prints (2026-10-10, registry apply of
// amendment-instruction-grammar). Every case below is a clause from a real print, kept as
// the fixture for the miss it measured. The paired run was HEAD's grammar against this one,
// on the same texts: it reproduced the batch-016 census 3166 of 3166 before anything changed.
import { describe, expect, it } from "vitest";
import { amendsParagraph, insertionTargets, instructionRole, targetedScope } from "./collision-core";

describe("instructionRole: forms the grammar read as citations", () => {
  it.each([
    ["30. § 416 se včetně nadpisu zrušuje.", "416"], // tisk 64
    ["70. § 30 odst. 1 zní:", "30"], // tisk 67: the period in „odst." ended the window
    ["67. § 280 až 282 se zrušují.", "281"], // tisk 13: a range repeals every § in it
    ["2. § 1826 a 1827 se zrušují.", "1827"], // tisk 69
    ["13. V § 334c odst. 1, § 336 odst. 1, § 350k odst. 2 a v § 350l odst. 1 se slova", "350k"], // tisk 111: a joint clause
  ])("%s → § %s is edited", (text, num) => {
    expect(instructionRole(text, num)).toBe("amends");
  });
});

describe("instructionRole: insertion", () => {
  const text = "5. Za § 8 se vkládají nové § 8a a § 8b, které včetně nadpisů znějí:"; // tisk 57
  it("the anchor is a position, the listed §§ are created", () => {
    expect(instructionRole(text, "8")).toBe("anchor");
    expect(instructionRole(text, "8a")).toBe("inserts");
    expect(instructionRole(text, "8b")).toBe("inserts");
    expect(amendsParagraph(text, "8")).toBe(false);
    expect(amendsParagraph(text, "8b")).toBe(true);
  });
  it("reads the other word order", () => {
    expect([...insertionTargets("V hlavě II se za § 14q vkládá nový § 14r, který zní:").inserted]).toEqual(["14r"]);
  });
});

describe("instructionRole: a layout line start is not a clause start for a lowercase „v“", () => {
  it("„stanovenými\\nv § 228“ cites (tisk 144; admitted under the old /i flag)", () => {
    expect(instructionRole("v souladu s podmínkami stanovenými\nv § 228 nebo nebyla podána", "228")).toBe("cites");
  });
});

describe("targetedScope: whole, named and unresolved stay apart", () => {
  it("whole: „§ 22 včetně nadpisu zní:“ (tisk 5) and an inserted §", () => {
    expect(targetedScope("9. § 22 včetně nadpisu zní:", "22")).toEqual({ kind: "whole" });
    expect(targetedScope("2. Za § 31 se vkládá nový § 31a, který včetně nadpisu zní:", "31a")).toEqual({ kind: "whole" });
  });
  it("named: the spelled-out „V § 39 odstavec 2 zní:“ (tisk 4)", () => {
    const s = targetedScope("3. V § 39 odstavec 2 zní:", "39");
    expect(s.kind === "odstavce" && [...s.odstavce]).toEqual(["2"]);
  });
  it("named inside a joint clause, not from quoted text", () => {
    const s = targetedScope(
      "1. V § 199 odst. 1 a v § 303 odst. 1 se slova „šest měsíců“ nahrazují slovy „jeden rok“. „lhůty uvedené v § 303 odst. 4“", // tisk 173
      "303",
    );
    expect(s.kind === "odstavce" && [...s.odstavce]).toEqual(["1"]);
  });
  it("positional: inserting a paragraph shifts the ones after it (tisk 13)", () => {
    const s = targetedScope("29. V § 29 se za odstavec 3 vkládá nový odstavec 4, který zní:", "29");
    expect(s.kind === "odstavce" && s.positional).toBe(true);
  });
  it("unresolved: a word edit with no paragraph is not the whole §", () => {
    expect(targetedScope("23. V § 214 se za slovo „schvalování“ vkládají slova „řádné individuální“", "214")).toEqual({
      kind: "unresolved",
    });
  });
});
