// A classifier batch the model did not answer must not become product data.
// `vote_tag` is read by the VoteTrack theme filter; until 2026-09-06 an
// unparseable batch, a row the model dropped, or an unknown slug were all written
// as theme "jine" with confidence 0 — a fabricated classification of up to forty
// votes per batch, indistinguishable in the table from a real "other" verdict.

import { describe, expect, it } from "vitest";

import { parseTags } from "./materialize-tags";

const batch = [
  { votePspId: 1, title: "a" },
  { votePspId: 2, title: "b" },
  { votePspId: 3, title: "c" },
];

describe("parseTags (2026-09-06, bounty-hunter)", () => {
  it("keeps only rows the model answered with a KNOWN slug — no default theme is invented", () => {
    const out = parseTags(
      '[{"id":1,"theme":"procedura","confidence":0.9},{"id":2,"theme":"not-a-theme","confidence":0.8}]',
      batch,
    );
    expect([...out.keys()]).toEqual([1]);
    expect(out.get(1)).toEqual({ theme: "procedura", confidence: 0.9 });
  });

  it("an unparseable batch yields NO rows, not forty rows of 'jine'", () => {
    expect(parseTags("sorry, I cannot", batch).size).toBe(0);
  });

  it("a missing confidence is not 0.5 by default — the row is kept only when the model stated one", () => {
    const out = parseTags('[{"id":3,"theme":"jine"}]', batch);
    expect(out.size).toBe(0);
  });
});
