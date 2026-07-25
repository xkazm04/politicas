import { describe, expect, it } from "vitest";

import {
  classifyEmploymentCoi,
  isSelfReferentialOccupation,
  joinCandidatesToMps,
  parseCandidates,
  parseCsv,
  parsePartyLists,
  type CandidateRow,
} from "./volby";

describe("parseCsv", () => {
  it("splits semicolon-delimited rows and unquotes plain fields", () => {
    const body = 'a;b;c\n1;2;3\n';
    expect(parseCsv(body)).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps a delimiter that appears inside a quoted field literal (the Hřib case)", () => {
    // Real shape found in the live psrk.csv: POVOLANI free text containing `;`.
    const body = '1;"Zdeněk";"Hřib";"autor systému; hrdý obyvatel"\n';
    const rows = parseCsv(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(["1", "Zdeněk", "Hřib", "autor systému; hrdý obyvatel"]);
  });

  it("unescapes a doubled quote inside a quoted field", () => {
    const body = '1;"""Rebelové web"""\n';
    expect(parseCsv(body)[0]).toEqual(["1", '"Rebelové web"']);
  });
});

describe("parseCandidates", () => {
  const header =
    "VOLKRAJ;KSTRANA;PORCISLO;JMENO;PRIJMENI;TITULPRED;TITULZA;VEK;POVOLANI;BYDLISTEN;PSTRANA;NSTRANA;PLATNOST;POCHLASU;POCPROC;MANDAT;SKRUTINIUM;PORADIMAND;PORADINAHR";
  const body = [
    header,
    '10;22;3;"Josef";"Kott";"Ing.";"";54;"poslanec PSP ČR";"Olešná";768;768;"A";2026;1.94;"A";1;3;0',
    '1;11;3;"Jiří";"Pospíšil";"JUDr.";"";49;"právník";"Praha";721;721;"A";24552;11.36;"A";1;5;0',
  ].join("\n");

  it("parses typed candidate rows, resolving VOLKRAJ to a region name", () => {
    const rows = parseCandidates(body);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      fullName: "Josef Kott",
      volKraj: 10,
      volKrajName: "Vysočina",
      occupation: "poslanec PSP ČR",
      elected: true,
    });
    expect(rows[1]).toMatchObject({ fullName: "Jiří Pospíšil", occupation: "právník", elected: true });
  });

  it("skips the header and any blank trailing row", () => {
    expect(parseCandidates(`${body}\n\n`)).toHaveLength(2);
  });
});

describe("parsePartyLists", () => {
  it("parses the party/list registry keyed by the local KSTRANA id", () => {
    const body = 'KSTRANA;VSTRANA;NAZEVCELK;NAZEV_STRK;ZKRATKAK30;ZKRATKAK8\n1;1706;"Rebelové";"Rebelové";"Rebelové";"REB"\n';
    expect(parsePartyLists(body)).toEqual([{ kStrana: 1, nStrana: 1706, nameFull: "Rebelové", abbrev8: "REB" }]);
  });
});

