import { describe, expect, it } from "vitest";

import {
  classifyPosting,
  extractIcos,
  extractStatuteCitations,
  isValidIco,
  kioskDeskaUrl,
  parseInstitutions,
  parsePostings,
} from "./kiosek";

const prov = { source: "kiosek-uredni-deska", sourceUrl: "https://example.test", fetchedAt: "2026-07-25T00:00:00Z" };

describe("kioskDeskaUrl", () => {
  it("percent-encodes the Czech 'úřední_deska' path segment", () => {
    expect(kioskDeskaUrl("201000")).toBe(
      "https://kiosek.justice.cz/opendata/%C3%BA%C5%99edn%C3%AD_deska/201000.jsonld",
    );
  });
});

describe("parseInstitutions", () => {
  it("derives the dataset code from nazevSady, keeping ico/ovm", () => {
    const raw = [
      { nazev: "Městský soud v Praze", ico: "00215660", ovm: "https://…/00215660", nazevSady: "201000.jsonld" },
      { nazev: "no code here" }, // missing nazevSady/nazevData → dropped, not fabricated
    ];
    const rows = parseInstitutions(raw, prov);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nazev: "Městský soud v Praze", code: "201000", ico: "00215660" });
  });
});

describe("classifyPosting", () => {
  it("routes §106/1999 and Předseda soudu agendas to administrative regardless of title", () => {
    expect(classifyPosting("rozhodnutí - 6To 64/2018", ["Informace podle zák. 106/1999 Sb."])).toMatchObject({
      label: "administrative",
    });
    expect(classifyPosting("Rozvrh práce 2026", ["Předseda soudu"])).toMatchObject({ label: "administrative" });
  });

  it("routes 'Sdělení...' titles to boilerplate", () => {
    expect(classifyPosting("Sdělení pro vyvěšení na úřední desce soudu podle § 49 odst. 4 o.s.ř.", ["Obchodní"])).toMatchObject(
      { label: "boilerplate" },
    );
  });

  it("routes Usnesení/Rozsudek/Rozhodnutí/Veřejná vyhláška titles to substantive", () => {
    expect(classifyPosting("Usnesení o naříz. likvidace a jmen. likvidátora", ["Obchodní"])).toMatchObject({
      label: "substantive",
    });
    expect(classifyPosting("Rozsudek", ["Obchodní"])).toMatchObject({ label: "substantive" });
    expect(classifyPosting("Rozhodnutí VS o částečné změně", ["Obchodní"])).toMatchObject({ label: "substantive" });
    expect(classifyPosting("Veřejná vyhláška popisu věci - MSPH 89 INS 8392/2026-A-5", ["Občanskoprávní"])).toMatchObject(
      { label: "substantive" },
    );
  });

  it("falls back to unclassified for titles that match neither pattern nor an administrative agenda", () => {
    expect(classifyPosting("Rozvrh práce 2026", ["Obchodní"])).toMatchObject({ label: "unclassified" });
  });
});

describe("parsePostings", () => {
  it("parses a real-shaped informace[] item (the liquidation-order sample record)", () => {
    const raw = {
      informace: [
        {
          "vyvěšení": { typ: "Časový okamžik", "datum_a_čas": "2026-06-25T13:20:32.439493" },
          "spisová_značka": "70 Cm 1999/2026-3",
          dokument: [
            {
              typ: ["Digitální objekt"],
              url: "https://infodeska.gov.cz/eudpub/api/v1/vyveseni/soubor/15375249-738d-469d-b43a-994d87fd62f2/download",
              "název": { cs: "70Cm_1999_2026_2.pdf" },
            },
          ],
          agenda: [{ typ: "Agenda", "název": { cs: "Obchodní" } }],
          url: "https://infodeska.gov.cz/eudpub/uredni-deska/organizace/201000/vyveseni/9420213",
          iri: "https://data.justice.cz/zdroj/úřední_deska/00215660/vyveseni/9420213",
          "název": { cs: "Usnesení o naříz. likvidace a jmen. likvidátora" },
          "relevantní_do": { typ: "Časový okamžik", "datum_a_čas": "2026-07-25T18:00:00.641" },
        },
        {
          // a permanent posting: relevantní_do is the {nespecifikovaný:true} shape
          "spisová_značka": "S 1/2026",
          agenda: [{ "název": { cs: "Předseda soudu" } }],
          "název": { cs: "Rozvrh práce 2026" },
          "relevantní_do": { "nespecifikovaný": true },
        },
      ],
    };
    const rows = parsePostings(raw, "201000", prov);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "https://infodeska.gov.cz/eudpub/uredni-deska/organizace/201000/vyveseni/9420213",
      institutionCode: "201000",
      spisovaZnacka: "70 Cm 1999/2026-3",
      agendas: ["Obchodní"],
      classification: { label: "substantive" },
    });
    expect(rows[0].attachments).toEqual([
      {
        url: "https://infodeska.gov.cz/eudpub/api/v1/vyveseni/soubor/15375249-738d-469d-b43a-994d87fd62f2/download",
        nazev: "70Cm_1999_2026_2.pdf",
      },
    ]);
    expect(rows[1].removalUnspecified).toBe(true);
    expect(rows[1].removalAt).toBeNull();
    expect(rows[1].classification).toMatchObject({ label: "administrative" });
  });
});

