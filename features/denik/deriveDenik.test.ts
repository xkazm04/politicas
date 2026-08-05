// Deník republiky — invarianty čistého odvození (moonshot 3A). Hlídají
// PRAVIDLA (možné datum, seskupení po dnech, deterministické pořadí, filtr
// entity, kotvy dnů), ne dnešní obsah databáze.

import { describe, expect, it } from "vitest";
import {
  buildDenik,
  type DenikChange,
  companyEntityKey,
  DAYS_SHOWN,
  dayAnchor,
  deriveDenikEntries,
  entityLabel,
  filterDenikEntries,
  groupDenikDays,
  mpEntityKey,
  billEntityKey,
  czechWeekday,
  type DenikInput,
  DENIK_CHANGE_TYPES,
} from "./deriveDenik";
import { pragueDay } from "./pragueDay";

const input = (over: Partial<DenikInput> = {}): DenikInput => ({
  today: "2026-07-28",
  contracts: [],
  roles: [],
  bills: [],
  reviews: [],
  ...over,
});

const contract = (id: string, signedOn: string | null, amountCzk: number | null = 1000) => ({
  id,
  title: `Smlouva ${id}`,
  signedOn,
  amountCzk,
  company: "Firma s.r.o.",
  ico: "00000100",
  mps: [{ pspId: 6543, name: "Jan Novák", pending: true }],
});

const role = (pspId: number, ico: string | null, validFrom: string | null, validTo: string | null = null) => ({
  company: "Firma s.r.o.",
  ico,
  mpName: "Jan Novák",
  pspId,
  role: "jednatel",
  validFrom,
  validTo,
  pending: false,
});

const review = (id: string, decidedAt: string) => ({
  id,
  decision: "confirm" as const,
  decidedAt,
  mpName: "Jan Novák",
  company: "Firma s.r.o.",
  pspId: 6543,
  ico: "00000100",
});

describe("deriveDenikEntries — nemožné datum není datum", () => {
  it("vyhodí data mimo možný rozsah (včetně budoucnosti), spočítá je a NEOPRAVÍ", () => {
    const { entries, droppedImplausible } = deriveDenikEntries(
      input({
        contracts: [
          contract("a", "0002-02-25"),
          contract("b", "3062-07-16"),
          contract("c", "2027-01-01"), // budoucnost vůči `today`
          contract("d", "2025-02-05"),
        ],
      }),
    );
    expect(entries.map((e) => e.id)).toEqual(["contract:d"]);
    expect(droppedImplausible).toBe(3);
  });

  it("dnešek je PRAŽSKÝ den, ne UTC — smlouva podepsaná dnes v Praze nepadá do vyhozených", () => {
    // 2026-08-04 22:30 UTC = 2026-08-05 00:30 v Praze. Loader do 2026-08-04
    // počítal `today` z UTC, takže dnešní pražská smlouva byla „z budoucnosti"
    // a přičetla se k droppedImplausible — tedy k číslu, kterým plocha přiznává
    // VADNÁ DATA V KORPUSU. Časové pásmo serveru nafukovalo počítadlo poctivosti.
    const instant = new Date("2026-08-04T22:30:00.000Z");
    const utcToday = instant.toISOString().slice(0, 10);
    const pragueToday = pragueDay(instant);
    expect(utcToday).toBe("2026-08-04");
    expect(pragueToday).toBe("2026-08-05");

    const contracts = [contract("dnes", "2026-08-05")];
    const podUtc = deriveDenikEntries(input({ contracts, today: utcToday }));
    expect(podUtc.entries).toHaveLength(0);
    expect(podUtc.droppedImplausible).toBe(1); // vada dat, která vadou dat není

    const podPrahou = deriveDenikEntries(input({ contracts, today: pragueToday }));
    expect(podPrahou.entries.map((e) => e.id)).toEqual(["contract:dnes"]);
    expect(podPrahou.droppedImplausible).toBe(0);
  });

  it("záznam bez data se nedatuje odhadem — prostě není", () => {
    const { entries, droppedImplausible } = deriveDenikEntries(
      input({ contracts: [contract("a", null)], roles: [role(6543, "00000100", null, null)] }),
    );
    expect(entries).toEqual([]);
    expect(droppedImplausible).toBe(0); // nedatovaný ≠ nemožný; nepočítá se jako vada
  });

  it("smlouva bez přisouditelné vazby do deníku nepatří", () => {
    const { entries } = deriveDenikEntries(
      input({ contracts: [{ ...contract("a", "2025-01-01"), mps: [] }] }),
    );
    expect(entries).toEqual([]);
  });
});

