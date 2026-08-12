/*
 * PER-COMPANY ČTENÍ SMLUV — souběh a memoizace.
 *
 * `/penize/[pspId]`, `/penize/firma/[ico]` a spis poslance (`features/profile`,
 * přes `getMoneyMpDetail`) sahají na TUTÉŽ vrstvu: jeden indexovaný `supplies`
 * read na tied firmu. Do 2026-08-12 se ty ready (a) awaitovaly V ŘADĚ, takže
 * poslanec se 14 firmami platil 14 round tripů za sebou, a (b) neměly ŽÁDNOU
 * memoizaci, přestože `loadClubs` i fold `supplies` o pár desítek řádků výš ji
 * mají — a jedna firma je vázaná až na 14 poslanců, takže se četla znovu za
 * každý spis, který ji zmíní.
 *
 * Testy hlídají to, co se na tom dá rozbít potichu:
 *  • souběh (jinak je to jen jiný zápis téže sériové ceny),
 *  • že druhý čtenář dostane TÝŽ ročník (dvě vintage jednoho čísla na dvou
 *    plochách je přesně to, čemu MONEY_MEMO_TTL_MS předchází),
 *  • že se NEPAMATUJE prázdný odečet ani selhání (disciplína `loadClubs`).
 *
 * Obchod se odehrává nad SYNTETICKÝM storem (živý ./.pglite drží jiná session).
 */

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const kgNeighbours = vi.fn();
const getKgNodes = vi.fn();
const listMandates = vi.fn(async () => []);
const clubByMandate = vi.fn(async () => new Map());

vi.mock("@/lib/db/store", () => ({
  getStore: async () => ({ kgNeighbours, getKgNodes, listMandates, clubByMandate }),
}));
vi.mock("@/lib/db/readiness", () => ({ storeReady: async () => true }));

const { loadMpMoneySlice, loadCompanyMoneySlice, resetSuppliesMemo } = await import("./moneyLoader");

const PERSON = "psp:person:100";
const ALFA = "company:ico:00000111";
const BETA = "company:ico:00000222";
const GAMA = "company:ico:00000333";

const companyNode = (id: string) => ({
  id,
  kind: "company",
  label: id,
  props: { ico: id.split(":").pop() },
  provenance: { pass: 28 },
});

const personNode = () => ({
  id: PERSON,
  kind: "person",
  label: "Nováková Jana",
  props: {},
  provenance: { pass: 10 },
});

const tieEdge = (companyId: string) => ({
  src: PERSON,
  rel: "linked_to",
  dst: companyId,
  weight: null,
  props: { role: "jednatel", tie_class: "owner_operator", review_state: "pending_review" },
  provenance: { pass: 10 },
});

const suppliesEdge = (companyId: string, contract: string, amount: number) => ({
  src: companyId,
  rel: "supplies",
  dst: contract,
  weight: amount,
  props: {},
  provenance: { pass: 12 },
});

const contractNode = (id: string, signedOn: string) => ({
  id,
  kind: "contract",
  label: id,
  props: { signedOn },
  provenance: { pass: 12 },
});

/** Kolik smluv která firma nese. `[]` = firma bez jediné smlouvy (prázdný odečet). */
const CONTRACTS: Record<string, Array<[string, number]>> = {
  [ALFA]: [
    ["contract:a1", 1_000],
    ["contract:a2", 2_000],
  ],
  [BETA]: [["contract:b1", 5_000]],
  [GAMA]: [],
};

/** Kolik `supplies` čtení proběhlo na kterou firmu, a jaký byl největší souběh. */
let suppliesReads: string[] = [];
let inFlight = 0;
let maxInFlight = 0;
/** Firmy, na kterých má čtení SELHAT (simulace přechodného výpadku PGlite). */
let failing = new Set<string>();

function installStore() {
  kgNeighbours.mockImplementation(async (opts: { id: string; rels?: string[] }) => {
    const rel = opts.rels?.[0];
    if (rel === "linked_to") {
      if (opts.id === PERSON) {
        return {
          edges: [tieEdge(ALFA), tieEdge(BETA), tieEdge(GAMA)],
          nodes: [personNode(), companyNode(ALFA), companyNode(BETA), companyNode(GAMA)],
        };
      }
      return { edges: [tieEdge(opts.id)], nodes: [personNode(), companyNode(opts.id)] };
    }
    if (rel === "owns_stake") return { edges: [], nodes: [] };
    // supplies — the read under test
    suppliesReads.push(opts.id);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await new Promise((r) => setTimeout(r, 5));
      if (failing.has(opts.id)) throw new Error(`simulated read failure for ${opts.id}`);
      const rows = CONTRACTS[opts.id] ?? [];
      return {
        edges: rows.map(([c, amount]) => suppliesEdge(opts.id, c, amount)),
        nodes: rows.map(([c]) => contractNode(c, "2026-01-01")),
      };
    } finally {
      inFlight -= 1;
    }
  });
  getKgNodes.mockImplementation(async (ids: string[]) =>
    ids.map((id) => (id === PERSON ? personNode() : companyNode(id))),
  );
}

