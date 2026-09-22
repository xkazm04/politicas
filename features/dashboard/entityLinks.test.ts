import { describe, expect, it } from "vitest";

import { sliceCompanyId, sliceMoneyId, slicePersonId, sliceBillId, slicePartyId, sliceLawId } from "./stateSlice";
// `companyCaseFileHref` was removed 2026-09-06: zero consumers outside this test (grep over
// app/, features/, lib/); the company node's href is built once, in stateSlice.ts.
import { denikEntityHref, denikFactHref, sliceNodeEntityKey } from "./entityLinks";

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

  it("zero and a zero-padded number are not ids — the header promises a POSITIVE integer (2026-09-08)", () => {
    // `p:007` would have become `poslanec:7`, a DIFFERENT entity than the id names;
    // `p:0` is no mandate at all. Neither is ever built by stateSlice, so refusing
    // them costs nothing and the rule matches its own documentation.
    expect(sliceNodeEntityKey("p:0")).toBeNull();
    expect(sliceNodeEntityKey("p:007")).toBeNull();
    expect(sliceNodeEntityKey("b:0")).toBeNull();
    expect(sliceNodeEntityKey("b:058")).toBeNull();
    expect(sliceNodeEntityKey(slicePersonId(7))).toBe("poslanec:7");
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