describe("groupDenikDays — seskupení a pořadí", () => {
  const built = () =>
    deriveDenikEntries(
      input({
        contracts: [contract("a", "2026-07-20"), contract("b", "2026-07-22")],
        roles: [role(6543, "00000100", "2026-07-22", "2026-07-24")],
        bills: [
          {
            cislo: 90,
            title: "Novela",
            sponsors: [{ pspId: 6543, name: "Jan Novák" }],
            committees: [{ organLabel: "rozpočtový výbor", assignedOn: "2026-07-22" }],
            fateSb: "583/2025",
            fatePublishedOn: "2026-07-24",
          },
        ],
        reviews: [review("r1", "2026-07-22T09:00:00.000Z")],
      }),
    ).entries;

  it("dny sestupně, uvnitř dne pevné pořadí skupin (smlouvy → legislativa → rejstřík → brána)", () => {
    const { days, daysTotal } = groupDenikDays(built());
    expect(days.map((d) => d.date)).toEqual(["2026-07-24", "2026-07-22", "2026-07-20"]);
    expect(daysTotal).toBe(3);
    expect(days[1].entries.map((e) => e.id)).toEqual([
      "contract:b",
      "assigned:90:rozpočtový výbor",
      "role-from:6543:00000100",
      "review:r1",
    ]);
    // 24. 7.: vyhlášení ve Sbírce + výmaz role — legislativa před rejstříkem.
    expect(days[0].entries.map((e) => e.kind)).toEqual(["billPublished", "roleEnd"]);
  });

  it("je deterministické: vstup v libovolném pořadí → tentýž deník", () => {
    const a = deriveDenikEntries(
      input({ contracts: [contract("a", "2026-07-20"), contract("b", "2026-07-20")] }),
    ).entries;
    const b = deriveDenikEntries(
      input({ contracts: [contract("b", "2026-07-20"), contract("a", "2026-07-20")] }),
    ).entries;
    expect(a).toEqual(b);
  });

  it("kotva dne je `d-<datum>`", () => {
    const { days } = groupDenikDays(built());
    expect(days[0].anchor).toBe(dayAnchor("2026-07-24"));
    expect(days[0].anchor).toBe("d-2026-07-24");
  });

  it("seřízne na posledních N zapsaných dnů a přizná celkový počet", () => {
    const contracts = Array.from({ length: DAYS_SHOWN + 5 }, (_, i) =>
      contract(`c${String(i).padStart(2, "0")}`, `2026-06-${String((i % 28) + 1).padStart(2, "0")}`),
    );
    const { entries } = deriveDenikEntries(input({ contracts }));
    const { days, daysTotal } = groupDenikDays(entries, 10);
    expect(days).toHaveLength(10);
    expect(daysTotal).toBe(28);
    // seříznuté jsou ty NEJSTARŠÍ dny.
    expect(days[0].date > days[days.length - 1].date).toBe(true);
  });
});

