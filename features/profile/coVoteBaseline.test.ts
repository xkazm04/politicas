import { describe, expect, it } from "vitest";

import { coVoteBaseline } from "./coVoteBaseline";
import type { CoVoter } from "./profileTypes";

const cv = (pspId: number, clubAbbrev: string, agreement: number): CoVoter => ({
  pspId,
  name: `#${pspId}`,
  clubAbbrev,
  clubColor: "",
  agreement,
  shared: 100,
});

describe("coVoteBaseline", () => {
  it("splits the MP's pairings into own club and other clubs, median each", () => {
    const b = coVoteBaseline(
      [cv(1, "A", 0.99), cv(2, "A", 0.97), cv(3, "A", 1), cv(4, "B", 0.4), cv(5, "C", 0.5)],
      "A",
    );
    expect(b.ownClub).toEqual({ median: 0.99, pairs: 3 });
    expect(b.otherClubs).toEqual({ median: 0.45, pairs: 2 });
  });

  it("has no own-club side for a sole member, and no sides at all for an unknown club", () => {
    expect(coVoteBaseline([cv(4, "B", 0.4)], "A")).toEqual({
      ownClub: null,
      otherClubs: { median: 0.4, pairs: 1 },
    });
    expect(coVoteBaseline([cv(4, "B", 0.4)], "—")).toEqual({ ownClub: null, otherClubs: null });
    expect(coVoteBaseline([cv(4, "B", 0.4)], null)).toEqual({ ownClub: null, otherClubs: null });
  });

  it("leaves a partner with an unknown club out of both sides rather than guessing one", () => {
    const b = coVoteBaseline([cv(1, "A", 0.99), cv(9, "—", 0.1)], "A");
    expect(b).toEqual({ ownClub: { median: 0.99, pairs: 1 }, otherClubs: null });
  });
});
