import { beforeAll, describe, expect, it } from "vitest";
import {
  extractOfficersAndShareholders,
  extractSpisovaZnacka,
  findRecordByIco,
  findRecordsByIcosInFile,
  legalFormSlugFromName,
  PRAVNI_FORMA_TO_SLUG,
  parseDataorCsv,
  parseUdaje,
  resolveCourtAndForm,
} from "@/lib/ingest/sources/dataor";

// Real udaje fragment for IČO 61858111 "PRaK, a.s. v likvidaci" (the batch-003/004 PRaK
// dead end this session's justice-sources-registry assessment solved) — captured live
// 2026-07-25, trimmed to the fields this module reads. Bendl's board-seat entry (with
// narozDatum, matching politicas' own roster birth date 1966-01-24 for pspId 346) is the
// load-bearing fixture: it is the exact record ARES REST 404s on.
const PRAK_UDAJE =
  "[" +
  "{hlavicka=Spisová značka;zapisDatum=1994-08-16;vymazDatum=2012-12-13;hodnotaText=B 2674/MSPH;" +
  "udajTyp={kod=SPIS_ZN;nazev=spisová značka};spisZn={soud={kod=MSPH;nazev=Městský soud v Praze};oddil=B;vlozka=2674}}, " +
  "{hlavicka=Obchodní firma;zapisDatum=1994-08-16;vymazDatum=2011-08-18;hodnotaText=PRaK, a.s.;" +
  "udajTyp={kod=NAZEV;nazev=název}}, " +
  "{hlavicka=Identifikační číslo;zapisDatum=1994-08-16;vymazDatum=2012-12-13;hodnotaText=61858111;" +
  "udajTyp={kod=ICO;nazev=identifikační číslo}}, " +
  "{hlavicka=člen představenstva;zapisDatum=1996-01-15;vymazDatum=2002-12-31;hodnotaText=AngazmaFyzicke;" +
  "hodnotaUdaje={T=F;textZaOsobu={};textZruseni={}};clenstviDo=1999-07-28;funkce=člen představenstva;" +
  "udajTyp={kod=STATUTARNI_ORGAN_CLEN;nazev=člen statutárního orgánu};" +
  "osoba={jmeno=Petr;prijmeni=Bendl;narozDatum=1966-01-24;titulPred=Ing.;stat={kod=cz;nazev=Česká republika}};" +
  "adresa={statNazev=Česká republika;obec=Kladno;ulice=Poděbradova;cisloText=909;okres=Kladno}}, " +
  "{hlavicka=člen představenstva;zapisDatum=1994-08-16;vymazDatum=1996-01-15;hodnotaText=AngazmaFyzicke;" +
  "hodnotaUdaje={T=F;textZaOsobu={};textZruseni={}};funkce=člen představenstva;" +
  "udajTyp={kod=STATUTARNI_ORGAN_CLEN;nazev=člen statutárního orgánu};" +
  "osoba={jmeno=Richard;prijmeni=Brabec;titulPred=Mgr.;stat={kod=cz;nazev=Česká republika}};" +
  "adresa={statNazev=Česká republika;obec=Kladno;ulice=Koperníkova;cisloText=2338}}, " +
  // Real dozorčí rada (supervisory board) entries, verbatim from the same live PRaK
  // record — these use udajTyp.kod=DOZORCI_RADA_CLEN, NOT STATUTARNI_ORGAN_CLEN. A
  // batch-006 Opus verification pass caught this extraction gap live: this exact
  // Brabec entry (birth-date-matched, 1966-07-05) was silently dropped before the fix.
  "{hlavicka=;zapisDatum=1994-08-16;vymazDatum=1995-04-21;hodnotaText=AngazmaFyzicke;" +
  "hodnotaUdaje={T=F;textZaOsobu={};textZruseni={}};udajTyp={kod=DOZORCI_RADA_CLEN;nazev=člen dozorčí rady};" +
  "osoba={jmeno=Petr;prijmeni=Bendl;titulPred=ing.;stat={kod=cz;nazev=Česká republika}};" +
  "adresa={statNazev=Česká republika - neztotožněno;obec=Kladno II - Kročehlavy;ulice=Vitry 2158}}, " +
  "{hlavicka=člen dozorčí rady;zapisDatum=2004-08-13;vymazDatum=2006-08-01;hodnotaText=AngazmaFyzicke;" +
  "hodnotaUdaje={T=F;textZaOsobu={};textZruseni={}};clenstviOd=2004-03-04;clenstviDo=2006-05-29;funkce=člen dozorčí rady;" +
  "udajTyp={kod=DOZORCI_RADA_CLEN;nazev=člen dozorčí rady};" +
  "osoba={jmeno=Richard;prijmeni=Brabec;narozDatum=1966-07-05;titulPred=Mgr.};" +
  "adresa={statNazev=Česká republika;obec=Kladno;ulice=Chodská;cisloText=627;psc=27201}}" +
  "]";

