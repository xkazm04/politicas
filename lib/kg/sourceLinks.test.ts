import { describe, expect, it } from "vitest";
import { citableId, parseLawRef, sourceLinksFor, type KgNodeKind, type SourceSubject } from "./sourceLinks";

const subject = (over: Partial<SourceSubject> & Pick<SourceSubject, "kind" | "id">): SourceSubject => ({
  label: "Testovací entita",
  ...over,
});

const ALL_KINDS: KgNodeKind[] = [
  "person",
  "party",
  "organ",
  "bloc",
  "theme",
  "company",
  "contract",
  "bill",
  "law",
  "notice",
];

describe("odkazy do registrů", () => {
  it("osoba dostane kanonický detail na psp.cz z pspId", () => {
    const links = sourceLinksFor(subject({ kind: "person", id: "psp:person:6202", label: "J. Pokorná" }));
    const psp = links.find((l) => l.registry === "psp.cz")!;
    expect(psp.url).toBe("https://www.psp.cz/sqw/detail.sqw?id=6202");
    expect(psp.tier).toBe("detail");
  });

  it("dotaz do registru se NIKDY netváří jako detail entity", () => {
    // Rozdíl detail/search je celý smysl `tier` — rešerše není citace.
    const links = sourceLinksFor(subject({ kind: "person", id: "psp:person:6202", label: "J. Pokorná" }));
    const hlidac = links.find((l) => l.registry === "Hlídač státu")!;
    expect(hlidac.tier).toBe("search");
    expect(hlidac.url).toContain("hledat?q=");
  });

  it("firma se cituje přes IČO do čtyř registrů", () => {
    const links = sourceLinksFor(
      subject({ kind: "company", id: "company:ico:25841991", props: { ico: "25841991" } }),
    );
    expect(links.map((l) => l.registry)).toEqual(["ARES", "Obchodní rejstřík", "Hlídač státu", "Registr smluv"]);
    for (const l of links) expect(l.url).toContain("25841991");
  });

  it("tisk vede na historii ve správném volebním období", () => {
    const links = sourceLinksFor(subject({ kind: "bill", id: "bill:tisk:1234", props: { cislo: 87 } }));
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("https://www.psp.cz/sqw/historie.sqw?o=10&t=87");
  });

  it("zákon se rozloží z citace na ročník a číslo", () => {
    const links = sourceLinksFor(
      subject({ kind: "law", id: "law:sb:134-2016", props: { ref: "č. 134/2016 Sb." } }),
    );
    expect(links[0].url).toBe("https://e-sbirka.gov.cz/sb/2016/134");
  });

  it("orgány, kluby, bloky a témata odkaz nedostanou", () => {
    // Vědomé mlčení: psp.cz nemá stránku jednoho orgánu a bloky/témata vznikly
    // výpočtem. Kdyby sem někdo doplnil odkaz, musí ho nejdřív ověřit.
    for (const kind of ["party", "organ", "bloc", "theme", "notice"] as const) {
      expect(sourceLinksFor(subject({ kind, id: `${kind}:x` })), kind).toEqual([]);
    }
  });

  it("chybějící identifikátor neplodí odkaz do prázdna", () => {
    expect(sourceLinksFor(subject({ kind: "bill", id: "bill:tisk:1234" }))).toEqual([]);
    expect(sourceLinksFor(subject({ kind: "law", id: "law:sb:neco" }))).toEqual([]);
    expect(sourceLinksFor(subject({ kind: "contract", id: "contract:9" }))).toEqual([]);
  });

  it("žádný vygenerovaný odkaz není relativní ani prázdný", () => {
    const subjects: SourceSubject[] = [
      subject({ kind: "person", id: "psp:person:1" }),
      subject({ kind: "company", id: "company:ico:123", props: { ico: "123" } }),
      subject({ kind: "contract", id: "contract:7", props: { supplierIco: "123" } }),
      subject({ kind: "bill", id: "bill:tisk:9", props: { cislo: "9" } }),
      subject({ kind: "law", id: "law:sb:1-2020", props: { ref: "č. 1/2020 Sb." } }),
    ];
    for (const s of subjects) {
      for (const l of sourceLinksFor(s)) {
        expect(l.url, `${s.kind}/${l.registry}`).toMatch(/^https:\/\/[a-z]/);
        expect(l.registry.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("citovatelný identifikátor", () => {
  it("nese jednotku, aby šel přečíst i bez odkazu", () => {
    expect(citableId(subject({ kind: "person", id: "psp:person:6202" }))).toBe("psp id 6202");
    expect(citableId(subject({ kind: "company", id: "company:ico:25841991" }))).toBe("IČO 25841991");
    expect(citableId(subject({ kind: "bill", id: "bill:tisk:99", props: { cislo: 87 } }))).toBe("sn. tisk 87");
    expect(citableId(subject({ kind: "law", id: "law:sb:134-2016", props: { ref: "č. 134/2016 Sb." } }))).toBe(
      "č. 134/2016 Sb.",
    );
  });

  it("odvozené uzly přiznají, že je nevede žádný registr", () => {
    expect(citableId(subject({ kind: "bloc", id: "bloc:vladni" }))).toBeNull();
    expect(citableId(subject({ kind: "theme", id: "theme:energie" }))).toBeNull();
  });

  it("vývěska se cituje spisovou značkou, i když odkaz chybí", () => {
    // Zdroj URL nese, ingest ji zahazuje — citace tedy existuje, odkaz ne.
    const notice = subject({ kind: "notice", id: "notice:kiosek:X:1", props: { spisovaZnacka: "KSPH 1 INS 1/2026" } });
    expect(citableId(notice)).toBe("KSPH 1 INS 1/2026");
    expect(sourceLinksFor(notice)).toEqual([]);
  });

  it("každý druh uzlu je obsloužen — nový kind musí projít oběma funkcemi", () => {
    for (const kind of ALL_KINDS) {
      expect(() => sourceLinksFor(subject({ kind, id: `${kind}:1` })), kind).not.toThrow();
      expect(() => citableId(subject({ kind, id: `${kind}:1` })), kind).not.toThrow();
    }
  });
});

describe("parseLawRef", () => {
  it("zvládne citaci i holý tvar", () => {
    expect(parseLawRef("č. 134/2016 Sb.")).toEqual({ cislo: "134", rok: "2016" });
    expect(parseLawRef("134/2016")).toEqual({ cislo: "134", rok: "2016" });
    expect(parseLawRef("bez čísla")).toBeNull();
  });
});
