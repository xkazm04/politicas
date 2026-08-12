/*
 * SPIS FIRMY — která ze dvou variant vznikne, a co která smí tvrdit.
 *
 * Do 2026-08-12 loader končil na `ties.length === 0` DŘÍV, než se vůbec podíval na
 * vlastnictví — takže Město Plzeň (00075370), HLAVNÍ MĚSTO PRAHA, Ministerstvo financí
 * a předchůdci AGROFERTu, tedy uzly, na které blok vlastnictví SÁM odkazuje, dostaly
 * větu „graf nevede pro tohle IČO žádnou vazbu na poslance", zatímco graf tu hranu drží.
 *
 * Obchod se odehrává nad SYNTETICKÝM storem (živý ./.pglite drží jiná session): fixtury
 * kopírují tvar živých řádků, ne jejich obsah.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const kgNeighbours = vi.fn();
const getKgNodes = vi.fn();
const listMandates = vi.fn(async () => []);
const clubByMandate = vi.fn(async () => new Map());

vi.mock("@/lib/db/store", () => ({
  getStore: async () => ({ kgNeighbours, getKgNodes, listMandates, clubByMandate }),
}));
vi.mock("@/lib/db/readiness", () => ({ storeReady: async () => true }));

const { getCompanyCaseFile, getCompanyDetail } = await import("./getCompanyDetail");

const TODAY = "2026-08-12";

const companyNode = (ico: string, label: string, props: Record<string, unknown> = {}) => ({
  id: `company:ico:${ico}`,
  kind: "company",
  label,
  props: { ico, ...props },
  provenance: { pass: 28 },
});

const personNode = (pspId: number, label: string) => ({
  id: `psp:person:${pspId}`,
  kind: "person",
  label,
  props: {},
  provenance: { pass: 10 },
});

/** Živý tvar: Město Plzeň → Plzeňské městské dopravní podniky, otevřený zápis. */
const ownsEdge = (src: string, dst: string, pass: number | null = 28) => ({
  src,
  rel: "owns_stake",
  dst,
  weight: null,
  props: {
    role: "jediný akcionář",
    share: 100,
    from: "2013-09-04",
    to: null,
    source: "https://dataor.justice.cz/api/file/as-full-plzen-2026.csv.gz",
    periods: [{}],
  },
  provenance: pass === null ? {} : { pass, computedAt: "2026-07-25" },
});

const tieEdge = (pspId: number, companyId: string) => ({
  src: `psp:person:${pspId}`,
  rel: "linked_to",
  dst: companyId,
  weight: null,
  props: { role: "jednatel", tie_class: "owner_operator", review_state: "pending_review" },
  provenance: { pass: 10, computedAt: "2026-07-20" },
});

const suppliesEdge = (companyId: string, n: number, czk: number) => ({
  src: companyId,
  rel: "supplies",
  dst: `contract:${n}`,
  weight: czk,
  props: {},
  provenance: { pass: 10 },
});

/** Odpovědi `kgNeighbours` podle relace, jak je loader volá (linked_to, supplies,
 *  owns_stake — každá zvlášť, vždy přes index). */
function store(opts: {
  ties?: unknown[];
  persons?: unknown[];
  supplies?: unknown[];
  ownership?: unknown[];
  ownershipNodes?: unknown[];
}) {
  kgNeighbours.mockImplementation(async ({ rels }: { rels: string[] }) => {
    if (rels.includes("linked_to")) return { edges: opts.ties ?? [], nodes: opts.persons ?? [] };
    if (rels.includes("supplies")) return { edges: opts.supplies ?? [], nodes: [] };
    if (rels.includes("owns_stake"))
      return { edges: opts.ownership ?? [], nodes: opts.ownershipNodes ?? [] };
    return { edges: [], nodes: [] };
  });
}

