import { describe, expect, it } from "vitest";
import {
  ownershipRecord,
  PRIVATE_LEGAL_FORMS,
  PUBLIC_LEGAL_FORMS,
  classifyPublicMandate,
  isPublicLegalForm,
  shareholdersFromVr,
  type Shareholder,
} from "./public-body";

const base = { ico: "12345678", name: "Test s.r.o.", vrRetrieved: true, shareholders: [] as Shareholder[] };

describe("isPublicLegalForm", () => {
  it("recognises verified public forms", () => {
    expect(isPublicLegalForm("804")).toBe(true); // kraj
    expect(isPublicLegalForm("801")).toBe(true); // obec
    expect(isPublicLegalForm("325")).toBe(true); // organizační složka státu
    expect(isPublicLegalForm("361")).toBe(true); // ČT
  });

  it("recognises ordinary business forms as not-public", () => {
    expect(isPublicLegalForm("112")).toBe(false); // s.r.o.
    expect(isPublicLegalForm("121")).toBe(false); // a.s.
  });

  it("returns null — never false — for a code in neither table", () => {
    expect(isPublicLegalForm("999")).toBeNull();
    expect(isPublicLegalForm(null)).toBeNull();
    expect(isPublicLegalForm("")).toBeNull();
  });
});

describe("classifyPublicMandate", () => {
  it("classifies a ministry by its own legal form", () => {
    const v = classifyPublicMandate({ ...base, ico: "00006947", name: "Ministerstvo financí", legalForm: "325" });
    expect(v.kind).toBe("public-body");
    expect(v.attributable).toBe(false);
  });

  it("THE BATCH-009 CASE: a kraj-owned a.s. is publicly owned, not private", () => {
    // Zdravotnický holding Královéhradeckého kraje a.s. — legal form 121 (a.s.), so the
    // old name-based test called it private and nearly hung 1.09 bn CZK on an MP.
    const v = classifyPublicMandate({
      ico: "25997556",
      name: "Zdravotnický holding Královéhradeckého kraje a.s.",
      legalForm: "121",
      vrRetrieved: true,
      shareholders: [{ ico: "70889546", name: "Královéhradecký kraj", legalForm: "804", current: true }],
    });
    expect(v.kind).toBe("publicly-owned");
    expect(v.attributable).toBe(false);
    expect(v.publicOwners.map((o) => o.name)).toEqual(["Královéhradecký kraj"]);
    expect(v.reason).toContain("Královéhradecký kraj");
  });

  it("ignores a public shareholder that is no longer current", () => {
    const v = classifyPublicMandate({
      ...base,
      legalForm: "121",
      shareholders: [{ ico: "70889546", name: "Královéhradecký kraj", legalForm: "804", current: false }],
    });
    expect(v.kind).toBe("private");
  });

  it("classifies a private company with only private owners as private", () => {
    const v = classifyPublicMandate({
      ...base,
      legalForm: "112",
      shareholders: [{ ico: "26185610", name: "AGROFERT, a.s.", legalForm: "121", current: true }],
    });
    expect(v.kind).toBe("private");
    expect(v.attributable).toBe(true);
  });

  it("returns unknown — not private — for an unrecognised legal form", () => {
    const v = classifyPublicMandate({ ...base, legalForm: "888" });
    expect(v.kind).toBe("unknown");
    expect(v.unknownCodes).toContain("888");
    expect(v.attributable).toBe(false);
  });

  it("returns unknown when the VR record could not be retrieved (absence is not evidence)", () => {
    const v = classifyPublicMandate({ ...base, legalForm: "112", vrRetrieved: false });
    expect(v.kind).toBe("unknown");
    expect(v.reason).toContain("nepřítomnost dat");
  });

  it("returns unknown when a current owner's form is unrecognised", () => {
    const v = classifyPublicMandate({
      ...base,
      legalForm: "112",
      shareholders: [{ ico: "111", name: "Neznámý subjekt", legalForm: "777", current: true }],
    });
    expect(v.kind).toBe("unknown");
    expect(v.unknownCodes).toContain("777");
  });

  it("a public own-form wins even when owners are private", () => {
    const v = classifyPublicMandate({
      ...base,
      legalForm: "801",
      shareholders: [{ ico: "26185610", name: "AGROFERT, a.s.", legalForm: "121", current: true }],
    });
    expect(v.kind).toBe("public-body");
  });
});