// The AngazmaPravnicke (corporate shareholder) example from the source assessment
// (docs/data-analysis/justice-sources-registry.md §"indirect-ownership") — a different
// a.s. than PRaK, sole-shareholder chain Corporate service a.s. → PF METAL CZ s.r.o.
const SHAREHOLDER_CHAIN_UDAJE =
  "[" +
  "{hlavicka=;zapisDatum=2017-06-10;hodnotaText=AngazmaPravnicke;" +
  "udajTyp={kod=AKCIONAR;nazev=jediný akcionář};osoba={nazev=PF METAL CZ s.r.o.;ico=3233618};" +
  "adresa={obec=Praha;ulice=Malostranské nám.}}, " +
  "{hlavicka=;zapisDatum=2015-04-28;vymazDatum=2017-06-10;hodnotaText=AngazmaPravnicke;" +
  "udajTyp={kod=AKCIONAR;nazev=jediný akcionář};osoba={nazev=Corporate service a.s.;ico=25454536};" +
  "adresa={obec=Litvínov}}" +
  "]";

describe("parseUdaje", () => {
  it("parses the real PRaK record into a JS array of objects", () => {
    const parsed = parseUdaje(PRAK_UDAJE);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(7);
    const spis = parsed[0] as Record<string, unknown>;
    expect(spis.hodnotaText).toBe("B 2674/MSPH");
    expect((spis.udajTyp as Record<string, unknown>).kod).toBe("SPIS_ZN");
  });

  it("preserves a literal comma inside a scalar value ('PRaK, a.s.')", () => {
    const parsed = parseUdaje(PRAK_UDAJE);
    const nameEntry = parsed[1] as Record<string, unknown>;
    expect(nameEntry.hodnotaText).toBe("PRaK, a.s.");
  });

  it("handles an empty object value ({})", () => {
    const parsed = parseUdaje(PRAK_UDAJE);
    const bendlEntry = parsed[3] as Record<string, unknown>;
    const hodnotaUdaje = bendlEntry.hodnotaUdaje as Record<string, unknown>;
    expect(hodnotaUdaje.textZaOsobu).toEqual({});
  });

  it("returns [] for empty/null input rather than throwing", () => {
    expect(parseUdaje("")).toEqual([]);
    expect(parseUdaje("   ")).toEqual([]);
  });

  it("does not throw on malformed input (recovers what it can)", () => {
    expect(() => parseUdaje("[{hlavicka=broken; udajTyp={kod=X")).not.toThrow();
  });
});

