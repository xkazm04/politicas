import { describe, expect, it } from "vitest";

import { buildMoneyGraph, moneyTrails } from "@/lib/analysis/kg-money";
import {
  aresSearchQuery,
  bridgePerson,
  bridgeSearchByBirthdate,
  buildPersonCompanyLinks,
  companyDonationsToParty,
  dedupeCompanies,
  enrichMoneyCompanies,
  foldLower,
  GENERIC_NAME_BLACKLIST,
  isGenericNameToken,
  isoDay,
  normalizeCompanyName,
  parseAresCompany,
  parseAresSearch,
  parseContracts,
  parseHlidacCompany,
  parsePersonSearch,
  parseSponsorship,
  parseSubsidies,
  pickExactIco,
  privateRoleEvents,
  subsidiesByCompany,
  type HlidacPersonDetail,
  type RosterPerson,
} from "@/lib/analysis/money-feed";

/* ── fixtures modeled on the REAL captured Hlídač / ARES shapes ──────────────── */

const babisDetail: HlidacPersonDetail = {
  jmeno: "Andrej",
  prijmeni: "Babiš",
  narozeni: "1954-09-02T00:00:00",
  nameId: "andrej-babis",
  udalosti: [
    { typ: "Soukromá pracovní", organizace: "AGROFERT, a.s.", role: "akcionář", datumOd: "2005-01-01T00:00:00", datumDo: "2017-01-01T00:00:00" },
    { typ: "Soukromá pracovní", organizace: "AGROFERT a.s.", role: "akcionář", datumOd: "2004-01-01T00:00:00", datumDo: "2005-01-01T00:00:00" }, // same ico+role → deduped
    { typ: "Soukromá pracovní", organizace: "SynBiol, a.s.", role: "akcionář", datumOd: "2008-01-01T00:00:00", datumDo: null }, // ongoing
    { typ: "Soukromá pracovní", organizace: "Neznámá firma, s.r.o.", role: "jednatel", datumOd: "2010-01-01T00:00:00", datumDo: null }, // resolver returns null → dropped
    { typ: "Politická", organizace: "Vláda ČR", role: "předseda vlády" }, // not a company tie → filtered
  ],
};

// AGROFERT resolves to one IČO; SynBiol to another; the unknown firm to nothing.
const ICO_AGROFERT = "26185610";
const ICO_SYNBIOL = "29148413";
const resolveIco = (name: string): string | null => {
  const key = normalizeCompanyName(name);
  if (key === "agrofert") return ICO_AGROFERT;
  if (key === "synbiol") return ICO_SYNBIOL;
  return null; // ARES could not resolve → the link is dropped, never invented
};

const contractSearch = {
  total: 3,
  page: 1,
  results: [
    {
      identifikator: { idSmlouvy: "580677", idVerze: "617873" },
      predmet: "Kupní smlouva-sójový šrot",
      hodnotaBezDph: 247250,
      hodnotaVcetneDph: null,
      calculatedPriceWithVATinCZK: 299172.5,
      datumUzavreni: "2016-11-21T00:00:00",
      platce: { ico: "62157124", nazev: "Veterinární a farmaceutická univerzita Brno" },
      prijemce: [{ ico: ICO_AGROFERT, nazev: "AGROFERT HOLDING, a.s." }],
    },
    {
      // older VERSION of the same contract → deduped away by idVerze
      identifikator: { idSmlouvy: "580677", idVerze: "600000" },
      predmet: "Kupní smlouva-sójový šrot (stará verze)",
      calculatedPriceWithVATinCZK: 111111,
      datumUzavreni: "2016-10-01T00:00:00",
      prijemce: [{ ico: ICO_AGROFERT }],
    },
    {
      // price undisclosed → amount null (never zero-faked); AGROFERT is the supplier
      identifikator: { idSmlouvy: "580900", idVerze: "620000" },
      predmet: "Rámcová dohoda",
      hodnotaBezDph: null,
      calculatedPriceWithVATinCZK: null,
      datumUzavreni: "2017-02-02T00:00:00",
      prijemce: [{ ico: ICO_AGROFERT }],
    },
    {
      // AGROFERT is only the PAYER here (buying) → excluded when scoped to supplier
      identifikator: { idSmlouvy: "999999", idVerze: "700000" },
      predmet: "Nákup",
      calculatedPriceWithVATinCZK: 5000,
      platce: { ico: ICO_AGROFERT },
      prijemce: [{ ico: "11111111", nazev: "Někdo jiný" }],
    },
  ],
};