describe("filtr entity — URL je odběr", () => {
  const entries = () =>
    deriveDenikEntries(
      input({
        contracts: [contract("a", "2026-07-20")],
        roles: [
          role(6543, "00000100", "2026-07-19"),
          { ...role(9999, "00000200", "2026-07-18"), mpName: "Eva Malá" },
        ],
        bills: [
          {
            cislo: 90,
            title: "Novela",
            sponsors: [{ pspId: 9999, name: "Eva Malá" }],
            committees: [{ organLabel: "výbor", assignedOn: "2026-07-17" }],
            fateSb: null,
            fatePublishedOn: null,
          },
        ],
        reviews: [review("r1", "2026-07-21T09:00:00.000Z")],
      }),
    ).entries;

  it("klíč poslance vybere smlouvy jeho firem, jeho role i rozhodnutí brány o něm", () => {
    const scoped = filterDenikEntries(entries(), mpEntityKey(6543));
    expect(scoped.map((e) => e.id)).toEqual(["review:r1", "contract:a", "role-from:6543:00000100"]);
  });

  it("klíč firmy a tisku filtrují po svém; neznámý klíč → poctivě prázdno", () => {
    expect(filterDenikEntries(entries(), companyEntityKey("00000200")).map((e) => e.id)).toEqual([
      "role-from:9999:00000200",
    ]);
    expect(filterDenikEntries(entries(), billEntityKey(90)).map((e) => e.id)).toEqual(["assigned:90:výbor"]);
    expect(filterDenikEntries(entries(), "firma:99999999")).toEqual([]);
  });

  it("firma nese odkaz na svůj spis — řádek o smlouvě vede na firmu, ne na poslance", () => {
    const row = entries().find((e) => e.id === "contract:a");
    const company = row?.entities.find((en) => en.key.startsWith("firma:"));
    expect(company?.href).toBe("/penize/firma/00000100");
    // firstHref bere první entitu s adresou a u smlouvy je první firma.
    expect(row?.internalHref).toBe("/penize/firma/00000100");
  });

  it("entityLabel čte popisek ze záznamů; buildDenik řeže dny až PO filtru", () => {
    const all = entries();
    expect(entityLabel(all, mpEntityKey(9999))).toBe("Eva Malá");
    expect(entityLabel(all, "firma:99999999")).toBeNull();

    const view = buildDenik(
      input({
        contracts: [contract("a", "2026-07-20")],
        roles: [{ ...role(9999, "00000200", "2026-01-05"), mpName: "Eva Malá" }],
      }),
      mpEntityKey(9999),
    );
    // Entita dostane SVÉ zapsané dny, i když jsou starší než dny celku.
    expect(view.ledger.days.map((d) => d.date)).toEqual(["2026-01-05"]);
    expect(view.entityLabelCs).toBe("Eva Malá");
  });
});

describe("proud „zaznamenáno“ — change eventy v deníku (5C)", () => {
  const change = (id: string, over: Partial<DenikChange> = {}): DenikChange => ({
    id,
    eventType: "tie-new",
    recordedAt: "2026-07-22T08:00:00.000Z",
    mpName: "Jan Novák",
    pspId: 6543,
    company: "Firma s.r.o.",
    ico: "00000100",
    contractLabel: null,
    termCode: null,
    functionNameCz: null,
    source: "kg_edge_history — bitemporální graf",
    pending: true,
    ...over,
  });

  it("řadí se do dne ZÁZNAMU, ve dni až za bránu, a nese timeBasis=zaznamenano", () => {
    const { entries } = deriveDenikEntries(
      input({
        contracts: [contract("a", "2026-07-22")],
        reviews: [review("r1", "2026-07-22T09:00:00.000Z")],
        changes: [change("chev:tie-new:x|y")],
      }),
    );
    expect(entries.map((e) => e.id)).toEqual(["contract:a", "review:r1", "change:chev:tie-new:x|y"]);
    const ch = entries[2];
    expect(ch.kind).toBe("change");
    expect(ch.date).toBe("2026-07-22"); // den záznamu, ne účinnosti
    expect(ch.timeBasis).toBe("zaznamenano");
    // Zdroj je DOSLOVNÝ řetězec eventu, ne jméno tabulky, ve které skončil.
    expect(ch.source).toBe("kg_edge_history — bitemporální graf");
  });

  it("vizuální rozlišení: světové řádky jsou účinné, brána a change eventy zaznamenáno", () => {
    const { entries } = deriveDenikEntries(
      input({
        contracts: [contract("a", "2026-07-20")],
        roles: [role(6543, "00000100", "2026-07-20")],
        reviews: [review("r1", "2026-07-21T09:00:00.000Z")],
        changes: [change("c1", { recordedAt: "2026-07-21T10:00:00.000Z" })],
      }),
    );
    const basis = new Map(entries.map((e) => [e.kind, e.timeBasis]));
    expect(basis.get("contract")).toBe("ucinne");
    expect(basis.get("roleStart")).toBe("ucinne");
    expect(basis.get("review")).toBe("zaznamenano");
    expect(basis.get("change")).toBe("zaznamenano");
  });

  it("brankované věty všech tří typů eventů; smlouva v grafu má tón signal", () => {
    const { entries } = deriveDenikEntries(
      input({
        changes: [
          change("c1", { eventType: "tie-new" }),
          change("c2", { eventType: "tie-changed", pending: false }),
          change("c3", { eventType: "contract-new", mpName: null, pspId: null, contractLabel: "Úklid budovy" }),
        ],
      }),
    );
    const byId = new Map(entries.map((e) => [e.id, e]));
    expect(byId.get("change:c1")!.titleCs).toBe("zaznamenána nová vazba — Jan Novák ↔ Firma s.r.o.");
    expect(byId.get("change:c1")!.pending).toBe(true);
    expect(byId.get("change:c2")!.titleCs).toBe("zaznamenána změna vazby — Jan Novák ↔ Firma s.r.o.");
    expect(byId.get("change:c3")!.titleCs).toBe("zaznamenána smlouva v grafu — Firma s.r.o.: Úklid budovy");
    expect(byId.get("change:c3")!.tone).toBe("signal");
    expect(byId.get("change:c1")!.tone).toBe("cobalt");
  });

  it("filtr `?entita=` pokrývá change eventy (poslanec i firma)", () => {
    const { entries } = deriveDenikEntries(
      input({
        contracts: [contract("a", "2026-07-20")],
        changes: [
          change("c1"),
          change("c2", { eventType: "contract-new", mpName: null, pspId: null, ico: "00000200", company: "Jiná a.s." }),
        ],
      }),
    );
    expect(filterDenikEntries(entries, mpEntityKey(6543)).map((e) => e.id)).toEqual([
      "change:c1",
      "contract:a",
    ]);
    expect(filterDenikEntries(entries, companyEntityKey("00000200")).map((e) => e.id)).toEqual(["change:c2"]);
  });

  it("idempotentní vstup: totéž odvození dvakrát → byte-identický deník; nemožné datum se vyhazuje", () => {
    const build = () =>
      deriveDenikEntries(
        input({
          changes: [change("c1"), change("c2", { recordedAt: "2027-05-01T00:00:00.000Z" })], // budoucnost
        }),
      );
    const a = build();
    const b = build();
    expect(a).toEqual(b);
    expect(a.entries.map((e) => e.id)).toEqual(["change:c1"]);
    expect(a.droppedImplausible).toBe(1);
  });
});

