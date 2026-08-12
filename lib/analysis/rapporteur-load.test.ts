import { describe, expect, it } from "vitest";

import { RAPPORTEUR_COPY_KEYS, RAPPORTEUR_WORKHORSE_MIN, rapporteurLoadCopy } from "./rapporteur-load";

describe("rapporteurLoadCopy", () => {
  it("renders nothing below the threshold or on invalid input", () => {
    expect(rapporteurLoadCopy(0)).toBeNull();
    expect(rapporteurLoadCopy(RAPPORTEUR_WORKHORSE_MIN - 1)).toBeNull();
    expect(rapporteurLoadCopy(null)).toBeNull();
    expect(rapporteurLoadCopy("5")).toBeNull();
    expect(rapporteurLoadCopy(NaN)).toBeNull();
  });

  it("carries the message keys and the raw load at/above threshold", () => {
    const copy = rapporteurLoadCopy(5)!;
    expect(copy.badgeKey).toBe("rapporteurBadge");
    expect(copy.detailKey).toBe("rapporteurDetail");
    // The count comes back RAW: the consumer formats it through lib/format.ts,
    // the app's single display-number authority, and passes it into the ICU
    // string already formatted. A module that formatted it here would be a
    // second formatter, and next-intl would be a third.
    expect(copy.load).toBe(5);
    expect(rapporteurLoadCopy(RAPPORTEUR_WORKHORSE_MIN)).not.toBeNull();
  });

  it("publishes exactly the keys it can emit", () => {
    const copy = rapporteurLoadCopy(RAPPORTEUR_WORKHORSE_MIN)!;
    expect([...RAPPORTEUR_COPY_KEYS].sort()).toEqual([copy.badgeKey, copy.detailKey].sort());
  });
});

/* The sentence moved to messages/{cs,en}.json (namespace `verdicts`, 2026-08-12):
 * it was a Czech literal built by string concatenation around the count, so an
 * English reader got a Czech verdict. The Czech language gate MOVED with it —
 * features/civicscore/messages.test.ts runs it over the cs catalog and holds both
 * catalogs to `RAPPORTEUR_COPY_KEYS`, including the `{load}` placeholder without
 * which the count would silently vanish from the sentence. */
