import { describe, expect, it } from "vitest";

import { sliceCompanyId, sliceMoneyId, slicePersonId, sliceBillId, slicePartyId, sliceLawId } from "./stateSlice";
import {
  companyCaseFileHref,
  denikEntityHref,
  denikFactHref,
  sliceNodeEntityKey,
} from "./entityLinks";

describe("sliceNodeEntityKey", () => {
  it("translates the three node kinds that HAVE a public stream", () => {
    expect(sliceNodeEntityKey(slicePersonId(6881))).toBe("poslanec:6881");
    expect(sliceNodeEntityKey(sliceCompanyId("46347534"))).toBe("firma:46347534");
    expect(sliceNodeEntityKey(sliceBillId(58))).toBe("tisk:58");
  });

  it("treats the money node as the company it belongs to", () => {
    // The money band is the firm's own stripe in the picture, not a second entity.
    expect(sliceNodeEntityKey(sliceMoneyId("46347534"))).toBe(
      sliceNodeEntityKey(sliceCompanyId("46347534")),
    );
  });

  it("offers NO key for a kind no stream is keyed by", () => {
    // Withdrawing the affordance is the /schranka `obec:` precedent: never promise
    // a delivery nobody can make.
    expect(sliceNodeEntityKey(slicePartyId("ANO"))).toBeNull();
    expect(sliceNodeEntityKey(sliceLawId("urn:x"))).toBeNull();
    expect(sliceNodeEntityKey("v:12345")).toBeNull();
  });

  it("refuses an id the SAMPLE graph shapes — a sample key would be a fabrication", () => {
    // buildStateGraph() uses the same prefixes over invented identifiers:
    // `c:<tie index>` is not an IČO, `p:<mock id>` is not a mandate number.
    expect(sliceNodeEntityKey("c:3")).toBeNull();
    expect(sliceNodeEntityKey("c:0463475")).toBeNull(); // 7 digits — not canonical
    expect(sliceNodeEntityKey("p:mp-novak")).toBeNull();
    expect(sliceNodeEntityKey("p:")).toBeNull();
    expect(sliceNodeEntityKey("nonsense")).toBeNull();
  });
});

describe("denik addresses", () => {
  it("is the same address the schránka subscribes to", () => {
    expect(denikEntityHref("firma:46347534")).toBe("/denik?entita=firma%3A46347534");
  });

  it("adds the day anchor the deník itself builds, and only for a real day", () => {
    expect(denikFactHref("tisk:58", "2026-03-04")).toBe("/denik?entita=tisk%3A58#d-2026-03-04");
    expect(denikFactHref("tisk:58", null)).toBe("/denik?entita=tisk%3A58");
    expect(denikFactHref("tisk:58", "3062-01-01x")).toBe("/denik?entita=tisk%3A58");
  });
});

describe("companyCaseFileHref", () => {
  it("addresses the company's own case file, not the first MP tied to it", () => {
    expect(companyCaseFileHref(sliceCompanyId("46347534"))).toBe("/penize/firma/46347534");
    expect(companyCaseFileHref(sliceMoneyId("46347534"))).toBe("/penize/firma/46347534");
  });

  it("is null for anything that is not a firm with a canonical IČO", () => {
    expect(companyCaseFileHref(slicePersonId(6881))).toBeNull();
    expect(companyCaseFileHref("c:3")).toBeNull();
  });
});