describe("věta záznamu jako klíč — dvojjazyčná plocha (2026-08-05)", () => {
  it("každý vydaný záznam nese titulní klíč `entry.*` s parametry; titleCs zůstává pro feedy", () => {
    const { entries } = deriveDenikEntries(
      input({
        contracts: [contract("a", "2026-07-20")],
        roles: [role(6543, "00000100", "2026-07-19", "2026-07-21")],
        bills: [
          {
            cislo: 90,
            title: "Novela",
            sponsors: [{ pspId: 6543, name: "Jan Novák" }],
            committees: [{ organLabel: "výbor", assignedOn: "2026-07-18" }],
            fateSb: "583/2025",
            fatePublishedOn: "2026-07-22",
          },
        ],
        reviews: [review("r1", "2026-07-21T09:00:00.000Z")],
        changes: DENIK_CHANGE_TYPES.map((t, i) => ({
          id: `c${i}`,
          eventType: t,
          recordedAt: "2026-07-22T08:00:00.000Z",
          mpName: "Jan Novák",
          pspId: 6543,
          company: "Firma s.r.o.",
          ico: "00000100",
          contractLabel: null,
          termCode: "PSP10",
          functionNameCz: "místopředseda výboru",
          source: "diff snímků ingestů — psp.cz",
          pending: false,
        })),
      }),
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.title, e.id).toBeDefined();
      expect(e.title!.key).toMatch(/^entry\.[a-zA-Z]+$/);
      // Parametry jsou DATA — nikdy kus věty, nikdy strojový token typu eventu.
      for (const v of Object.values(e.title!.params)) expect(typeof v).toBe("string");
      expect(e.titleCs.length).toBeGreaterThan(0);
    }
    // Volitelný parametr přepíná klíč, nesází kus věty do parametru.
    const mandate = entries.find((e) => e.kind === "mandate")!;
    expect(mandate.title!.key).toMatch(/Term$/);
    expect(mandate.title!.params.term).toBe("PSP10");
  });
});