describe("extractOfficersAndShareholders", () => {
  it("extracts Bendl's board seat with birth date, matching the roster (1966-01-24)", () => {
    const officers = extractOfficersAndShareholders(parseUdaje(PRAK_UDAJE));
    const bendl = officers.find((o) => o.lastName === "Bendl");
    expect(bendl).toBeDefined();
    expect(bendl!.firstName).toBe("Petr");
    expect(bendl!.birthDate).toBe("1966-01-24");
    expect(bendl!.role).toBe("člen představenstva");
    expect(bendl!.kind).toBe("officer");
    expect(bendl!.validTo).toBe("1999-07-28"); // clenstviDo, NOT the record's own vymazDatum (2002-12-31)
  });

  it("extracts Brabec's 1994-1996 board seat with a null birth date (pre-2000s record, P36)", () => {
    const officers = extractOfficersAndShareholders(parseUdaje(PRAK_UDAJE));
    const brabec1996 = officers.find((o) => o.lastName === "Brabec" && o.validTo === "1996-01-15");
    expect(brabec1996).toBeDefined();
    expect(brabec1996!.birthDate).toBeNull();
    expect(brabec1996!.validFrom).toBe("1994-08-16");
    expect(brabec1996!.role).toBe("člen představenstva");
  });

  it("extracts DOZORCI_RADA_CLEN entries (a different udajTyp than STATUTARNI_ORGAN_CLEN) — regression for the batch-006 extraction gap", () => {
    const officers = extractOfficersAndShareholders(parseUdaje(PRAK_UDAJE));
    const dozorci = officers.filter((o) => o.role === "člen dozorčí rady");
    expect(dozorci.length).toBe(2);

    const bendlDozorci = dozorci.find((o) => o.lastName === "Bendl");
    expect(bendlDozorci).toBeDefined();
    expect(bendlDozorci!.validFrom).toBe("1994-08-16");
    expect(bendlDozorci!.validTo).toBe("1995-04-21");
    expect(bendlDozorci!.birthDate).toBeNull();

    // the load-bearing case: a birth-date-CONFIRMED dozorčí rada seat for Brabec that
    // the pre-fix extractor silently dropped entirely (only STATUTARNI_ORGAN_CLEN was
    // recognized) — this is exactly the kind of corroborating match the money loop's
    // ARES-VR discipline exists to catch, and it was invisible until this fix.
    const brabecDozorci = dozorci.find((o) => o.lastName === "Brabec");
    expect(brabecDozorci).toBeDefined();
    expect(brabecDozorci!.birthDate).toBe("1966-07-05");
    expect(brabecDozorci!.validFrom).toBe("2004-03-04"); // clenstviOd, not the record's own zapisDatum (2004-08-13)
    expect(brabecDozorci!.validTo).toBe("2006-05-29"); // clenstviDo, not the record's own vymazDatum (2006-08-01)
  });

  it("does not extract POCET_CLEN/VKLAD_CLEN as officer entries (same _CLEN suffix, different meaning)", () => {
    const withNoise = parseUdaje(
      "[{hlavicka=;udajTyp={kod=POCET_CLEN;nazev=počet členů};hodnotaText=3}, " +
      "{hlavicka=;udajTyp={kod=VKLAD_CLEN;nazev=vklad člena};hodnotaText=20000}]",
    );
    expect(extractOfficersAndShareholders(withNoise)).toEqual([]);
  });

  it("extracts a corporate (AngazmaPravnicke) shareholder chain with IČO, dated", () => {
    const entries = extractOfficersAndShareholders(parseUdaje(SHAREHOLDER_CHAIN_UDAJE));
    expect(entries.length).toBe(2);
    const current = entries.find((e) => e.validTo === null);
    expect(current?.companyName).toBe("PF METAL CZ s.r.o.");
    expect(current?.companyIco).toBe("3233618");
    expect(current?.kind).toBe("shareholder");
    const prior = entries.find((e) => e.validTo === "2017-06-10");
    expect(prior?.companyName).toBe("Corporate service a.s.");
    expect(prior?.companyIco).toBe("25454536");
  });
});

describe("extractSpisovaZnacka", () => {
  it("finds the SPIS_ZN entry's hodnotaText", () => {
    expect(extractSpisovaZnacka(parseUdaje(PRAK_UDAJE))).toBe("B 2674/MSPH");
  });
  it("returns null when absent", () => {
    expect(extractSpisovaZnacka(parseUdaje(SHAREHOLDER_CHAIN_UDAJE))).toBeNull();
  });
});

