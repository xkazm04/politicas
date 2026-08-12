// Invarianty knihy datovaných faktů. Hlídají PRAVIDLA (možné datum, pořadí,
// napojení na výřez), ne dnešní obsah databáze.

import { describe, expect, it } from "vitest";
import { isCzechSafe } from "@/lib/analysis/language-gate";
import cs from "@/messages/cs.json";
import { buildDatedFacts, FEED_ROWS, locateDatedFact, type DatedFactInput } from "./datedFacts";

const input = (over: Partial<DatedFactInput> = {}): DatedFactInput => ({
  today: "2026-07-28",
  contracts: [],
  ties: [],
  bills: [],
  ...over,
});

const contract = (id: string, signedOn: string | null, amountCzk: number | null = 1000) => ({
  id,
  title: `Smlouva ${id}`,
  signedOn,
  amountCzk,
  company: "Firma s.r.o.",
  refs: ["c:00000100"],
  subjectRef: "c:00000100",
  pending: true,
});

describe("buildDatedFacts — nemožné datum není datum", () => {
  it("vyhodí podpisy mimo možný rozsah, spočítá je a NEOPRAVÍ", () => {
    const { facts, droppedImplausible } = buildDatedFacts(
      input({
        contracts: [
          contract("a", "0002-02-25"),
          contract("b", "3062-07-16"),
          contract("c", "2027-01-01"), // budoucnost vůči `today`
          contract("d", "2029-05-05"),
          contract("e", "2025-02-05"),
        ],
      }),
    );
    expect(droppedImplausible).toBe(4);
    expect(facts.map((f) => f.date)).toEqual(["2025-02-05"]);
  });

  it("fakt bez data se do chronologie nepočítá ani jako vyřazený", () => {
    const { facts, droppedImplausible } = buildDatedFacts(input({ contracts: [contract("a", null)] }));
    expect(facts).toHaveLength(0);
    expect(droppedImplausible).toBe(0);
  });

  it("hranice rozsahu jsou včetně — 1993-01-01 i dnešek projdou", () => {
    const { facts } = buildDatedFacts(
      input({ contracts: [contract("a", "1993-01-01"), contract("b", "2026-07-28")] }),
    );
    expect(facts.map((f) => f.date)).toEqual(["2026-07-28", "1993-01-01"]);
  });
});

