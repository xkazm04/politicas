import { describe, expect, it } from "vitest";
import { czechGateErrors } from "./language-gate";

import { RAPPORTEUR_WORKHORSE_MIN, rapporteurLoadCopy } from "./rapporteur-load";

describe("rapporteurLoadCopy", () => {
  it("renders nothing below the threshold or on invalid input", () => {
    expect(rapporteurLoadCopy(0)).toBeNull();
    expect(rapporteurLoadCopy(RAPPORTEUR_WORKHORSE_MIN - 1)).toBeNull();
    expect(rapporteurLoadCopy(null)).toBeNull();
    expect(rapporteurLoadCopy("5")).toBeNull();
    expect(rapporteurLoadCopy(NaN)).toBeNull();
  });

  it("carries the load and an honest count-not-quality detail at/above threshold", () => {
    const copy = rapporteurLoadCopy(5)!;
    expect(copy.badge).toBe("Zpravodajský tahoun");
    expect(copy.load).toBe(5);
    expect(copy.detail).toContain("u 5 návrhů zákona");
    expect(copy.detail).toContain("ne kvalitu");
    expect(rapporteurLoadCopy(RAPPORTEUR_WORKHORSE_MIN)).not.toBeNull();
  });
});

/* Rendered VERBATIM on the MP profile's work record, so the same Czech-first
 * gate applies as to every other reader-facing analyst string. */
describe("rapporteur copy is reader-facing Czech", () => {
  it("passes the Czech language gate", () => {
    const copy = rapporteurLoadCopy(RAPPORTEUR_WORKHORSE_MIN)!;
    expect(
      czechGateErrors([
        { label: "badge", text: copy.badge },
        { label: "detail", text: copy.detail },
      ]),
    ).toEqual([]);
  });
});