describe("getCompanyCaseFile — dvě varianty, jedno čtení", () => {
  beforeEach(() => {
    kgNeighbours.mockReset();
    getKgNodes.mockReset();
  });

  it("firma bez vazby, ale se zapsaným vlastnictvím, dostane poctivý rejstříkový spis", async () => {
    const subject = companyNode("00075370", "Město Plzeň");
    const child = companyNode("25220683", "Plzeňské městské dopravní podniky, a.s.");
    getKgNodes.mockResolvedValue([subject]);
    store({
      ties: [],
      ownership: [ownsEdge(subject.id, child.id)],
      ownershipNodes: [child],
    });

    const file = await getCompanyCaseFile("00075370", TODAY);
    expect(file).not.toBeNull();
    expect(file && "variant" in file ? file.variant : null).toBe("registry-only");
    if (!file || !("variant" in file)) throw new Error("unreachable");
    expect(file.ico).toBe("00075370");
    expect(file.name).toBe("Město Plzeň");
    // Vlastnictví je ten důvod, proč stránka existuje — a nikdy null.
    expect(file.ownership.subsidiaries).toHaveLength(1);
    expect(file.ownership.subsidiaries[0].counterpartIco).toBe("25220683");
  });

  it("rejstříkový spis nenese ŽÁDNÉ peníze — ani jako nulu", async () => {
    const subject = companyNode("00064581", "HLAVNÍ MĚSTO PRAHA", {
      subsidies_total_czk: 1_000_000,
      donated_to_party_czk: 4_000_000,
    });
    const child = companyNode("25220683", "Dcera, a.s.");
    getKgNodes.mockResolvedValue([subject]);
    store({
      ties: [],
      // Firma smlouvy MÁ; bez vazby ale neexistuje pravidlo přiřazení, takže se
      // nesázejí — a hlavně se nesází dosah 0 Kč, což by bylo tvrzení.
      supplies: [suppliesEdge(subject.id, 1, 5_000_000)],
      ownership: [ownsEdge(subject.id, child.id)],
      ownershipNodes: [child],
    });

    const file = await getCompanyCaseFile("00064581", TODAY);
    if (!file || !("variant" in file)) throw new Error("expected the registry-only variant");
    expect(Object.keys(file).sort()).toEqual(["companyId", "ico", "name", "ownership", "variant"]);
    expect(file).not.toHaveProperty("money");
    expect(file).not.toHaveProperty("contracts");
    expect(file).not.toHaveProperty("pass");
  });

  it("ani vazba, ani vlastnictví → null: pro nic se adresa nerazí", async () => {
    const subject = companyNode("00006947", "Ministerstvo financí");
    getKgNodes.mockResolvedValue([subject]);
    store({ ties: [], ownership: [] });

    expect(await getCompanyCaseFile("00006947", TODAY)).toBeNull();
  });

  it("provenience rejstříkové varianty NIKDY nepochází z ties[0] — je z vlastnických hran", async () => {
    const subject = companyNode("26185610", "AGROFERT, a.s.");
    const parent = companyNode("25130072", "AGROFERT HOLDING, a.s.");
    getKgNodes.mockResolvedValue([subject]);
    store({ ties: [], ownership: [ownsEdge(parent.id, subject.id, 39)], ownershipNodes: [parent] });

    const file = await getCompanyCaseFile("26185610", TODAY);
    if (!file || !("variant" in file)) throw new Error("expected the registry-only variant");
    // 39 = průchod, který zapsal VLASTNICTVÍ. `slice.pass` (ties[0]) je tu 0 a stránka
    // by ho vytiskla jako „pass 0" — proto se bere odsud.
    expect(file.ownership.pass).toBe(39);
  });

  it("když se zápisy na jednom průchodu neshodnou, žádný se neuvádí", async () => {
    const subject = companyNode("26185611", "Sporná, a.s.");
    const a = companyNode("25130073", "Matka A");
    const b = companyNode("25130074", "Matka B");
    getKgNodes.mockResolvedValue([subject]);
    store({
      ties: [],
      ownership: [ownsEdge(a.id, subject.id, 28), ownsEdge(b.id, subject.id, 39)],
      ownershipNodes: [a, b],
    });

    const file = await getCompanyCaseFile("26185611", TODAY);
    if (!file || !("variant" in file)) throw new Error("expected the registry-only variant");
    expect(file.ownership.pass).toBeNull();
  });

  it("firma S vazbou dostane pořád peněžní spis a bere svůj průchod z hrany vazby", async () => {
    const subject = companyNode("46347534", "Teplárny Brno, a.s.", { subsidies_total_czk: 0 });
    getKgNodes.mockResolvedValue([subject]);
    store({
      ties: [tieEdge(6881, subject.id)],
      persons: [personNode(6881, "Petr Hladík")],
      supplies: [suppliesEdge(subject.id, 1, 1_000), suppliesEdge(subject.id, 2, 2_000)],
      ownership: [],
    });

    const file = await getCompanyCaseFile("46347534", TODAY);
    if (!file || "variant" in file) throw new Error("expected the money case file");
    expect(file.ties).toHaveLength(1);
    expect(file.money.attributable.contractCzk).toBe(3_000);
    expect(file.pass).toBe(10);
  });
});

