// Invarianty knihy datovaných faktů. Hlídají PRAVIDLA (možné datum, pořadí,
// napojení na výřez), ne dnešní obsah databáze.

import { describe, expect, it } from "vitest";
import { isCzechSafe } from "@/lib/analysis/language-gate";
import cs from "@/messages/cs.json";
import { buildDatedFacts, FEED_ROWS, type DatedFactInput } from "./datedFacts";

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
            mpName: "Jan Novák",
            role: "jednatel",
            roleValidFrom: "2012-04-26",
            roleValidTo: null,
            refs: ["p:100", "c:00000100"],
            pending: true,
          },
        ],
        bills: [
          {
            cislo: 72,
            refs: ["b:72"],
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

describe("copy knihy provozu", () => {
  it("české řetězce projdou jazykovou branou", () => {
    const feed = cs.dashboard.feed as Record<string, unknown>;
    const fact = feed.fact as Record<string, string>;
    const strings = [
      feed.emptyReal,
      feed.factPending,
      feed.realSource,
      feed.droppedImplausible,
      ...Object.values(fact),
    ] as string[];
    for (const text of strings) {
      expect(isCzechSafe(text), text).toBe(true);
    }
  });
});
