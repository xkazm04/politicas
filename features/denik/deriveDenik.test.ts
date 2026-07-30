// Deník republiky — invarianty čistého odvození (moonshot 3A). Hlídají
// PRAVIDLA (možné datum, seskupení po dnech, deterministické pořadí, filtr
// entity, kotvy dnů), ne dnešní obsah databáze.

import { describe, expect, it } from "vitest";
import {
  buildDenik,
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
} from "./deriveDenik";

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

const role = (pspId: number, ico: string, validFrom: string | null, validTo: string | null = null) => ({
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