describe("getCompanyDetail — užší kontrakt pro citační bránu", () => {
  beforeEach(() => {
    kgNeighbours.mockReset();
    getKgNodes.mockReset();
  });

  it("odmítne rejstříkovou variantu: číslo, které se nespočítalo, nemá co ověřovat", async () => {
    const subject = companyNode("00075371", "Město Bez Vazby");
    const child = companyNode("25220684", "Dcera bez vazby, a.s.");
    getKgNodes.mockResolvedValue([subject]);
    store({ ties: [], ownership: [ownsEdge(subject.id, child.id)], ownershipNodes: [child] });

    // Stránka na tomhle IČO vykreslí spis…
    expect(await getCompanyCaseFile("00075371", TODAY)).not.toBeNull();
    // …a /overeni na něj pořád odpoví „záznam nenalezen", ne „Ověřeno, 0 Kč".
    expect(await getCompanyDetail("00075371", TODAY)).toBeNull();
  });
});

describe("readScope — dosah jedné firmy odpovídá za SVOJE čtení", () => {
  beforeEach(() => {
    kgNeighbours.mockReset();
    getKgNodes.mockReset();
  });

  it("úplné čtení netvrdí dolní odhad ANI strop, který neexistuje", async () => {
    const subject = companyNode("46347535", "Malá firma, s.r.o.");
    getKgNodes.mockResolvedValue([subject]);
    store({
      ties: [tieEdge(6100, subject.id)],
      persons: [personNode(6100, "Poslanec Testovací")],
      supplies: [1, 2, 3].map((n) => suppliesEdge(subject.id, n, 100)),
      ownership: [],
    });

    const file = await getCompanyCaseFile("46347535", TODAY);
    if (!file || "variant" in file) throw new Error("expected the money case file");
    expect(file.money.coverage).toEqual({ perCompanyCap: null, companiesAtCap: 0, isFloor: false });
  });

  it("useknuté čtení JE dolní odhad — a nikdy nevymyslí číslo stropu na firmu", async () => {
    /* Jediná větev, ve které se `readScope` na téhle ploše projeví: nad populací
     * JEDNÉ firmy korpusová heuristika vystřelit nemůže (chce ≥ 3 firmy na maximu),
     * takže bez `readScope` by se useknuté čtení vytisklo jako přesný součet. Strop
     * čtení se snižuje mockem, protože živý `KG_READ_CAP` je 1 000 000 hran. */
    vi.resetModules();
    vi.doMock("@/lib/db/readCap", () => ({ KG_READ_CAP: 2 }));
    const { getCompanyCaseFile: reloaded } = await import("./getCompanyDetail");

    const subject = companyNode("46347536", "Useknutá, a.s.");
    getKgNodes.mockResolvedValue([subject]);
    store({
      ties: [tieEdge(6101, subject.id)],
      persons: [personNode(6101, "Poslanec Testovací")],
      supplies: [1, 2].map((n) => suppliesEdge(subject.id, n, 100)),
      ownership: [],
    });

    const file = await reloaded("46347536", TODAY);
    vi.doUnmock("@/lib/db/readCap");
    vi.resetModules();
    if (!file || "variant" in file) throw new Error("expected the money case file");
    expect(file.money.coverage.isFloor).toBe(true);
    expect(file.money.coverage.perCompanyCap).toBeNull();
    expect(file.money.coverage.companiesAtCap).toBe(0);
  });
});