const aresAgrofert = { ico: ICO_AGROFERT, obchodniJmeno: "AGROFERT HOLDING, a.s." };
const roster: RosterPerson[] = [
  { personPspId: 5878, firstName: "Andrej", lastName: "Babiš", birthDate: "1954-09-02" },
  { personPspId: 1, firstName: "Andrej", lastName: "Babiš", birthDate: "1990-01-01" }, // same name, different DOB — must NOT match
];

/* ── pure helpers ───────────────────────────────────────────────────────────── */

describe("pure helpers", () => {
  it("isoDay extracts the date; foldLower folds diacritics", () => {
    expect(isoDay("1954-09-02T00:00:00")).toBe("1954-09-02");
    expect(isoDay(null)).toBeNull();
    expect(foldLower("Babiš")).toBe("babis");
    expect(foldLower("  Řehoř  Čížek ")).toBe("rehor cizek");
  });
  it("normalizeCompanyName strips legal forms but keeps distinguishing words", () => {
    expect(normalizeCompanyName("AGROFERT, a.s.")).toBe("agrofert");
    expect(normalizeCompanyName("AGROFERT a.s.")).toBe("agrofert");
    expect(normalizeCompanyName("SynBiol, a.s.")).toBe("synbiol");
    // HOLDING is a distinguishing word, NOT a legal form — a different entity, kept
    expect(normalizeCompanyName("AGROFERT HOLDING, a.s.")).toBe("agrofert holding");
  });
});

/* ── parsers ────────────────────────────────────────────────────────────────── */

describe("parsers", () => {
  it("parsePersonSearch maps the hit fields", () => {
    const hits = parsePersonSearch([{ jmeno: "Andrej", prijmeni: "Babiš", narozeni: "1954-09-02T00:00:00", nameId: "andrej-babis" }]);
    expect(hits).toEqual([{ jmeno: "Andrej", prijmeni: "Babiš", narozeni: "1954-09-02T00:00:00", nameId: "andrej-babis" }]);
    expect(parsePersonSearch({})).toEqual([]);
  });

  it("privateRoleEvents keeps only company-tie events", () => {
    const ev = privateRoleEvents(babisDetail);
    expect(ev).toHaveLength(4); // the 4 Soukromá pracovní; the Politická one is dropped
    expect(ev.every((e) => e.typ === "Soukromá pracovní")).toBe(true);
  });

  it("parseContracts scopes to supplier, dedupes by latest version, never zero-fakes price", () => {
    const contracts = parseContracts(contractSearch, { supplierIco: ICO_AGROFERT });
    // 580677 (deduped to latest version) + 580900; 999999 excluded (AGROFERT is payer there)
    expect(contracts.map((c) => c.id).sort()).toEqual(["580677", "580900"]);
    const c580677 = contracts.find((c) => c.id === "580677")!;
    expect(c580677.amount).toBe(299172.5); // latest version's price, not the older 111111
    expect(c580677.supplierIco).toBe(ICO_AGROFERT);
    expect(c580677.subject).toBe("Kupní smlouva-sójový šrot");
    expect(contracts.find((c) => c.id === "580900")!.amount).toBeNull(); // undisclosed stays null
  });

  it("parseAresCompany / parseHlidacCompany extract {ico,name} or null", () => {
    expect(parseAresCompany(aresAgrofert)).toEqual({ ico: ICO_AGROFERT, name: "AGROFERT HOLDING, a.s." });
    expect(parseAresCompany({ ico: ICO_AGROFERT })).toBeNull(); // missing name
    expect(parseHlidacCompany({ ico: "123", jmeno: "Foo s.r.o." })).toEqual({ ico: "123", name: "Foo s.r.o." });
  });
});