describe("joinCandidatesToMps", () => {
  const cand = (fullName: string, volKrajName: string, extra: Partial<CandidateRow> = {}): CandidateRow => {
    const [firstName, ...rest] = fullName.split(" ");
    return {
      volKraj: null,
      volKrajName,
      kStrana: null,
      porCislo: null,
      firstName,
      lastName: rest.join(" "),
      fullName,
      titleBefore: null,
      titleAfter: null,
      age: null,
      occupation: "pedagog",
      residence: null,
      pStrana: null,
      nStrana: null,
      validRegistration: true,
      votes: null,
      votesPercent: null,
      elected: true,
      scrutiny: false,
      ...extra,
    };
  };

  it("matches an unambiguous full-name hit", () => {
    const candidates = [cand("Josef Kott", "Vysočina")];
    const mps = [{ pspId: 6246, name: "Josef Kott", region: "Vysočina" }];
    const [r] = joinCandidatesToMps(candidates, mps);
    expect(r.status).toBe("matched");
    expect(r.candidate?.fullName).toBe("Josef Kott");
  });

  it("disambiguates a same-name collision by region (the Zajíčková case)", () => {
    const candidates = [cand("Renáta Zajíčková", "Hlavní město Praha"), cand("Renáta Zajíčková", "Zlínský")];
    const mps = [{ pspId: 1, name: "Renáta Zajíčková", region: "Hlavní město Praha" }];
    const [r] = joinCandidatesToMps(candidates, mps);
    expect(r.status).toBe("matched");
    expect(r.candidate?.volKrajName).toBe("Hlavní město Praha");
  });

  it("flags a collision as ambiguous rather than silently picking one when region cannot resolve it", () => {
    const candidates = [cand("Jan Novák", "Vysočina"), cand("Jan Novák", "Zlínský")];
    const mps = [{ pspId: 2, name: "Jan Novák", region: null }];
    const [r] = joinCandidatesToMps(candidates, mps);
    expect(r.status).toBe("ambiguous");
    expect(r.candidate).toBeNull();
    expect(r.candidateMatches).toHaveLength(2);
  });

  it("resolves a same-region, same-surname tie by MANDAT (elected) when exactly one candidate won (the real 'Miroslav Krejčí' case)", () => {
    // Two "Miroslav Krejčí" candidacies both filed in Jihočeský on different
    // party lists — region alone cannot disambiguate; only one actually won.
    const candidates = [
      cand("Miroslav Krejčí", "Jihočeský", { elected: false, occupation: "učitel" }),
      cand("Miroslav Krejčí", "Jihočeský", { elected: true, occupation: "krizový manažer v oblasti školství" }),
    ];
    const mps = [{ pspId: 7016, name: "Miroslav Krejčí", region: "Jihočeský" }];
    const [r] = joinCandidatesToMps(candidates, mps);
    expect(r.status).toBe("matched");
    expect(r.candidate?.elected).toBe(true);
    expect(r.candidate?.occupation).toBe("krizový manažer v oblasti školství");
  });

  it("still flags ambiguous when the region+MANDAT tiebreak leaves more than one candidate", () => {
    const candidates = [
      cand("Jan Novák", "Vysočina", { elected: true }),
      cand("Jan Novák", "Vysočina", { elected: true }),
    ];
    const mps = [{ pspId: 3, name: "Jan Novák", region: "Vysočina" }];
    const [r] = joinCandidatesToMps(candidates, mps);
    expect(r.status).toBe("ambiguous");
  });

  it("reports no match rather than a false one when the MP is not in the registry at all", () => {
    const [r] = joinCandidatesToMps([cand("Josef Kott", "Vysočina")], [{ pspId: 9, name: "Nobody Here" }]);
    expect(r.status).toBe("unmatched");
    expect(r.candidateMatches).toHaveLength(0);
  });
});

describe("isSelfReferentialOccupation", () => {
  it("flags an incumbent's self-referential POVOLANI ('poslanec PSP ČR')", () => {
    expect(isSelfReferentialOccupation("poslanec PSP ČR")).toBe(true);
    expect(isSelfReferentialOccupation("ministryně obrany České republiky")).toBe(true);
  });

  it("does not flag a real outside occupation", () => {
    expect(isSelfReferentialOccupation("právník")).toBe(false);
    expect(isSelfReferentialOccupation(null)).toBe(false);
  });
});

describe("classifyEmploymentCoi", () => {
  it("fires when a real (non-self-referential) occupation stem-matches a committee the MP sits on", () => {
    const hits = classifyEmploymentCoi(1, "Test Farmář", "zemědělský podnikatel a agronom", [{ abbrev: "ZEV" }, { abbrev: "KV" }]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ sector: "agriculture", committee: "ZEV", onControlCommittee: true });
  });

  it("does NOT fire for Josef Kott's own PS2025 record — his POVOLANI is self-referential ('poslanec PSP ČR'), the structural blind spot this batch measured", () => {
    const hits = classifyEmploymentCoi(6246, "Josef Kott", "poslanec PSP ČR", [{ abbrev: "ZEV" }, { abbrev: "KV" }]);
    expect(hits).toHaveLength(0);
  });

  it("does not fire when the occupation sector has no matching committee membership", () => {
    const hits = classifyEmploymentCoi(2, "Test Lékař", "lékař", [{ abbrev: "ZEV" }]);
    expect(hits).toHaveLength(0);
  });

  it("uses a word-boundary stem match, never a bare substring (P42 lesson): 'nefinanční poradce' must not match the 'financn' stem", () => {
    // folded "nefinancni" contains the "financn" stem starting at index 2 — NOT
    // at a word boundary (it's the negation prefix "ne-" glued on). A bare
    // `.includes("financn")` would wrongly classify a NON-financial advisor as
    // a financial-sector tie — exactly the P42 "vydání"/"daní" collision class.
    const hits = classifyEmploymentCoi(3, "Test Substring", "nefinanční poradce", [{ abbrev: "RV" }]);
    expect(hits).toHaveLength(0);
  });

  it("does fire on a real word-initial stem match ('finanční poradce')", () => {
    const hits = classifyEmploymentCoi(4, "Test Finance", "finanční poradce", [{ abbrev: "RV" }]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ sector: "finance_budget", committee: "RV" });
  });
});
