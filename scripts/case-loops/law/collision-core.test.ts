import { describe, expect, it } from "vitest";
import {
  amendsParagraph,
  extractParagraphs,
  instructionFormsFor,
  partitionParagraphsByStatute,
  targetedOdstavce,
} from "./collision-core";

/* collision-core's instruction grammar decides which §-overlaps are INCIDENTAL (a § merely
 * cited) and which are real (an instruction issued against it) — the sweep that prunes the
 * collision backlog runs on it. Its comments record the cases that were validated by hand
 * (batch-009: the one-line `Čl. VI V § 8` form produced all 3 false drops before it was added);
 * until 2026-09-07 nothing pinned them. */

describe("amendsParagraph — instruction vs citation", () => {
  it.each([
    ["Čl. VI V § 8 odst. 2 zákona č. 166/1993 Sb., se slova „x“ nahrazují", "8"],
    ["1. V § 15 odst. 1 písm. b) se slova „a“ nahrazují slovy „b“.", "15"],
    ["§ 4c zní:", "4c"],
    ["Za § 13 se vkládá nový § 13a, který zní:", "13"],
    ["§ 101a se odstavce 2 a 3 zrušují.", "101a"],
  ])("issues an instruction: %s → § %s", (text, num) => {
    expect(amendsParagraph(text, num)).toBe(true);
  });

  it.each([
    ["Postupuje se podle § 8 odst. 1 zákona.", "8"],
    ["uvedený v § 15 se nepoužije", "15"],
    ["V § 150 se slova „x“ nahrazují", "15"],
  ])("merely cites: %s → § %s", (text, num) => {
    expect(amendsParagraph(text, num)).toBe(false);
  });

  it("the grammar has four forms and escapes the § number", () => {
    expect(instructionFormsFor("8")).toHaveLength(4);
    expect(amendsParagraph("V § 8a odst. 1 se", "8")).toBe(false);
  });
});

describe("extractParagraphs — base § numbers, lowercased, sorted", () => {
  it("dedupes and lowercases", () => {
    expect(extractParagraphs("§ 35ba a §35 a § 38GB a § 2 a § 35ba")).toEqual(["2", "35", "35ba", "38gb"]);
  });
});

describe("partitionParagraphsByStatute — one statute per Čl. block", () => {
  const bill =
    "\nČl. I\nZákon č. 586/1992 Sb., o daních z příjmů, se mění takto:\n1. V § 35ba odst. 1 se …\n\n" +
    "Čl. II\nZákon č. 262/2006 Sb., zákoník práce, se mění takto:\n1. V § 6 se …\n\n" +
    "Čl. III\nPřechodné ustanovení\nV § 9 …\n";
  it("buckets each block under its own first citation; a block without one is 'unknown'", () => {
    const parts = partitionParagraphsByStatute(bill);
    expect([...parts.get("586/1992")!.paragraphs]).toEqual(["35ba"]);
    expect([...parts.get("262/2006")!.paragraphs]).toEqual(["6"]);
    expect([...parts.get("unknown")!.paragraphs]).toEqual(["9"]);
  });
  it("a bill without Čl. structure is one block under its first citation", () => {
    const parts = partitionParagraphsByStatute("Zákon č. 1/2000 Sb. se mění takto: V § 3 se …");
    expect([...parts.keys()]).toEqual(["1/2000"]);
  });
});

describe("targetedOdstavce — which paragraphs of § N the instructions touch", () => {
  it("lists the odstavce named with 'a' and ','", () => {
    expect([...targetedOdstavce("V § 8 odst. 2 a 3 se …", "8")].sort()).toEqual(["2", "3"]);
  });
  it("expands an 'až' range — odst. 5 až 7 touches 6 as well", () => {
    expect([...targetedOdstavce("V § 8 odst. 5 až 7 se …", "8")].sort()).toEqual(["5", "6", "7"]);
  });
  it("is scoped to § N — another §'s odstavce do not leak in", () => {
    expect([...targetedOdstavce("V § 8 odst. 2 se … V § 9 odst. 4 se …", "8")]).toEqual(["2"]);
  });
});