describe("parseDataorCsv", () => {
  const CSV =
    '"ico","nazev","udaje","vymazDatum","zapisDatum"\n' +
    `"61858111","PRaK, a.s. v likvidaci","${PRAK_UDAJE.replace(/"/g, '""')}","2012-12-13","1994-08-16"\n` +
    '"11827718","Svěřenský fond ve prospěch Tonda 06","[{hlavicka=x}]",,"2021-09-13"\n';

  it("parses the header + rows, un-escaping doubled quotes in the udaje field", () => {
    const rows = parseDataorCsv(CSV);
    expect(rows.length).toBe(2);
    expect(rows[0].ico).toBe("61858111");
    expect(rows[0].nazev).toBe("PRaK, a.s. v likvidaci");
    expect(rows[0].vymazDatum).toBe("2012-12-13");
    expect(rows[0].udajeRaw).toContain("PRaK, a.s.");
    // round-trips through parseUdaje cleanly
    const parsed = parseUdaje(rows[0].udajeRaw);
    expect(parsed.length).toBe(7);
  });

  it("treats an empty vymazDatum field as null (still-active entity)", () => {
    const rows = parseDataorCsv(CSV);
    expect(rows[1].vymazDatum).toBeNull();
  });

  it("returns [] for a header-only or empty CSV", () => {
    expect(parseDataorCsv('"ico","nazev","udaje","vymazDatum","zapisDatum"\n')).toEqual([]);
    expect(parseDataorCsv("")).toEqual([]);
  });
});

describe("findRecordByIco", () => {
  it("matches ignoring leading zeros", () => {
    const records = parseDataorCsv(
      '"ico","nazev","udaje","vymazDatum","zapisDatum"\n"00829838","X","[]",,"2000-01-01"\n',
    );
    expect(findRecordByIco(records, "829838")).toEqual(records[0]);
    expect(findRecordByIco(records, "00829838")).toEqual(records[0]);
    expect(findRecordByIco(records, "999999")).toBeNull();
  });
});

describe("legalFormSlugFromName", () => {
  it("recognizes s.r.o. and a.s. suffixes", () => {
    expect(legalFormSlugFromName("MIKI TRAVEL PRAGUE, spol. s r.o.")).toBe("sro");
    expect(legalFormSlugFromName("Pojišťovna VZP, a.s.")).toBe("as");
    expect(legalFormSlugFromName("HC Plzeň z.s.")).toBe("spolek");
    expect(legalFormSlugFromName("Nadační fond Českého rozhlasu")).toBe("nadf");
    expect(legalFormSlugFromName("Something Unrecognizable Ltd")).toBeNull();
  });
});

describe("resolveCourtAndForm", () => {
  it("resolves via spisovaZnacka when the VR sub-record carries one (MIKI TRAVEL PRAGUE shape)", () => {
    const guess = resolveCourtAndForm({
      pravniForma: "112",
      obchodniJmeno: "MIKI TRAVEL PRAGUE, spol. s r.o.",
      sidlo: { kodKraje: 19 },
      dalsiUdaje: [{ datovyZdroj: "vr", spisovaZnacka: "C 51716/MSPH", pravniForma: "112" }],
    });
    expect(guess).toEqual({ courtSlug: "praha", legalFormSlug: "sro", source: "spisova-znacka" });
  });

  it("falls back to kodKraje when no spisovaZnacka is present", () => {
    const guess = resolveCourtAndForm({ pravniForma: "121", sidlo: { kodKraje: 64 } });
    expect(guess).toEqual({ courtSlug: "brno", legalFormSlug: "as", source: "kraj-fallback" });
  });

  it("falls back to a name-heuristic legal form with no court when neither registry field is available", () => {
    const guess = resolveCourtAndForm({ obchodniJmeno: "Foo z.s." });
    expect(guess.source).toBe("name-heuristic");
    expect(guess.legalFormSlug).toBe("spolek");
    expect(guess.courtSlug).toBeNull();
  });

  it("returns fully unresolved rather than guessing when nothing is available", () => {
    const guess = resolveCourtAndForm({});
    expect(guess).toEqual({ courtSlug: null, legalFormSlug: null, source: "unresolved" });
  });
});