beforeEach(() => {
  resetSuppliesMemo();
  suppliesReads = [];
  inFlight = 0;
  maxInFlight = 0;
  failing = new Set();
  vi.clearAllMocks();
  installStore();
});

describe("loadMpMoneySlice — per-company reads", () => {
  it("issues the per-company reads in PARALLEL, not one after another", async () => {
    const slice = (await loadMpMoneySlice(100))!;
    expect(slice).not.toBeNull();
    // Three tied companies, three reads — and at least two of them in flight at once.
    // A serial `for … await` loop can never exceed 1.
    expect(suppliesReads).toHaveLength(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("keeps the map order the serial loop produced — the ledger reads it in that order", async () => {
    const slice = (await loadMpMoneySlice(100))!;
    expect([...slice.contractsByCompany.keys()]).toEqual([ALFA, BETA, GAMA]);
    expect([...slice.linesByCompany.keys()]).toEqual([ALFA, BETA, GAMA]);
    expect(slice.contractsByCompany.get(ALFA)).toEqual({ count: 2, czk: 3_000, amounts: [1_000, 2_000] });
    expect(slice.linesByCompany.get(ALFA)!.map((l) => l.id)).toEqual(["contract:a2", "contract:a1"]);
  });
});

describe("the per-company supplies memo", () => {
  it("serves a second reader from the same read — including a DIFFERENT surface", async () => {
    await loadMpMoneySlice(100);
    expect(suppliesReads.filter((id) => id === ALFA)).toHaveLength(1);
    // The company case file asks about the same firm: it must get the same vintage,
    // not a second read of the same layer on its own clock.
    const company = (await loadCompanyMoneySlice(ALFA))!;
    expect(company.contracts.czk).toBe(3_000);
    expect(suppliesReads.filter((id) => id === ALFA)).toHaveLength(1);
  });

  it("does NOT memoize an empty read — a hiccup must not become 'no contracts' for a day", async () => {
    await loadMpMoneySlice(100);
    expect(suppliesReads.filter((id) => id === GAMA)).toHaveLength(1);
    const again = (await loadCompanyMoneySlice(GAMA))!;
    expect(again.contracts.count).toBe(0);
    // GAMA answered zero, so it is read again rather than remembered as contract-free.
    expect(suppliesReads.filter((id) => id === GAMA)).toHaveLength(2);
    // …while a company that DID answer is not re-read.
    expect(suppliesReads.filter((id) => id === ALFA)).toHaveLength(1);
  });

  it("does NOT memoize a failure — the next request re-reads and can succeed", async () => {
    failing = new Set([ALFA]);
    // A per-company failure propagates out of the loader, which converts it to null.
    expect(await loadMpMoneySlice(100)).toBeNull();
    expect(suppliesReads.filter((id) => id === ALFA)).toHaveLength(1);

    failing = new Set();
    const recovered = (await loadCompanyMoneySlice(ALFA))!;
    expect(recovered.contracts.czk).toBe(3_000);
    expect(suppliesReads.filter((id) => id === ALFA)).toHaveLength(2);
  });

  it("resetSuppliesMemo drops the per-company cells too", async () => {
    await loadCompanyMoneySlice(ALFA);
    expect(suppliesReads.filter((id) => id === ALFA)).toHaveLength(1);
    resetSuppliesMemo();
    await loadCompanyMoneySlice(ALFA);
    expect(suppliesReads.filter((id) => id === ALFA)).toHaveLength(2);
  });

  it("runs on the IMPORTED window — no second TTL literal in this module", () => {
    // Two memos over one graph layer on two clocks is how two surfaces start printing
    // two vintages of one number. The rule is enforced by reading the source: the
    // module may name MONEY_MEMO_TTL_MS, never re-declare it or a duplicate literal.
    const src = readFileSync(new URL("./moneyLoader.ts", import.meta.url), "utf8");
    expect(src).toContain('from "@/features/dashboard/freshness"');
    expect(src).not.toMatch(/const\s+MONEY_MEMO_TTL_MS\s*=/);
    // Every memo in the file compares against the same imported symbol.
    const windows = [...src.matchAll(/Date\.now\(\)\s*-\s*\w+(?:\.at)?\s*[<>]=?\s*(\w+)/g)].map((m) => m[1]);
    expect(windows.length).toBeGreaterThanOrEqual(3);
    expect(new Set(windows)).toEqual(new Set(["MONEY_MEMO_TTL_MS"]));
  });
});