describe("czechWeekday — deterministický den v týdnu, bez Intl", () => {
  it("spočítá den v týdnu a nevalidní vstup odmítne", () => {
    expect(czechWeekday("2026-07-28")).toBe("úterý"); // ověřeno kalendářem
    expect(czechWeekday("2026-07-26")).toBe("neděle");
    expect(czechWeekday("ne-datum")).toBeNull();
  });
});

describe("hlas deníku — brankovaná čeština a zdroj na každém řádku", () => {
  it("věty jsou složené z typovaných faktů a nesou zdroj i tón", () => {
    const { entries } = deriveDenikEntries(
      input({
        contracts: [contract("a", "2026-07-20")],
        reviews: [review("r1", "2026-07-21T09:00:00.000Z")],
      }),
    );
    const c = entries.find((e) => e.kind === "contract")!;
    expect(c.titleCs).toBe("podepsána smlouva — Firma s.r.o.: Smlouva a");
    expect(c.source).toContain("smlouvy.gov.cz");
    expect(c.pending).toBe(true);
    const r = entries.find((e) => e.kind === "review")!;
    expect(r.titleCs).toBe("vazba ověřena — Jan Novák ↔ Firma s.r.o.");
    expect(r.source).toContain("review_audit");
    expect(r.pending).toBe(false);
  });
});

describe("jedna smlouva = jeden řádek (slévání duplicit)", () => {
  const shared = (
    ico: string,
    company: string,
    amountCzk: number | null,
    pspId: number,
    pending = false,
  ) => ({
    id: "contract:30754712",
    title: "Dodávka tepla",
    signedOn: "2026-07-20",
    amountCzk,
    company,
    ico,
    mps: [{ pspId, name: `Poslanec ${pspId}`, pending }],
  });

  it("uzel smlouvy visící na DVOU firmách dvou poslanců dá JEDEN řádek s jedním id", () => {
    // Na živém grafu je to 5 uzlů ze 4 380: dva řádky s týmž `contract:<id>`
    // znamenaly duplicitní React key a duplicitní guid ve feedu.
    const { entries, mergedContractRows } = deriveDenikEntries(
      input({
        contracts: [
          shared("46347534", "Teplárny Brno, a.s.", 263_730, 6881),
          shared("45534306", "ČSOB Pojišťovna, a. s.", 263_730, 6543, true),
        ],
      }),
    );
    expect(entries).toHaveLength(1);
    expect(new Set(entries.map((e) => e.id)).size).toBe(1);
    expect(mergedContractRows).toBe(1);

    const e = entries[0];
    // Dodavatelé se vypíšou VŠICHNI, seřazení podle IČO (determinismus).
    expect(e.titleCs).toBe(
      "podepsána smlouva — ČSOB Pojišťovna, a. s. + Teplárny Brno, a.s.: Dodávka tepla",
    );
    // Entity se SJEDNOTÍ — filtr obou firem i obou poslanců najde tentýž řádek.
    expect(e.entities.map((en) => en.key).sort()).toEqual([
      "firma:45534306",
      "firma:46347534",
      "poslanec:6543",
      "poslanec:6881",
    ]);
    expect(e.czk).toBe(263_730);
    // pending je disjunkce: stačí jedna nezkontrolovaná vazba.
    expect(e.pending).toBe(true);
    expect(filterDenikEntries(entries, "firma:46347534")).toHaveLength(1);
    expect(filterDenikEntries(entries, mpEntityKey(6543))).toHaveLength(1);
  });

  it("rozporné částky se neslévají — řádek NEUVEDE žádnou a rozpor se počítá", () => {
    const { entries, contractAmountConflicts } = deriveDenikEntries(
      input({
        contracts: [
          shared("46347534", "Teplárny Brno, a.s.", 263_730, 6881),
          shared("45534306", "ČSOB Pojišťovna, a. s.", 999_999, 6543),
        ],
      }),
    );
    expect(entries[0].czk).toBeUndefined();
    expect(contractAmountConflicts).toBe(1);
  });

  it("dvě RŮZNÉ smlouvy zůstávají dvěma řádky", () => {
    const { entries, mergedContractRows } = deriveDenikEntries(
      input({ contracts: [contract("a", "2026-07-20"), contract("b", "2026-07-20")] }),
    );
    expect(entries).toHaveLength(2);
    expect(mergedContractRows).toBe(0);
  });
});

