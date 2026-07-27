import { describe, expect, it } from "vitest";
import {
  decodeXml,
  directionFor,
  parseDump,
  parseDumpIndex,
  parseDumpRecord,
  splitRecords,
} from "./smlouvy-dump";

/** Verbatim from dump_2017_03.xml — the record that proved `idSmlouvy` is the graph key
 *  (graph node `contract:1443766` = "Mořidla", AGROFERT, signedOn 2017-03-08). */
const MORIDLA = `<zaznam><identifikator><idSmlouvy>1443766</idSmlouvy><idVerze>1559694</idVerze></identifikator><odkaz>https://smlouvy.gov.cz/smlouva/1559694</odkaz><casZverejneni>2017-03-27T18:01:47+02:00</casZverejneni><smlouva><subjekt><datovaSchranka>ugbaiq7</datovaSchranka><nazev>Ústřední kontrolní a zkušební ústav zemědělský</nazev><ico>00020338</ico><adresa>Hroznová 63/2, 60300 Brno, CZ</adresa></subjekt><smluvniStrana><datovaSchranka>xftccth</datovaSchranka><nazev>AGROFERT, a.s.</nazev><ico>26185610</ico><adresa>Pyšelská 2327/2, Chodov, 14900, Praha 4</adresa><prijemce>1</prijemce></smluvniStrana><predmet>Mořidla</predmet><datumUzavreni>2017-03-08</datumUzavreni><hodnotaVcetneDph>152000</hodnotaVcetneDph></smlouva><prilohy><priloha><nazevSouboru>AGROFERT_objednávka.pdf</nazevSouboru></priloha></prilohy><platnyZaznam>1</platnyZaznam></zaznam>`;

/** Verbatim shape from dump_2026_07_07.xml — publisher flagged as plátce, counterparty
 *  carrying no flag at all. */
const PLATCE_ON_PUBLISHER = `<zaznam><identifikator><idSmlouvy>36325448</idSmlouvy><idVerze>38655952</idVerze></identifikator><casZverejneni>2026-07-07T05:39:54+02:00</casZverejneni><smlouva><subjekt><nazev>Krajská nemocnice T. Bati, a. s.</nazev><ico>27661989</ico><platce>1</platce></subjekt><smluvniStrana><nazev>MEDITRADE spol. s r. o.</nazev><ico>48390186</ico></smluvniStrana><predmet>Objednávka OZL/SZM/26/21035</predmet><datumUzavreni>2026-06-30</datumUzavreni><hodnotaBezDph>80086.95</hodnotaBezDph></smlouva><platnyZaznam>1</platnyZaznam></zaznam>`;

const SUPERSEDED = `<zaznam><identifikator><idSmlouvy>999</idSmlouvy><idVerze>1000</idVerze></identifikator><smlouva><subjekt><nazev>X</nazev><ico>00020338</ico></subjekt><predmet>stará verze</predmet></smlouva><platnyZaznam>0</platnyZaznam></zaznam>`;

const FOREIGN = `<zaznam><identifikator><idSmlouvy>555</idSmlouvy><idVerze>556</idVerze></identifikator><smlouva><subjekt><nazev>Y</nazev><ico>00020338</ico></subjekt><smluvniStrana><nazev>Z</nazev><ico>26185610</ico></smluvniStrana><predmet>zahraniční</predmet><ciziMena><mena>EUR</mena><hodnota>12345.5</hodnota></ciziMena></smlouva><platnyZaznam>1</platnyZaznam></zaznam>`;

describe("parseDumpRecord", () => {
  it("parses the real Mořidla record, keying on idSmlouvy not idVerze", () => {
    const r = parseDumpRecord(MORIDLA)!;
    expect(r.idSmlouvy).toBe("1443766");
    expect(r.idVerze).toBe("1559694");
    // The web URL carries idVerze — keying a re-ingest on it would duplicate the corpus.
    expect(r.odkaz).toContain("1559694");
    expect(r.predmet).toBe("Mořidla");
    expect(r.datumUzavreni).toBe("2017-03-08");
    expect(r.hodnotaVcetneDph).toBe(152_000);
    expect(r.hodnotaBezDph).toBeNull();
    expect(r.platnyZaznam).toBe(true);
    expect(r.subjekt?.ico).toBe("00020338");
    expect(r.smluvniStrany.map((s) => s.ico)).toEqual(["26185610"]);
  });

  it("drops personal-data-adjacent fields (adresa, datovaSchranka, schvalil) at parse time", () => {
    const r = parseDumpRecord(MORIDLA)!;
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain("Hroznová");
    expect(serialized).not.toContain("ugbaiq7");
    expect(serialized).not.toContain("Pyšelská");
  });

  it("never coerces a missing value to zero", () => {
    const r = parseDumpRecord(SUPERSEDED)!;
    expect(r.hodnotaBezDph).toBeNull();
    expect(r.hodnotaVcetneDph).toBeNull();
    expect(r.ciziMena).toBeNull();
    expect(r.datumUzavreni).toBeNull();
  });

  it("keeps a foreign-currency value in its own field, never converted to CZK", () => {
    const r = parseDumpRecord(FOREIGN)!;
    expect(r.ciziMena).toEqual({ mena: "EUR", hodnota: 12_345.5 });
    expect(r.hodnotaBezDph).toBeNull();
    expect(r.hodnotaVcetneDph).toBeNull();
  });

  it("marks a superseded version so counts can exclude it", () => {
    expect(parseDumpRecord(SUPERSEDED)!.platnyZaznam).toBe(false);
  });

  it("returns null for a block with no idSmlouvy rather than inventing one", () => {
    expect(parseDumpRecord("<zaznam><smlouva><predmet>x</predmet></smlouva></zaznam>")).toBeNull();
  });
});

