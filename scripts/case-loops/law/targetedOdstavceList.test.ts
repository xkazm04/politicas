// targetedOdstavce reads the WHOLE list after „odst." (2026-09-09, scan-sweep
// law-collision-analysis, bounty-hunter). Until then only the first item and one
// connector were read, so „odst. 1, 2 a 4" lost the 4 — the class the 2026-09-07 range
// fix closed for „5 až 7", one shape over.
import { describe, expect, it } from "vitest";
import { targetedOdstavce } from "./collision-core";

describe("targetedOdstavce — a comma-and-'a' list names every paragraph in it", () => {
  it("odst. 1, 2 a 4 touches 4 as well, not only the first two", () => {
    expect([...targetedOdstavce("V § 8 odst. 1, 2 a 4 se slova …", "8")].sort()).toEqual(["1", "2", "4"]);
  });
  it("a range inside a list expands too: odst. 1, 3 až 5 a 7", () => {
    expect([...targetedOdstavce("V § 8 odst. 1, 3 až 5 a 7 se …", "8")].sort()).toEqual(["1", "3", "4", "5", "7"]);
  });
  it("'a' followed by a word is not a list item: odst. 2 a v § 9", () => {
    expect([...targetedOdstavce("V § 8 odst. 2 a v § 9 odst. 4 se …", "8")]).toEqual(["2"]);
  });
});