describe("buildDatedFacts — pořadí a výběr", () => {
  it("řadí datum sestupně a při shodě identifikátor vzestupně", () => {
    const { facts } = buildDatedFacts(
      input({
        contracts: [
          contract("z", "2025-01-01"),
          contract("a", "2025-01-01"),
          contract("m", "2026-01-01"),
        ],
      }),
    );
    expect(facts.map((f) => f.id)).toEqual(["contract:m", "contract:a", "contract:z"]);
  });

  it("je deterministický a seřízne se na FEED_ROWS", () => {
    const many = Array.from({ length: FEED_ROWS + 8 }, (_, i) =>
      contract(String(i).padStart(2, "0"), `2025-01-${String((i % 28) + 1).padStart(2, "0")}`),
    );
    const a = buildDatedFacts(input({ contracts: many }));
    const b = buildDatedFacts(input({ contracts: many }));
    expect(a.facts).toHaveLength(FEED_ROWS);
    expect(a.considered).toBe(many.length);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// Okno rubriky velína bylo do 2026-08-12 zároveň hranicí ODVODITELNOSTI: exponát
// jednoho faktu se rozlišoval proti dvanácti nejnovějším řádkům, takže každá
// citace umřela dvanáctým novějším faktem a brána /overeni pak o pořád
// odvoditelném záznamu odpovídala „zaznam-nenalezen".
describe("buildDatedFacts — okno je ŘEZ, ne hranice odvoditelnosti", () => {
  const many = Array.from({ length: FEED_ROWS + 8 }, (_, i) =>
    contract(String(i).padStart(2, "0"), `2025-01-${String(i + 1).padStart(2, "0")}`),
  );
  const windowed = buildDatedFacts(input({ contracts: many }));
  const full = buildDatedFacts(input({ contracts: many }), { limit: null });

  it("výchozí volání seřízne na FEED_ROWS, `limit: null` vrátí celou možnou množinu", () => {
    expect(windowed.facts).toHaveLength(FEED_ROWS);
    expect(full.facts).toHaveLength(many.length);
    // `considered` popisuje celou možnou množinu v OBOU případech — je to počet
    // nabídnutých faktů, ne délka okna.
    expect(windowed.considered).toBe(many.length);
    expect(full.considered).toBe(many.length);
  });

  it("okno je PREFIX plné knihy — tytéž řádky v tomtéž pořadí", () => {
    expect(windowed.facts).toEqual(full.facts.slice(0, FEED_ROWS));
  });

  it("locateDatedFact najde fakt ZA oknem a označí ho, místo aby řekl „není“", () => {
    const oldest = full.facts.at(-1)!;
    const hit = locateDatedFact(full, oldest.id);
    expect(hit).not.toBeNull();
    expect(hit!.fact).toEqual(oldest);
    expect(hit!.beyondWindow).toBe(true);
    // Řádek uvnitř okna je normální nález.
    expect(locateDatedFact(full, full.facts[0].id)!.beyondWindow).toBe(false);
  });

  it("nad seříznutou knihou `beyondWindow` z definice nikdy nenastane", () => {
    for (const f of windowed.facts) {
      expect(locateDatedFact(windowed, f.id)!.beyondWindow).toBe(false);
    }
    // …a fakt za oknem tam prostě není — proto se exponát ptá plné knihy.
    expect(locateDatedFact(windowed, full.facts.at(-1)!.id)).toBeNull();
  });

  it("fakt, který kniha neodvozuje, je null — nic podobného se nedosazuje", () => {
    expect(locateDatedFact(full, "contract:neexistuje")).toBeNull();
    expect(locateDatedFact({ facts: [], droppedImplausible: 0, considered: 0 }, "cokoliv")).toBeNull();
  });

  it("limit se dá zadat i číslem a nemění nic jiného než délku", () => {
    const three = buildDatedFacts(input({ contracts: many }), { limit: 3 });
    expect(three.facts).toEqual(full.facts.slice(0, 3));
    expect(three.considered).toBe(many.length);
  });
});

describe("buildDatedFacts — napojení na výřez a označení stavu", () => {
  it("řádek bez uzlu ve výřezu se nezobrazí (zaměřovač by mířil do prázdna)", () => {
    const { facts } = buildDatedFacts(
      input({ contracts: [{ ...contract("a", "2025-01-01"), refs: [] }] }),
    );
    expect(facts).toHaveLength(0);
  });

  it("každý zobrazený řádek má aspoň jeden uzel a nese stav vazby", () => {
    const { facts } = buildDatedFacts(
      input({
        contracts: [contract("a", "2025-01-01")],
        ties: [
          {
            company: "Firma s.r.o.",
            companyRef: "c:00000100",
            mpName: "Jan Novák",
            role: "jednatel",
            roleValidFrom: "2012-04-26",
            roleValidTo: null,
            refs: ["p:100", "c:00000100"],
            subjectRef: "p:100",
            pending: true,
          },
        ],
        bills: [
          {
            cislo: 72,
            refs: ["b:72"],
            subjectRef: "b:72",
            committees: [{ organLabel: "ÚPV", role: "garancni", assignedOn: "2026-02-13" }],
            fateSb: null,
            fatePublishedOn: null,
          },
        ],
      }),
    );
    expect(facts.every((f) => f.refs.length > 0)).toBe(true);
    expect(facts.find((f) => f.kind === "roleStart")?.pending).toBe(true);
    // Fakt o tisku nestojí na neověřené vazbě — označený být nesmí.
    expect(facts.find((f) => f.kind === "billAssigned")?.pending).toBe(false);
    // Role bez data konce nevyrobí řádek „výmaz".
    expect(facts.some((f) => f.kind === "roleEnd")).toBe(false);
  });
});

describe("buildDatedFacts — identita faktu nezávisí na tom, co je kolem nakreslené", () => {
  const tie = (refs: string[]) => ({
    company: "Firma s.r.o.",
    companyRef: "c:00000100",
    mpName: "Jan Novák",
    role: "jednatel",
    roleValidFrom: "2012-04-26",
    roleValidTo: "2020-01-01",
    refs,
    subjectRef: "p:100",
    pending: true,
  });

  it("širší `refs` (strana, peníze) nehnou id faktu — a tedy ani adresou exponátu", () => {
    const narrow = buildDatedFacts(input({ ties: [tie(["p:100", "c:00000100"])] })).facts;
    const wide = buildDatedFacts(
      input({ ties: [tie(["p:100", "c:00000100", "m:00000100", "y:KDU-ČSL"])] }),
    ).facts;
    expect(narrow.map((f) => f.id)).toEqual(wide.map((f) => f.id));
    expect(narrow.find((f) => f.kind === "roleStart")!.id).toBe("role-from:p:100|c:00000100");
    // Filtr se ale rozšířil — o to celé jde.
    expect(wide.find((f) => f.kind === "roleStart")!.refs).toContain("y:KDU-ČSL");
  });

  it("dvě role téhož poslance u dvou firem jsou dva různé fakty", () => {
    const { facts } = buildDatedFacts(
      input({
        ties: [tie(["p:100", "c:00000100"]), { ...tie(["p:100", "c:00000200"]), companyRef: "c:00000200" }],
      }),
    );
    expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length);
  });
});

describe("buildDatedFacts — zaměřovač připíná PODMĚT, ne první prvek pole", () => {
  const facts = buildDatedFacts(
    input({
      // U smlouvy je peněžní uzel v `refs` PRVNÍ; kdyby rozhodovalo pořadí,
      // zaměřovač by připnul peníze místo firmy, o které věta je.
      contracts: [{ ...contract("a", "2025-01-01"), refs: ["m:00000100", "c:00000100"] }],
      ties: [
        {
          company: "Firma s.r.o.",
          companyRef: "c:00000100",
          mpName: "Jan Novák",
          role: "jednatel",
          roleValidFrom: "2012-04-26",
          roleValidTo: "2020-01-01",
          // Firma první — podmět („Jan Novák zapsán…") je ale poslanec.
          refs: ["c:00000100", "p:100"],
          subjectRef: "p:100",
          pending: true,
        },
      ],
      bills: [
        {
          cislo: 72,
          refs: ["b:72"],
          subjectRef: "b:72",
          committees: [{ organLabel: "ÚPV", role: "garancni", assignedOn: "2026-02-13" }],
          fateSb: "č. 1/2026 Sb.",
          fatePublishedOn: "2026-03-01",
        },
      ],
    }),
  ).facts;

  const of = (kind: string) => facts.find((f) => f.kind === kind);

  it("smlouva → uzel firmy", () => expect(of("contract")?.subjectRef).toBe("c:00000100"));
  it("zápis role → uzel poslance", () => expect(of("roleStart")?.subjectRef).toBe("p:100"));
  it("výmaz role → uzel poslance", () => expect(of("roleEnd")?.subjectRef).toBe("p:100"));
  it("přikázání výboru → uzel tisku", () => expect(of("billAssigned")?.subjectRef).toBe("b:72"));
  it("vyhlášení ve Sbírce → uzel tisku", () => expect(of("billPublished")?.subjectRef).toBe("b:72"));

  it("podmět, který výřez nekreslí, se NENAHRAZUJE jinou entitou", () => {
    const { facts: out } = buildDatedFacts(
      input({
        ties: [
          {
            company: "Firma s.r.o.",
            companyRef: "c:00000100",
            mpName: "Jan Novák",
            role: "jednatel",
            roleValidFrom: "2012-04-26",
            roleValidTo: null,
            // Uzel poslance se do výřezu nevešel — v `refs` je jen firma.
            refs: ["c:00000100"],
            subjectRef: "p:100",
            pending: true,
          },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].refs).toEqual(["c:00000100"]);
    expect(out[0].subjectRef).toBeNull();
  });
});

describe("copy knihy provozu", () => {
  it("české řetězce projdou jazykovou branou", () => {
    const feed = cs.dashboard.feed as Record<string, unknown>;
    const fact = feed.fact as Record<string, string>;
    const strings = [
      feed.emptyReal,
      feed.factPending,
      feed.realSource,
      feed.droppedImplausible,
      // Věta prázdného výběru a pravidlo filtru jsou taky prose, kterou píšeme MY.
      feed.emptySelection,
      feed.emptySelectionDenik,
      feed.filterRule,
      ...Object.values(fact),
    ] as string[];
    for (const text of strings) {
      expect(isCzechSafe(text), text).toBe(true);
    }
  });
});
