import { describe, expect, it } from "vitest";
import {
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
