import { describe, expect, it } from "vitest";
import { buildMoneyGraph, moneyTrails, type Company, type Contract, type PersonCompanyLink } from "./kg-money";

/* Two places where the module's own doctrine was not looked at: the human gate has THREE
 * states, and `buildMoneyGraph`'s stats folded `rejected` into `pending_review` (every
 * non-verified link was „pending"); and `moneyTrails` summed an undisclosed contract
 * amount as 0 CZK with no count of how many it swallowed — the exact `?? 0` the sibling
 * money-feed.ts fixed for subsidies and donations. SYNTHETIC fixture only
 * (2026-09-06, scan-sweep, bounty-hunter). */

const companies: Company[] = [{ ico: "111", name: "Alfa s.r.o." }];
const contracts: Contract[] = [
  { id: "k1", supplierIco: "111", amount: 1000, signedOn: "2026-02-01" },
  { id: "k2", supplierIco: "111", amount: null, signedOn: "2026-03-01" }, // undisclosed
];
const links: PersonCompanyLink[] = [
  { personPspId: 1, ico: "111", role: "jednatel", source: "x", state: "verified" },
  { personPspId: 2, ico: "111", role: "společník", source: "x", state: "pending_review" },
  { personPspId: 3, ico: "111", role: "člen", source: "x", state: "rejected" },
];

describe("buildMoneyGraph stats — three gate states, three counters (2026-09-06)", () => {
  it("a rejected tie is counted as rejected, never as pending review", () => {
    const g = buildMoneyGraph(links, companies, contracts);
    expect(g.stats).toMatchObject({ linked_to: 3, verified: 1, pending_review: 1, rejected: 1 });
  });
});

describe("moneyTrails — an undisclosed contract amount is counted, not summed as 0 (2026-09-06)", () => {
  it("totalAmount holds only disclosed amounts and undisclosedContracts says how many it lacks", () => {
    const g = buildMoneyGraph(links, companies, contracts);
    const t = moneyTrails(g, links).find((x) => x.personPspId === 1)!;
    expect(t).toMatchObject({ contractCount: 2, totalAmount: 1000, undisclosedContracts: 1, fullyVerified: true });
  });

  it("a rejected tie contributes no trail at all", () => {
    const g = buildMoneyGraph(links, companies, contracts);
    expect(moneyTrails(g, links).some((x) => x.personPspId === 3)).toBe(false);
  });
});