describe("IČO se validuje, nekolabuje", () => {
  it("nekanonické IČO nevydá entitu firmy — řádek zůstane, klíč `firma:` nevznikne", () => {
    const { entries } = deriveDenikEntries(
      input({
        contracts: [{ ...contract("a", "2026-07-20"), ico: null, company: "Firma bez IČO" }],
        roles: [role(6543, null, "2026-07-20")],
      }),
    );
    const keys = entries.flatMap((e) => e.entities.map((en) => en.key));
    expect(keys).not.toContain("firma:");
    expect(keys.some((k) => k.startsWith("firma:"))).toBe(false);
    // Řádek se pořád zobrazuje — jméno firmy je ve větě, jen bez čipu.
    expect(entries.some((e) => e.titleCs.includes("Firma bez IČO"))).toBe(true);
    expect(entries.every((e) => e.entities.length > 0)).toBe(true);
  });

  it("dvě firmy bez IČO u jednoho poslance nesplynou v jeden řádek role", () => {
    const { entries } = deriveDenikEntries(
      input({
        roles: [
          { ...role(6543, null, "2026-07-20"), company: "Alfa" },
          { ...role(6543, null, "2026-07-20"), company: "Beta" },
        ],
      }),
    );
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(entries.filter((e) => e.kind === "roleStart")).toHaveLength(2);
  });

  it("IČO se normalizuje na kanonický osmimístný tvar — klíč i adresa jsou jeden tvar", () => {
    const { entries } = deriveDenikEntries(
      input({ roles: [role(6543, "2867681", "2026-07-20")] }),
    );
    const firma = entries[0].entities.find((en) => en.key.startsWith("firma:"))!;
    expect(firma.key).toBe("firma:02867681");
    expect(firma.href).toBe("/penize/firma/02867681");
  });
});

describe("všech devět zobrazitelných change eventů má českou větu", () => {
  const ev = (id: string, over: Partial<DenikChange>): DenikChange => ({
    id,
    eventType: "tie-new",
    recordedAt: "2026-07-22T08:00:00.000Z",
    mpName: "Jan Novák",
    pspId: 6543,
    company: "Firma s.r.o.",
    ico: "00000100",
    contractLabel: null,
    termCode: null,
    functionNameCz: null,
    source: "diff snímků ingestů — psp.cz",
    pending: false,
    ...over,
  });

  it("žádný typ nezmizí a každý dostane větu, druh a tón", () => {
    const { entries } = deriveDenikEntries(
      input({ changes: DENIK_CHANGE_TYPES.map((t, i) => ev(`c${i}`, { eventType: t })) }),
    );
    expect(entries).toHaveLength(DENIK_CHANGE_TYPES.length);
    for (const e of entries) {
      expect(e.titleCs.length).toBeGreaterThan(10);
      expect(e.titleCs).not.toMatch(/undefined|null|-new|-changed|-removed/);
    }
  });

  it("mandát a funkce v orgánu mají VLASTNÍ druhy — ne „zápis do grafu“", () => {
    const { entries } = deriveDenikEntries(
      input({
        changes: [
          ev("m", { eventType: "mandate-removed", termCode: "PSP10" }),
          ev("r", { eventType: "role-new", functionNameCz: "místopředseda výboru" }),
          ev("t", { eventType: "tie-new" }),
        ],
      }),
    );
    const byId = new Map(entries.map((e) => [e.id, e]));
    expect(byId.get("change:m")!.kind).toBe("mandate");
    expect(byId.get("change:m")!.titleCs).toBe(
      "zaznamenán zánik mandátu v evidenci — Jan Novák (období PSP10)",
    );
    // Snímek nemluví o důvodu ani okamžiku, jen o tom, že řádek v dumpu není.
    expect(byId.get("change:m")!.titleCs).toContain("v evidenci");
    expect(byId.get("change:r")!.kind).toBe("organRole");
    expect(byId.get("change:r")!.titleCs).toBe(
      "zaznamenán vznik funkce ve sněmovním orgánu — Jan Novák: místopředseda výboru",
    );
    expect(byId.get("change:t")!.kind).toBe("change");
  });

  it("„čeká na kontrolu“ je stav VAZBY — mandátový řádek o kontrole netvrdí nic", () => {
    const { entries } = deriveDenikEntries(
      input({
        changes: [
          ev("m", { eventType: "mandate-removed", pending: false }),
          ev("t", { eventType: "tie-new", pending: true }),
        ],
      }),
    );
    const byId = new Map(entries.map((e) => [e.id, e]));
    expect(byId.get("change:m")!.pending).toBe(false);
    expect(byId.get("change:t")!.pending).toBe(true);
  });
});