describe("pickExactIco — strict name→IČO (never guesses)", () => {
  const candidates = parseAresSearch({
    ekonomickeSubjekty: [
      { ico: "26185610", obchodniJmeno: "AGROFERT HOLDING, a.s." },
      { ico: "48136450", obchodniJmeno: "AGROFERT, a.s." },
    ],
  });
  it("resolves only on an exact normalized-name match", () => {
    // "AGROFERT, a.s." → key "agrofert" → the a.s. entity, NOT the HOLDING one
    expect(pickExactIco("AGROFERT, a.s.", candidates)).toBe("48136450");
    // "AGROFERT HOLDING" is a distinct key → its own entity
    expect(pickExactIco("AGROFERT HOLDING a.s.", candidates)).toBe("26185610");
  });
  it("returns null when no candidate matches exactly (drops, never guesses)", () => {
    expect(pickExactIco("Agrofert Trading s.r.o.", candidates)).toBeNull();
    expect(pickExactIco("AGROFERT", [{ ico: "1", obchodniJmeno: "AGROFERT HOLDING, a.s." }])).toBeNull();
  });
  it("returns null on ambiguity (two exact matches)", () => {
    expect(
      pickExactIco("Foo, a.s.", parseAresSearch({ ekonomickeSubjekty: [{ ico: "1", obchodniJmeno: "Foo a.s." }, { ico: "2", obchodniJmeno: "Foo, a.s." }] })),
    ).toBeNull();
  });

  // Pass-21 / C10 regression: IČO 04627695 (Agrární demokratická strana) has ARES
  // obchodniJmeno literally "OSVČ" — an MP's private-role occupation "OSVČ" must NEVER
  // exact-match it (this created 49 false linked_to edges before the blacklist fix).
  it("never resolves a GENERIC_NAME_BLACKLIST token, even with a real ARES candidate of that exact name (OSVČ regression, C10/pass 21)", () => {
    expect(GENERIC_NAME_BLACKLIST).toContain("OSVČ");
    const osvcCandidates = parseAresSearch({
      ekonomickeSubjekty: [{ ico: "04627695", obchodniJmeno: "OSVČ" }],
    });
    // Query name comes straight from the MP's private-role event.organizace text.
    expect(pickExactIco("OSVČ", osvcCandidates)).toBeNull();
    // Case/diacritic-insensitive and whitespace-padded variants must also be rejected.
    expect(pickExactIco("osvč", osvcCandidates)).toBeNull();
    expect(pickExactIco("  OSVC  ", osvcCandidates)).toBeNull();
    expect(isGenericNameToken("OSVČ")).toBe(true);
    expect(isGenericNameToken("osvc")).toBe(true);
    expect(isGenericNameToken("AGROFERT, a.s.")).toBe(false);
  });
});

/* ── identity bridge (conservative) ─────────────────────────────────────────── */

describe("bridgePerson", () => {
  it("matches on name AND exact birth date, refusing same-name different-DOB", () => {
    expect(bridgePerson(babisDetail, roster)).toEqual({ personPspId: 5878, matchedOn: "birthdate" });
  });
  it("returns null when the birth date is unavailable (cannot confirm)", () => {
    expect(bridgePerson({ jmeno: "Andrej", prijmeni: "Babiš" }, roster)).toBeNull();
  });
  it("returns null on ambiguity (two roster people, same name+DOB)", () => {
    const dupes: RosterPerson[] = [
      { personPspId: 10, firstName: "Andrej", lastName: "Babiš", birthDate: "1954-09-02" },
      { personPspId: 11, firstName: "Andrej", lastName: "Babiš", birthDate: "1954-09-02" },
    ];
    expect(bridgePerson(babisDetail, dupes)).toBeNull();
  });
});