describe("isValidIco", () => {
  it("accepts the two real IČOs from the cached liquidation-order sample", () => {
    expect(isValidIco("07043694")).toBe(true); // New Era Corporation s.r.o.
    expect(isValidIco("03007740")).toBe(true); // VPI CZ, v.o.s. (the r=1 edge case)
  });

  it("rejects a non-checksum-valid 8-digit run (e.g. a case-number-shaped number)", () => {
    expect(isValidIco("12345678")).toBe(false);
    expect(isValidIco("1234567")).toBe(false); // wrong length
    expect(isValidIco("abcdefgh")).toBe(false);
  });

  it("handles the r=0 edge case correctly (11 wraps to check digit 1, NOT 0 — batch-006 Opus-caught bug)", () => {
    // digits 1-7 all zero → sum=0 → r=0 → check digit must be 1 (11 mod 10).
    // A constructed test vector (not a real registered IČO) purely to pin
    // the r=0 branch, which the sample corpus never happened to exercise.
    expect(isValidIco("00000001")).toBe(true);
    expect(isValidIco("00000000")).toBe(false); // the same digits with the WRONG (pre-fix) check digit
  });
});

describe("extractStatuteCitations", () => {
  it("extracts and normalizes the five distinct statutes from the liquidation-order text", () => {
    const text =
      "podle § 25 odst. 1 písm. g) zák. č. 304/2013 Sb. ... § 172 odst. 1 " +
      "písm. c) a odst. 2 zákona č. 89/2012 Sb. ... zákona č. 90/2012 Sb. ... " +
      "§ 6, § 9 odst. 1, § 85 písm. a), § 89 odst. 1 z. č. 292/2013 Sb. ... " +
      "§ 2 odst. 1 písm. e) zákona č. 549/1991 Sb.";
    const out = extractStatuteCitations("posting-1", text);
    expect(out.map((c) => c.lawUrn).sort()).toEqual(
      ["law:sb:292-2013", "law:sb:304-2013", "law:sb:549-1991", "law:sb:89-2012", "law:sb:90-2012"].sort(),
    );
  });

  it("does not misparse a Sb. m. s. (international treaty) citation as a statute", () => {
    const out = extractStatuteCitations("posting-2", "podle čl. 5 č. 64/2017 Sb. m. s.");
    expect(out).toEqual([]);
  });

  it("does not misparse NSS/SDEU case-number cross-references as statute citations", () => {
    const out = extractStatuteCitations("posting-3", "viz NSS 1 Azs 174/2024-42 a SDEU C-753/23 Krasiliva");
    expect(out).toEqual([]);
  });

  it("does not misparse a 'Sb. NSS' case-law-reporter citation as a Sbírka-zákonů statute (batch-006 real find)", () => {
    // The exact string pulled from the cached asylum-judgment PDF (rozsudek1.pdf):
    // "rozsudku ze dne 3. 4. 2025, č. j. 1 Azs 174/2024 – 42, č. 4682/2025 Sb. NSS"
    const out = extractStatuteCitations(
      "posting-4",
      "rozsudku ze dne 3. 4. 2025, č. j. 1 Azs 174/2024 – 42, č. 4682/2025 Sb. NSS",
    );
    expect(out).toEqual([]);
  });

  it("still extracts a real statute citation immediately followed by unrelated prose", () => {
    const out = extractStatuteCitations("posting-5", "podle zákona č. 65/2022 Sb. (lex Ukrajina)");
    expect(out).toEqual([{ postingId: "posting-5", lawUrn: "law:sb:65-2022", citation: "65/2022" }]);
  });
});

describe("extractIcos", () => {
  it("extracts a labelled, checksum-valid IČO with its adjacent name context", () => {
    const text = "korporace: New Era Corporation s.r.o., IČO 07043694\nsídlem Ondříčkova 609/27, 130 00 Praha 3";
    const out = extractIcos("posting-1", text);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ico: "07043694", companyUrn: "company:ico:07043694" });
    expect(out[0].nameContext).toContain("New Era Corporation");
  });

  it("extracts both real IČOs from the liquidation order (company + liquidator)", () => {
    const text =
      "New Era Corporation s.r.o., IČO 07043694, s likvidací a jmenování likvidátora... " +
      "ustanovuje likvidátorem VPI CZ, v.o.s., IČO 03007740, se sídlem...";
    const out = extractIcos("posting-1", text);
    expect(out.map((m) => m.ico).sort()).toEqual(["03007740", "07043694"]);
  });

  it("does not extract an unlabelled 8-digit number even if it happens to be checksum-valid", () => {
    // 07043694 is checksum-valid but here it appears with no IČ/IČO label —
    // must not be picked up (avoids case-number/date false positives).
    const text = "spisová značka 07043694/2026 bez označení IČO";
    expect(extractIcos("posting-1", text)).toEqual([]);
  });

  it("rejects a labelled but checksum-invalid 8-digit run", () => {
    const text = "IČO 12345678";
    expect(extractIcos("posting-1", text)).toEqual([]);
  });

  it("flags a court-appointed liquidator's personal IČO via the birth-date clause (batch-006 Opus finding)", () => {
    const text = "se jmenuje JUDr. Patrik Graňák, IČO 72015594, narozen 1. 6. 1982, sídlem Svatováclavská";
    const out = extractIcos("posting-1", text);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ico: "72015594", personLikely: true });
  });

  it("does not flag an ordinary company IČO as personLikely", () => {
    const text = "korporace: New Era Corporation s.r.o., IČO 07043694\nsídlem Ondříčkova 609/27";
    const out = extractIcos("posting-1", text);
    expect(out[0].personLikely).toBe(false);
  });
});