describe("řádek nese svůj doklad, ne jen jméno rejstříku", () => {
  it("smlouva a role odkazují téhož rejstříku jako /dukazy — jeden builder, ne dvě adresy", () => {
    const { entries } = deriveDenikEntries(
      input({
        contracts: [contract("a", "2026-07-20")],
        roles: [role(6543, "00000100", "2026-07-20")],
      }),
    );
    for (const e of entries) {
      expect(e.links.map((l) => l.label)).toEqual(["ARES VR", "Hlídač státu", "Registr smluv"]);
      expect(e.links.every((l) => l.href.startsWith("https://"))).toBe(true);
      expect(e.links.every((l) => l.href.includes("00000100"))).toBe(true);
    }
  });

  it("firma bez kanonického IČO nedostane odkaz — nikdy adresa do prázdna", () => {
    const { entries } = deriveDenikEntries(input({ roles: [role(6543, null, "2026-07-20")] }));
    expect(entries[0].links).toEqual([]);
  });

  it("smlouva dvou dodavatelů pojmenuje odkaz firmou, aby bylo jasné, čí rejstřík se otevírá", () => {
    const sup = (ico: string, company: string) => ({
      id: "contract:x",
      title: "Dodávka",
      signedOn: "2026-07-20",
      amountCzk: 1,
      company,
      ico,
      mps: [{ pspId: 6543, name: "Jan Novák", pending: false }],
    });
    const { entries } = deriveDenikEntries(
      input({ contracts: [sup("00000100", "Alfa"), sup("00000200", "Beta")] }),
    );
    expect(entries[0].links.map((l) => l.label)).toEqual([
      "ARES VR · Alfa",
      "Hlídač státu · Alfa",
      "Registr smluv · Alfa",
      "ARES VR · Beta",
      "Hlídač státu · Beta",
      "Registr smluv · Beta",
    ]);
  });

  it("tisk odkazuje psp.cz — `buildRegistryLinks` o tisku neví nic, `sourceLinksFor` ano", () => {
    const { entries } = deriveDenikEntries(
      input({
        bills: [
          {
            cislo: 58,
            title: "Novela",
            sponsors: [{ pspId: 6543, name: "Jan Novák" }],
            committees: [{ organLabel: "hospodářský výbor", assignedOn: "2026-07-20" }],
            fateSb: null,
            fatePublishedOn: null,
          },
        ],
      }),
    );
    expect(entries[0].links).toEqual([
      { label: "psp.cz", href: "https://www.psp.cz/sqw/historie.sqw?o=10&t=58" },
    ]);
  });

  it("rozhodnutí brány nese id svého řádku v append-only logu", () => {
    const { entries } = deriveDenikEntries(input({ reviews: [review("r1", "2026-07-21T09:00:00.000Z")] }));
    expect(entries[0].evidence).toEqual([{ label: "review_audit", value: "r1" }]);
  });

  it("řádek proudu „zaznamenáno“ nese ukazatel na doklad, ne jen tvrzení o změně", () => {
    const { entries } = deriveDenikEntries(
      input({
        changes: [
          {
            id: "chev:tie-new:a|b",
            eventType: "tie-new",
            recordedAt: "2026-07-22T08:00:00.000Z",
            mpName: "Jan Novák",
            pspId: 6543,
            company: "Firma s.r.o.",
            ico: "00000100",
            contractLabel: null,
            termCode: null,
            functionNameCz: null,
            evidence: { rel: "linked_to", rowId: 7 },
            source: "kg_edge_history — bitemporální graf",
            pending: true,
          },
        ],
      }),
    );
    // Deterministicky seřazené dvojice — dvě sestavení téhož vstupu jsou shodná.
    expect(entries[0].evidence).toEqual([
      { label: "rel", value: "linked_to" },
      { label: "rowId", value: "7" },
    ]);
  });
});