describe("bridgeSearchByBirthdate — robust to mojibaked ftx names", () => {
  // ftx returns clean narozeni + nameId but double-encoded names
  const hits = parsePersonSearch([
    { jmeno: "Andrej", prijmeni: "BabiÅ¡", narozeni: "1954-09-02T00:00:00", nameId: "andrej-babis" },
    { jmeno: "Andrej", prijmeni: "BabiÅ¡", narozeni: "1970-01-01T00:00:00", nameId: "andrej-babis-2" },
  ]);
  it("picks the slug by unique birth date, ignoring the corrupted name", () => {
    expect(bridgeSearchByBirthdate(hits, "1954-09-02")).toBe("andrej-babis");
    expect(bridgeSearchByBirthdate(hits, "1970-01-01")).toBe("andrej-babis-2");
  });
  it("returns null with no birth date or no unique match", () => {
    expect(bridgeSearchByBirthdate(hits, null)).toBeNull();
    expect(bridgeSearchByBirthdate(hits, "1999-12-31")).toBeNull();
  });
});

/* ── the gate: gated link builder ───────────────────────────────────────────── */

describe("buildPersonCompanyLinks — the human gate", () => {
  it("resolves names to IČO, DROPS the unresolved, and marks every link pending_review", () => {
    const links = buildPersonCompanyLinks(babisDetail, 5878, { resolveIco });
    // AGROFERT (deduped across two spellings) + SynBiol; "Neznámá firma" dropped (unresolved)
    expect(links.map((l) => l.ico).sort()).toEqual([ICO_AGROFERT, ICO_SYNBIOL].sort());
    expect(links.every((l) => l.state === "pending_review")).toBe(true);
    expect(links.every((l) => l.personPspId === 5878)).toBe(true);
    const agro = links.find((l) => l.ico === ICO_AGROFERT)!;
    expect(agro.role).toBe("akcionář");
    expect(agro.source).toContain("hlidac:osoby/andrej-babis");
    expect(agro.source).toContain(`IČO ${ICO_AGROFERT}`);
  });

  it("corroboration annotates provenance but NEVER auto-verifies", () => {
    const corroborate = (_p: number, ico: string) => ico === ICO_AGROFERT;
    const links = buildPersonCompanyLinks(babisDetail, 5878, { resolveIco, corroborate });
    const agro = links.find((l) => l.ico === ICO_AGROFERT)!;
    expect(agro.source).toContain("ARES-VR-officer-confirmed");
    expect(agro.state).toBe("pending_review"); // still gated
  });
});

/* ── money dimensions: subsidies (dotace) + party donations (sponzoring) ────── */

describe("aresSearchQuery — strip legal form for recall", () => {
  it("strips a trailing legal form, keeps distinguishing words", () => {
    expect(aresSearchQuery("AGROFERT, a.s.")).toBe("AGROFERT");
    expect(aresSearchQuery("SynBiol, a.s.")).toBe("SynBiol");
    expect(aresSearchQuery("AGROFERT HOLDING, a.s.")).toBe("AGROFERT HOLDING");
    expect(aresSearchQuery("Nadační fond")).toBe("Nadační fond"); // no legal form → unchanged
  });
});

describe("subsidies (dotace)", () => {
  const dotace = {
    total: 2,
    results: [
      { id: "Cedr-aaa", recipient: { ico: "26185610" }, subsidyAmount: 9600, payedAmount: 9600, approvedYear: 2000, subsidyProvider: "MZe" },
      { id: "Cedr-bbb", recipient: { ico: "26185610" }, subsidyAmount: null, payedAmount: 50000, approvedYear: 2015, subsidyProvider: "MPO" },
      { id: "Cedr-ccc", recipient: { ico: "99999999" }, subsidyAmount: 1000, approvedYear: 2019, subsidyProvider: "X" },
    ],
  };
  it("parses recipient IČO + amount (subsidyAmount, fallback payedAmount), filters by IČO", () => {
    const subs = parseSubsidies(dotace, { recipientIco: "26185610" });
    expect(subs.map((s) => s.recipientIco)).toEqual(["26185610", "26185610"]);
    expect(subs.map((s) => s.amount)).toEqual([9600, 50000]);
    const agg = subsidiesByCompany(subs);
    expect(agg.get("26185610")).toEqual({ total: 59600, count: 2, undisclosedCount: 0 });
  });

  it("tracks undisclosed amounts separately instead of folding them into the total as 0", () => {
    const subs = [
      { id: "a", recipientIco: "26185610", amount: 9600, year: 2020, provider: null },
      { id: "b", recipientIco: "26185610", amount: null, year: 2021, provider: null },
    ];
    const agg = subsidiesByCompany(subs);
    expect(agg.get("26185610")).toEqual({ total: 9600, count: 2, undisclosedCount: 1 });
  });
});