describe("shareholdersFromVr", () => {
  const vr = {
    zaznamy: [
      {
        akcionari: [
          {
            clenoveOrganu: [
              {
                datumZapisu: "2003-09-16",
                datumVymazu: "2008-02-15",
                pravnickaOsoba: { ico: "70889546", obchodniJmeno: "Královéhradecký kraj", pravniForma: "804" },
              },
              {
                datumZapisu: "2011-07-20",
                pravnickaOsoba: { ico: "70889546", obchodniJmeno: "Královéhradecký kraj", pravniForma: "804" },
              },
            ],
          },
        ],
        spolecnici: [
          {
            clenoveOrganu: [
              { pravnickaOsoba: { ico: "26185610", obchodniJmeno: "AGROFERT, a.s.", pravniForma: "121" } },
              // a natural-person member — out of scope for a PUBLIC-ownership question
              { fyzickaOsoba: { jmeno: "Jan", prijmeni: "Novák" } },
            ],
          },
        ],
      },
    ],
  };

  it("reads both `akcionari` and `spolecnici` (P35: several VR arrays are load-bearing)", () => {
    const rows = shareholdersFromVr(vr, "2026-07-27");
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toContain("AGROFERT, a.s.");
  });

  it("marks a deleted holding as not current and a live one as current", () => {
    const rows = shareholdersFromVr(vr, "2026-07-27");
    expect(rows[0].current).toBe(false);
    expect(rows[1].current).toBe(true);
  });

  it("skips natural persons", () => {
    const rows = shareholdersFromVr(vr, "2026-07-27");
    expect(rows.every((r) => r.name !== "Jan")).toBe(true);
  });

  it("returns [] for an empty or malformed VR payload rather than throwing", () => {
    expect(shareholdersFromVr(null, "2026-07-27")).toEqual([]);
    expect(shareholdersFromVr({}, "2026-07-27")).toEqual([]);
    expect(shareholdersFromVr({ zaznamy: [{}] }, "2026-07-27")).toEqual([]);
  });
});

describe("money batch 015 — silence is not evidence of private ownership", () => {
  const base = { ico: "60193913", name: "Pražská energetika, a.s.", legalForm: "121", shareholders: [], vrRetrieved: true };

  it("THE PRE CASE: a VR record naming NO current owner is not evidence of private ownership", () => {
    // Measured over the 57 attributable tied companies: 49 of 52 `private` verdicts
    // (18,05 mld. CZK — 98 % of the attributable money) rested on this silence. For an
    // akciová společnost, VR lists shareholders only in special circumstances, so the
    // absence says nothing at all — and Pražská energetika, whose VR names nobody, is
    // city-owned through a holding.
    const v = classifyPublicMandate({ ...base, ownersRecorded: 0 });
    expect(v.kind).toBe("ownership-not-published");
    // Still attributable: silence is not evidence of PUBLIC ownership either, and
    // withdrawing 18 mld. on an absence would be the same error pointed the other way.
    expect(v.attributable).toBe(true);
  });

  it("keeps `private` when the register DOES name a current owner and none is public", () => {
    const v = classifyPublicMandate({
      ...base,
      shareholders: [{ ico: "123", name: "Soukromá a.s.", legalForm: "121", current: true }],
      ownersRecorded: 1,
    });
    expect(v.kind).toBe("private");
    expect(v.attributable).toBe(true);
  });

  it("counts a CURRENT NATURAL person as a named owner — AGROFERT stays private", () => {
    // AGROFERT a.s.'s only current akcionář in VR is a natural person, which
    // `shareholdersFromVr` drops by design. If the count dropped it too, the largest
    // genuinely private company in the corpus would be filed as unverified.
    const v = classifyPublicMandate({ ...base, ico: "26185610", name: "AGROFERT, a.s.", ownersRecorded: 1 });
    expect(v.kind).toBe("private");
  });

  it("a caller that does not supply the count keeps the pre-batch-015 answer", () => {
    expect(classifyPublicMandate(base).kind).toBe("private");
  });

  it("a public owner still wins over the silence rule", () => {
    const v = classifyPublicMandate({
      ...base,
      shareholders: [{ ico: "44992785", name: "Statutární město Brno", legalForm: "801", current: true }],
      ownersRecorded: 1,
    });
    expect(v.kind).toBe("publicly-owned");
    expect(v.attributable).toBe(false);
  });
});

