import { describe, expect, it } from "vitest";
import { isKnownOutcome, KNOWN_OUTCOMES, outcomeTone } from "./outcome";

/* The catalog names exactly two outcomes (common.voteResult.accepted / .rejected). Anything
 * else the ingest stores must print as itself - never through the „zamítnuto" branch
 * (scan-sweep 2026-09-07, votetrack-ledger). */

describe("outcome vocabulary", () => {
  it("knows exactly the two catalog outcomes", () => {
    expect([...KNOWN_OUTCOMES].sort()).toEqual(["accepted", "rejected"]);
    expect(isKnownOutcome("accepted")).toBe(true);
    expect(isKnownOutcome("rejected")).toBe(true);
    expect(isKnownOutcome("")).toBe(false);
    expect(isKnownOutcome("void")).toBe(false);
  });
  it("tones: accepted / rejected / other - an unknown token is never coloured as rejected", () => {
    expect(outcomeTone("accepted")).toBe("accepted");
    expect(outcomeTone("rejected")).toBe("rejected");
    expect(outcomeTone("annulled")).toBe("other");
    expect(outcomeTone("")).toBe("other");
  });
});