describe("PRAVNI_FORMA_TO_SLUG — both sides verified against their own source (money batch 017)", () => {
  // ARES code labels from the PravniForma číselník; dataor slugs from CKAN package_show
  // titles. The table this pins REPLACED one that was wrong in 9 of 11 rows, and every
  // wrong row could only ever answer "IČO not present" — indistinguishable from an honest
  // negative. These are the pairs that matter most to the money graph.
  it.each([
    ["301", "sp", "Státní podnik — was mapped from 325 (an organizační složka státu) to zvlastni_org"],
    ["117", "nad", "Nadace — the old table read 117 as komanditní"],
    ["205", "dr", "Družstvo — used to default to sro"],
    ["111", "vos", "Veřejná obchodní společnost"],
    ["113", "ks", "Společnost komanditní"],
    ["706", "spolek", "Spolek — nevlad_org is 'Mezinárodní nevládní organizace'"],
    ["331", "prisp", "Příspěvková organizace — was mapped from 801 (Obec) to po_zzz"],
    ["961", "sf", "Svěřenský fond — the AGROFERT post-2017 structure batch 006 thought unreachable"],
    ["801", "obec", "Obec"],
  ])("%s → %s (%s)", (code, slug) => {
    expect(PRAVNI_FORMA_TO_SLUG[code]).toBe(slug);
  });

  it("leaves 325 (organizační složka státu) unmapped — it is not in the OR at all", () => {
    expect(PRAVNI_FORMA_TO_SLUG["325"]).toBeUndefined();
  });

  it("does not map any ARES code to dataor's `nevlad_org` (international NGOs) or `zvlastni_org`", () => {
    expect(Object.values(PRAVNI_FORMA_TO_SLUG)).not.toContain("nevlad_org");
    expect(Object.values(PRAVNI_FORMA_TO_SLUG)).not.toContain("zvlastni_org");
  });

  it("resolves a státní podnik to the `sp` file, not to an honest-looking miss", () => {
    const guess = resolveCourtAndForm({ pravniForma: "301", obchodniJmeno: "Lesy České republiky, s.p.", sidlo: { kodKraje: 64 } });
    expect(guess.legalFormSlug).toBe("sp");
  });
});

describe("findRecordsByIcosInFile — the streaming finder (money batch 017)", () => {
  // Three rows; the middle one's `udaje` holds a QUOTED NEWLINE and an escaped quote — the
  // exact shapes that make "buffer ends in a newline" a false signal of row completeness.
  const csv =
    "ico,nazev,udaje,vymazDatum,zapisDatum\n" +
    '"00000001","Alfa","[{udajTyp={kod=SPIS_ZN};hodnotaText=C 1/MSPH}]",,"2001-01-01"\n' +
    '"00000002","Beta","[{udajTyp={kod=SPIS_ZN};hodnotaText=C 2\nsecond line ""quoted""}]",,"2002-02-02"\n' +
    '"00000003","Gama","[{udajTyp={kod=SPIS_ZN};hodnotaText=C 3/KSBR}]","2020-01-01","2003-03-03"\n';
  let path = "";
  beforeAll(async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "dataor-stream-"));
    path = join(dir, "x.csv");
    await writeFile(path, csv, "utf8");
  });

  it("finds every asked IČO in one pass, keyed by the caller's own strings", async () => {
    const found = await findRecordsByIcosInFile(path, ["00000001", "00000003"]);
    expect([...found.keys()].sort()).toEqual(["00000001", "00000003"]);
    expect(found.get("00000003")!.vymazDatum).toBe("2020-01-01");
  });

  it.each([1, 3, 7, 16, 64])("survives chunk boundaries everywhere (highWaterMark %i) — including inside a quoted newline", async (hwm) => {
    const found = await findRecordsByIcosInFile(path, ["2", "00000003"], { highWaterMark: hwm });
    expect(found.get("2")!.nazev).toBe("Beta");
    // The quoted newline and the doubled quote came through as DATA, not as a row break.
    expect(found.get("2")!.udajeRaw).toContain('C 2\nsecond line "quoted"');
    expect(found.get("00000003")!.nazev).toBe("Gama");
  });

  it("returns an empty map for an IČO that is not there — no partial-row guesses", async () => {
    const found = await findRecordsByIcosInFile(path, ["99999999"], { highWaterMark: 5 });
    expect(found.size).toBe(0);
  });
});