describe("directionFor", () => {
  it("reads an explicit prijemce flag on our own side", () => {
    expect(directionFor("26185610", parseDumpRecord(MORIDLA)!)).toBe("recipient");
  });

  it("infers recipient when the ONLY other side of a two-party contract is the plátce", () => {
    // The company carries no flag; the publisher is flagged plátce.
    expect(directionFor("48390186", parseDumpRecord(PLATCE_ON_PUBLISHER)!)).toBe("recipient");
  });

  it("reads our own side as payer when we are the flagged plátce", () => {
    expect(directionFor("27661989", parseDumpRecord(PLATCE_ON_PUBLISHER)!)).toBe("payer");
  });

  it("returns unknown when no side is flagged — never a guess", () => {
    expect(directionFor("26185610", parseDumpRecord(FOREIGN)!)).toBe("unknown");
  });

  it("returns unknown for an IČO that is not a party at all", () => {
    expect(directionFor("99999999", parseDumpRecord(MORIDLA)!)).toBe("unknown");
  });
});

describe("parseDump", () => {
  const body = MORIDLA + PLATCE_ON_PUBLISHER + SUPERSEDED + FOREIGN;

  it("splits records", () => {
    expect(splitRecords(body)).toHaveLength(4);
  });

  it("keeps records where an allow-listed company is a contracting PARTY", () => {
    const got = parseDump(body, new Set(["26185610"]));
    expect(got.party.map((r) => r.idSmlouvy).sort()).toEqual(["1443766", "555"]);
    expect(got.publisherOnly).toBe(0);
  });

  it("COUNTS publisher-side matches instead of keeping or silently dropping them", () => {
    // A public body publishing its own contracts is acting in its own mandate — the
    // steward rule means that money is never attributed to a politician, and a single
    // regional hospital would otherwise dominate the harvest.
    const got = parseDump(body, new Set(["27661989"]));
    expect(got.party).toEqual([]);
    expect(got.publisherOnly).toBe(1);
    expect(got.publisherOnlyByIco).toEqual({ "27661989": 1 });
  });

  it("keeps the publisher side when explicitly asked", () => {
    const got = parseDump(body, new Set(["27661989"]), { keepPublisherSide: true });
    expect(got.party.map((r) => r.idSmlouvy)).toEqual(["36325448"]);
    expect(got.publisherOnly).toBe(0);
  });

  it("prefers the party side when a company is on both sides of the allow-list", () => {
    const got = parseDump(body, new Set(["26185610", "00020338"]));
    // 1443766 has 00020338 publishing and 26185610 as party → counted as party, once.
    expect(got.party.map((r) => r.idSmlouvy)).toContain("1443766");
    expect(got.party.filter((r) => r.idSmlouvy === "1443766")).toHaveLength(1);
  });

  it("returns nothing for an empty allow-list (the GDPR guard, not a convenience)", () => {
    expect(parseDump(body, new Set()).party).toEqual([]);
  });
});

describe("parseDumpIndex", () => {
  const idx = `<index><dump><mesic>3</mesic><rok>2017</rok><hashDumpu algoritmus="sha1">abc</hashDumpu><velikostDumpu>84386821</velikostDumpu><dokoncenyMesic>1</dokoncenyMesic><odkaz>https://data.smlouvy.gov.cz/dump_2017_03.xml</odkaz></dump><dump><mesic>7</mesic><rok>2026</rok><velikostDumpu>7604395</velikostDumpu><dokoncenyMesic>1</dokoncenyMesic><odkaz>https://data.smlouvy.gov.cz/dump_2026_07_07.xml</odkaz></dump><dump><mesic>7</mesic><rok>2026</rok><velikostDumpu>100407291</velikostDumpu><dokoncenyMesic>0</dokoncenyMesic><odkaz>https://data.smlouvy.gov.cz/dump_2026_07.xml</odkaz></dump></index>`;

  it("parses entries and flags monthly vs daily files", () => {
    const got = parseDumpIndex(idx);
    expect(got).toHaveLength(3);
    expect(got[0]).toMatchObject({ rok: 2017, mesic: 3, isMonthly: true, dokoncenyMesic: true });
    // A daily incremental is a SUBSET of its month — harvesting both double-counts.
    expect(got[1].isMonthly).toBe(false);
    expect(got[2]).toMatchObject({ isMonthly: true, dokoncenyMesic: false });
  });

  it("skips malformed entries instead of emitting a half-built one", () => {
    expect(parseDumpIndex("<index><dump><rok>2017</rok></dump></index>")).toEqual([]);
  });
});

describe("decodeXml", () => {
  it("decodes the predefined entities and numeric refs", () => {
    expect(decodeXml("a &lt;b&gt; &quot;c&quot; &apos;d&apos; &#67;")).toBe(`a <b> "c" 'd' C`);
  });

  it("decodes &amp; last so a double-escaped entity is not collapsed into markup", () => {
    expect(decodeXml("&amp;lt;")).toBe("&lt;");
  });
});