describe("party donations (sponzoring) — the accountability triangle", () => {
  const donors = [
    { icoDarce: "26185610", nameIdDarce: null, icoPrijemce: "71443339", hodnotaDaru: 1000000, darovanoDne: "2016-01-01T00:00:00" },
    { icoDarce: "26185610", nameIdDarce: null, icoPrijemce: "71443339", hodnotaDaru: 500000, darovanoDne: "2017-01-01T00:00:00" },
    { icoDarce: "11111111", nameIdDarce: null, icoPrijemce: "71443339", hodnotaDaru: 999, darovanoDne: "2016-01-01T00:00:00" },
    { icoDarce: null, nameIdDarce: "some-person", icoPrijemce: "71443339", hodnotaDaru: 200, darovanoDne: "2016-01-01T00:00:00" },
  ];
  it("keeps only donations from the MP's linked companies", () => {
    const donations = parseSponsorship(donors);
    expect(donations).toHaveLength(4);
    const triangle = companyDonationsToParty(donations, new Set(["26185610"]));
    expect(triangle.get("26185610")).toEqual({ total: 1500000, count: 2 });
    expect(triangle.has("11111111")).toBe(false); // not a linked company
  });
});

describe("enrichMoneyCompanies", () => {
  it("folds subsidy + donation aggregates into company node props", () => {
    const links = buildPersonCompanyLinks(babisDetail, 5878, { resolveIco });
    const g0 = buildMoneyGraph(links, dedupeCompanies([parseAresCompany(aresAgrofert)!]), parseContracts(contractSearch, { supplierIco: ICO_AGROFERT }));
    const g = enrichMoneyCompanies(g0, {
      subsidies: new Map([[ICO_AGROFERT, { total: 59600, count: 2 }]]),
      donations: new Map([[ICO_AGROFERT, { total: 1500000, count: 2 }]]),
      donationPartyLabel: "ANO",
    });
    const company = g.nodes.find((n) => n.kind === "company")!;
    expect(company.props.subsidies_total_czk).toBe(59600);
    expect(company.props.donated_to_party_czk).toBe(1500000);
    expect(company.props.donation_recipient_party).toBe("ANO");
    // contract money still intact
    expect(g.edges.filter((e) => e.rel === "supplies")).toHaveLength(2);
  });
});

/* ── end-to-end: pure feed → buildMoneyGraph → traversable trail ────────────── */

describe("integration: feed → money graph → trail", () => {
  it("forms a real MP → company → contract trail, fully pending review", () => {
    const bridge = bridgePerson(babisDetail, roster)!;
    const links = buildPersonCompanyLinks(babisDetail, bridge.personPspId, { resolveIco });
    const companies = dedupeCompanies([parseAresCompany(aresAgrofert)!]); // only AGROFERT resolved to a Company
    const contracts = parseContracts(contractSearch, { supplierIco: ICO_AGROFERT });

    const g = buildMoneyGraph(links, companies, contracts);

    // AGROFERT company node + its 2 contracts; SynBiol link has no Company → not graphed
    expect(g.stats.companies).toBe(1);
    expect(g.stats.contracts).toBe(2);
    expect(g.stats.supplies).toBe(2);
    expect(g.stats.linked_to).toBe(1); // only the AGROFERT link lands (SynBiol company unknown)
    expect(g.stats.verified).toBe(0);
    expect(g.stats.pending_review).toBe(1);

    const trails = moneyTrails(g, links);
    const babis = trails.find((t) => t.personPspId === 5878)!;
    expect(babis.contractCount).toBe(2);
    expect(babis.totalAmount).toBe(299172.5); // the one disclosed price; the null one adds 0
    expect(babis.fullyVerified).toBe(false); // the gate propagates — nothing is presented as fact
  });
});
