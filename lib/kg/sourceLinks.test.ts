import { describe, expect, it } from "vitest";
import {
  citableId,
  parseLawRef,
  snemovniDokumentLink,
  sourceLinksFor,
  type KgNodeKind,
  type SourceSubject,
} from "./sourceLinks";

const subject = (over: Partial<SourceSubject> & Pick<SourceSubject, "kind" | "id">): SourceSubject => ({
  label: "Testovací entita",
  ...over,
});

/** Doslovná adresa jedné vývěsky z docs/data-analysis/case-sources/kiosek-payload.json. */
const POSTING_URL = "https://infodeska.gov.cz/eudpub/uredni-deska/organizace/201000/vyveseni/9420213";

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
    expect(links.map((l) => l.registry)).toEqual([
      "ARES",
      "Obchodní rejstřík",
      "Hlídač státu",
      "Hlídač státu — smlouvy",
    ]);
    for (const l of links) expect(l.url).toContain("25841991");
  });

  it("`detail` dostane jen adresa, která entitu opravdu adresuje", () => {
    // Do 2026-08-13 se dva DOTAZY vydávaly za detail: ARES `?ico=` je filtr
    // seznamu a or.justice `rejstrik-$firma?ico=` je vyhledávací formulář
    // (vlastní audit repa: „a search URL … not a permalink to the entity").
    const links = sourceLinksFor(
      subject({ kind: "company", id: "company:ico:25841991", props: { ico: "25841991" } }),
    );
    const tierOf = (registry: string) => links.find((l) => l.registry === registry)!.tier;
    expect(tierOf("ARES")).toBe("search");
    expect(tierOf("Obchodní rejstřík")).toBe("search");
    // Adresa s IČO v CESTĚ (ne v dotazu) detail slibovat smí.
    expect(tierOf("Hlídač státu")).toBe("detail");
    expect(tierOf("Hlídač státu — smlouvy")).toBe("search");
  });

  it("jméno registru pojmenuje hostitele, na kterého odkaz vede", () => {
    // `registry` se sází DOSLOVA, takže „Registr smluv" nad hlidacstatu.cz
    // slíbí čtenáři státní registr a pošle ho na soukromý agregátor.
    const subjects: SourceSubject[] = [
      subject({ kind: "person", id: "psp:person:1" }),
      subject({ kind: "company", id: "company:ico:123", props: { ico: "123" } }),
      subject({ kind: "contract", id: "contract:7", props: { supplierIco: "123" } }),
      subject({
        kind: "contract",
        id: "contract:1443766",
        props: { sourceUrl: "https://smlouvy.gov.cz/smlouva/1559694" },
      }),
      subject({ kind: "bill", id: "bill:tisk:9", props: { cislo: "9" } }),
      subject({ kind: "law", id: "law:sb:1-2020", props: { ref: "č. 1/2020 Sb." } }),
      subject({ kind: "notice", id: "notice:kiosek:201000:X", props: { postingId: POSTING_URL } }),
    ];
    for (const s of subjects) {
      for (const l of sourceLinksFor(s)) {
        const host = new URL(l.url).hostname.replace(/^www\./, "");
        const claims = l.registry.toLowerCase();
        const named =
          (host === "smlouvy.gov.cz" && claims.includes("registr smluv")) ||
          (host === "hlidacstatu.cz" && claims.includes("hlídač")) ||
          (host === "ares.gov.cz" && claims.includes("ares")) ||
          (host === "or.justice.cz" && claims.includes("rejstřík")) ||
          (host === "e-sbirka.gov.cz" && claims.includes("e-sbírka")) ||
          claims === host;
        expect(named, `${l.registry} → ${host}`).toBe(true);
      }
    }
  });

  it("smlouva cituje SEBE, když adresu z registru nese", () => {
    // `<odkaz>` z bulk dumpu → props.sourceUrl (persist-contract-harvest.ts).
    // Do 2026-08-13 se zahazovala a smlouva citovala dotaz na dodavatele.
    const links = sourceLinksFor(
      subject({
        kind: "contract",
        id: "contract:1443766",
        props: { sourceUrl: "https://smlouvy.gov.cz/smlouva/1559694", supplierIco: "26185610" },
      }),
    );
    expect(links[0]).toEqual({
      registry: "Registr smluv",
      url: "https://smlouvy.gov.cz/smlouva/1559694",
      tier: "detail",
    });
    // Dotaz na dodavatele zůstává — je to jiná otázka a je označený jako dotaz.
    expect(links[1].tier).toBe("search");
    // A NIKDY se neskládá z id uzlu: `/smlouva/<n>` je idVerze, uzel je idSmlouvy.
    expect(links.some((l) => l.url.includes("1443766"))).toBe(false);
  });

  it("smlouva bez uložené adresy zůstává u dotazu na dodavatele", () => {
    const links = sourceLinksFor(subject({ kind: "contract", id: "contract:7", props: { supplierIco: "123" } }));
    expect(links).toHaveLength(1);
    expect(links[0].tier).toBe("search");
    expect(links[0].url).toContain("hlidacstatu.cz");
  });

  it("nepoužitelná uložená adresa se nepropustí ani neopraví", () => {
    // props jsou volný JSON z ingestu; relativní cesta ani `javascript:` citace nejsou.
    for (const bad of ["/smlouva/1", "javascript:alert(1)", "http://smlouvy.gov.cz/smlouva/1", "", "  ", 42, null]) {
      const links = sourceLinksFor(subject({ kind: "contract", id: "contract:7", props: { sourceUrl: bad } }));
      expect(links, String(bad)).toEqual([]);
      const notice = sourceLinksFor(subject({ kind: "notice", id: "notice:x", props: { postingId: bad } }));
      expect(notice, String(bad)).toEqual([]);
    }
  });

  it("vývěska vede na svou vlastní adresu — ingest ji NESE", () => {
    // Opravený předpoklad: kiosek.ts dělá z URL vývěsky její id a
    // kiosek-build-payload.ts ji nese jako props.postingId (20/20 uzlů payloadu).
    const links = sourceLinksFor(
      subject({ kind: "notice", id: "notice:kiosek:201000:70_Cm_1999_2026-3", props: { postingId: POSTING_URL } }),
    );
    expect(links).toEqual([{ registry: "infodeska.gov.cz", url: POSTING_URL, tier: "detail" }]);
  });

  it("tisk vede na historii ve správném volebním období", () => {
    const links = sourceLinksFor(subject({ kind: "bill", id: "bill:tisk:1234", props: { cislo: 87 } }));
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("https://www.psp.cz/sqw/historie.sqw?o=10&t=87");
  });

  it("sněmovní dokument vede na text návrhu ve stejném období jako tisk", () => {
    // Ověřeno stažením 2026-08-10: sd.sqw?o=10&cd=822 → „Sněmovní dokument 822".
    const link = snemovniDokumentLink(822);
    expect(link).toEqual({
      registry: "psp.cz",
      url: "https://www.psp.cz/sqw/sd.sqw?o=10&cd=822",
      tier: "detail",
    });
    // Období je v souboru JEDNO — tisk i dokument o něm musí tvrdit totéž.
    const bill = sourceLinksFor(subject({ kind: "bill", id: "bill:tisk:1", props: { cislo: 1 } }));
    expect(new URL(link!.url).searchParams.get("o")).toBe(new URL(bill[0].url).searchParams.get("o"));
    // Uložené číslo bývá v grafu number, v props ale může přijít jako string.
    expect(snemovniDokumentLink("1046")?.url).toContain("cd=1046");
  });

  it("nečitelné číslo dokumentu neplodí hádanou adresu", () => {
    for (const bad of [null, undefined, "", "  ", "abc", "12a", -3, 1.5, "1,2", {}]) {
      expect(snemovniDokumentLink(bad), String(bad)).toBeNull();
    }
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
    for (const kind of ["party", "organ", "bloc", "theme"] as const) {
      expect(sourceLinksFor(subject({ kind, id: `${kind}:x` })), kind).toEqual([]);
    }
  });

  it("chybějící identifikátor neplodí odkaz do prázdna", () => {
    expect(sourceLinksFor(subject({ kind: "bill", id: "bill:tisk:1234" }))).toEqual([]);
    expect(sourceLinksFor(subject({ kind: "law", id: "law:sb:neco" }))).toEqual([]);
    expect(sourceLinksFor(subject({ kind: "contract", id: "contract:9" }))).toEqual([]);
    // Vývěska bez uložené adresy mlčí dál — odkaz se z id ani ze značky neskládá.
    expect(sourceLinksFor(subject({ kind: "notice", id: "notice:kiosek:201000:X" }))).toEqual([]);
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

  it("tisk bez čísla NEDOSTANE citaci — vnitřní id se za ni nevydává", () => {
    // `props.cislo` je nullable (kg-legislation-ingest.ts zapisuje `cislo ?? tiskId`
    // jen do jiného pole), takže se do 2026-08-13 tisklo „sn. tisk 43111" — sufix
    // urny `bill:tisk:<tiskId>`, který s veřejným číslem tisku nemá nic společného.
    expect(citableId(subject({ kind: "bill", id: "bill:tisk:43111" }))).toBeNull();
    // `sourceLinksFor` tohle pravidlo drželo vždycky — obě funkce teď mlčí stejně.
    expect(sourceLinksFor(subject({ kind: "bill", id: "bill:tisk:43111" }))).toEqual([]);
    expect(citableId(subject({ kind: "bill", id: "bill:tisk:43111", props: { cislo: 4 } }))).toBe("sn. tisk 4");
  });

  it("psp id orgánu se nezamění s psp id poslance", () => {
    // Klub i výbor mají urnu `psp:organ:<n>` — bez jednotky vypadá „psp id 172"
    // jako poslanec 172, což je jiná entita v jiném rejstříku psp.cz.
    expect(citableId(subject({ kind: "person", id: "psp:person:172" }))).toBe("psp id 172");
    expect(citableId(subject({ kind: "organ", id: "psp:organ:172" }))).toBe("psp id orgánu 172");
    expect(citableId(subject({ kind: "party", id: "psp:organ:172" }))).toBe("psp id orgánu 172");
    // Nečíselný sufix psp id není — radši nic než číslo, které tam není.
    expect(citableId(subject({ kind: "party", id: "kg:party:ODS" }))).toBeNull();
    expect(citableId(subject({ kind: "person", id: "psp:person:rozbity" }))).toBeNull();
  });

  it("smlouva cituje idSmlouvy pod jeho jménem, ne holé číslo", () => {
    // Holé „1443766" svádí složit `/smlouva/1443766` — to je ale idVerze
    // a vede na úplně jinou smlouvu (memory/registr-smluv-token-free-access.md).
    expect(citableId(subject({ kind: "contract", id: "contract:1443766" }))).toBe("idSmlouvy 1443766");
  });

  it("vývěska se cituje spisovou značkou i tehdy, když adresu nenese", () => {
    const notice = subject({ kind: "notice", id: "notice:kiosek:X:1", props: { spisovaZnacka: "KSPH 1 INS 1/2026" } });
    expect(citableId(notice)).toBe("KSPH 1 INS 1/2026");
    expect(sourceLinksFor(notice)).toEqual([]);
    // S uloženou adresou má vývěska obojí: značku jako citaci a odkaz na sebe.
    const withUrl = subject({ ...notice, props: { ...notice.props, postingId: POSTING_URL } });
    expect(citableId(withUrl)).toBe("KSPH 1 INS 1/2026");
    expect(sourceLinksFor(withUrl)[0].url).toBe(POSTING_URL);
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
