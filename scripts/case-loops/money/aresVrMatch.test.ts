import { describe, expect, it } from "vitest";
import { findMatches, mergeMatches, type VrZaznam } from "./aresVrMatch";

const BD = "1966-07-05";
const rec: VrZaznam = {
  primarniZaznam: true,
  statutarniOrgany: [
    {
      clenoveOrganu: [
        { fyzickaOsoba: { datumNarozeni: BD }, clenstvi: { funkce: { nazev: "člen představenstva", vznikFunkce: "2004-03-04", zanikFunkce: "2006-05-29" } } },
        { fyzickaOsoba: { datumNarozeni: "1950-01-01" }, clenstvi: { funkce: { nazev: "předseda" } } },
      ],
    },
  ],
  ostatniOrgany: [
    { clenoveOrganu: [{ fyzickaOsoba: { datumNarozeni: BD }, datumZapisu: "2010-01-01", clenstvi: { funkce: { nazev: "člen dozorčí rady" } } }] },
  ],
  spolecnici: [
    {
      spolecnik: [
        {
          datumZapisu: "2001-05-05",
          osoba: { fyzickaOsoba: { datumNarozeni: BD } },
          podil: [{ datumVymazu: "2003-01-01", velikostPodilu: { typObnos: "PROCENTA", hodnota: "10" } }, { velikostPodilu: { typObnos: "PROCENTA", hodnota: "50,5" } }],
        },
      ],
    },
  ],
};

describe("findMatches (exact birth-date hinge over statutární + ostatní orgány + společníci)", () => {
  const m = findMatches(rec, BD);
  it("collects every entry of the person and none of anyone else", () => {
    expect(m).toHaveLength(3);
    expect(m.map((x) => x.kind)).toEqual(["officer", "officer", "shareholder"]);
  });
  it("prefers the function's own dates and falls back to the register entry's", () => {
    expect(m[0]).toMatchObject({ validFrom: "2004-03-04", validTo: "2006-05-29" });
    expect(m[1]).toMatchObject({ functionName: "člen dozorčí rady", validFrom: "2010-01-01", validTo: null });
  });
  it("reads the ACTIVE stake with a Czech decimal comma", () => {
    expect(m[2]).toMatchObject({ kind: "shareholder", functionName: "společník", stakePct: 50.5 });
  });
  it("returns nothing for a birth date the record does not carry", () => {
    expect(findMatches(rec, "1999-12-31")).toEqual([]);
  });
});

describe("mergeMatches", () => {
  it("earliest start, ongoing wins over any end, distinct roles, first stake", () => {
    expect(mergeMatches(findMatches(rec, BD))).toEqual({
      validFrom: "2001-05-05",
      validTo: null,
      stakePct: 50.5,
      roles: ["člen představenstva", "člen dozorčí rady", "společník"],
    });
  });
  it("latest end when every entry has ended", () => {
    const ended = findMatches(rec, BD).map((x) => ({ ...x, validTo: x.validTo ?? "2012-12-13" }));
    expect(mergeMatches(ended).validTo).toBe("2012-12-13");
  });
});