describe("ownershipRecord", () => {
  const vr = (members: unknown[]) => ({ zaznamy: [{ akcionari: [{ clenoveOrganu: members }] }] });

  it("counts natural persons that `shareholdersFromVr` drops", () => {
    const rec = ownershipRecord(vr([{ fyzickaOsoba: { jmeno: "X" } }]), "2026-08-22");
    expect(rec.legalPersons).toEqual([]);
    expect(rec.entriesTotal).toBe(1);
    expect(rec.entriesCurrent).toBe(1);
  });

  it("does not count an owner whose entry was deleted in the past", () => {
    const rec = ownershipRecord(
      vr([{ pravnickaOsoba: { ico: "1", obchodniJmeno: "Y", pravniForma: "121" }, datumVymazu: "2018-10-31" }]),
      "2026-08-22",
    );
    expect(rec.entriesTotal).toBe(1);
    expect(rec.entriesCurrent).toBe(0);
    expect(rec.legalPersons[0].current).toBe(false);
  });

  it("stays byte-compatible with shareholdersFromVr for legal persons", () => {
    const payload = vr([{ pravnickaOsoba: { ico: "1", obchodniJmeno: "Y", pravniForma: "801" } }]);
    expect(shareholdersFromVr(payload, "2026-08-22")).toEqual(ownershipRecord(payload, "2026-08-22").legalPersons);
  });
});

describe("money batch 016 — the legal-form tables are an assertion, not a guess", () => {
  it("no code sits in both tables", () => {
    const both = Object.keys(PUBLIC_LEGAL_FORMS).filter((c) => c in PRIVATE_LEGAL_FORMS);
    expect(both).toEqual([]);
  });

  it("every entry carries a label and a provenance note", () => {
    for (const [code, info] of [...Object.entries(PUBLIC_LEGAL_FORMS), ...Object.entries(PRIVATE_LEGAL_FORMS)]) {
      expect(info.label, `${code} label`).toBeTruthy();
      expect(info.verifiedVia, `${code} verifiedVia`).toBeTruthy();
    }
  });

  it("THE 771 DEFECT: a dobrovolný svazek obcí is a public body", () => {
    // The table said 771 was "Nadace" and filed it PRIVATE — i.e. it ASSERTED that a
    // public-law association of municipalities is not a public body. A svazek obcí is the
    // classic owner of a regional VaK water company, which this corpus is full of.
    expect(isPublicLegalForm("771")).toBe(true);
    expect(PUBLIC_LEGAL_FORMS["771"].label).toBe("Dobrovolný svazek obcí");
  });

  it("a státní podnik is a public body (301)", () => {
    // Lesy ČR s.p. and Povodí Labe s.p. contract heavily; their money is the state's.
    expect(isPublicLegalForm("301")).toBe(true);
  });

  it("an Evropské seskupení pro územní spolupráci is a public body (941)", () => {
    expect(isPublicLegalForm("941")).toBe(true);
  });

  it("741 (profesní komora) is in NEITHER table, so it reaches a human", () => {
    // Genuinely arguable — delegated public authority, funded by members' dues. This
    // table may not assert either way, and `unknown` is the honest answer.
    expect("741" in PUBLIC_LEGAL_FORMS).toBe(false);
    expect("741" in PRIVATE_LEGAL_FORMS).toBe(false);
    expect(isPublicLegalForm("741")).toBeNull();
  });

  it("the ordinary business forms the corpus actually contains stay private", () => {
    // Measured on the live store: every company node carries 112, 121 or 205.
    for (const code of ["112", "121", "205"]) expect(isPublicLegalForm(code)).toBe(false);
  });
});
