import { describe, expect, it } from "vitest";
import {
  buildMoneyGraph,
  moneyTrails,
  type Company,
  type Contract,
  type PersonCompanyLink,
} from "./kg-money";

// SYNTHETIC fixture only — the module must never be run on invented data in production.
const companies: Company[] = [
  { ico: "111", name: "Alfa s.r.o." },
  { ico: "222", name: "Beta a.s." },
];
const contracts: Contract[] = [
  { id: "k1", supplierIco: "111", amount: 1000, signedOn: "2026-02-01", subject: "IT services" },
  { id: "k2", supplierIco: "111", amount: 500, signedOn: "2026-03-01" },
  { id: "k3", supplierIco: "999", amount: 9999, signedOn: "2026-04-01" }, // unknown supplier
];
const links: PersonCompanyLink[] = [
  { personPspId: 6790, ico: "111", role: "jednatel", source: "oi-declaration-2026", state: "verified" },
  { personPspId: 6791, ico: "222", role: "společník", source: "or-officer-match", state: "pending_review" },
  { personPspId: 6792, ico: "888", role: "jednatel", source: "x", state: "verified" }, // unknown company
];

describe("buildMoneyGraph", () => {
  const g = buildMoneyGraph(links, companies, contracts);

  it("emits company + contract nodes, and supplies edges by IČO", () => {
    expect(g.nodes.filter((n) => n.kind === "company").map((n) => n.id).sort()).toEqual(["company:ico:111", "company:ico:222"]);
    expect(g.nodes.filter((n) => n.kind === "contract").map((n) => n.id).sort()).toEqual(["contract:k1", "contract:k2"]);
    const supplies = g.edges.filter((e) => e.rel === "supplies");
    expect(supplies).toHaveLength(2);
    expect(supplies.find((e) => e.dst === "contract:k1")).toMatchObject({ src: "company:ico:111", weight: 1000 });
  });

  it("surfaces a contract with an unknown supplier instead of inventing a company", () => {
    expect(g.danglingContracts).toEqual(["k3"]);
    expect(g.nodes.some((n) => n.id === "contract:k3")).toBe(false);
    expect(g.stats.contractsWithoutKnownSupplier).toBe(1);
  });

  it("carries the human-gate review state on every linked_to edge", () => {
    const linked = g.edges.filter((e) => e.rel === "linked_to");
    expect(linked).toHaveLength(2); // the link to unknown company 888 is skipped, never fabricated
    expect(linked.find((e) => e.src === "psp:person:6790")).toMatchObject({ dst: "company:ico:111", props: { review_state: "verified", role: "jednatel" } });
    expect(linked.find((e) => e.src === "psp:person:6791")?.props.review_state).toBe("pending_review");
  });

  it("never fabricates a node for a link to an unknown company", () => {
    expect(g.edges.some((e) => e.src === "psp:person:6792")).toBe(false);
    expect(g.stats).toMatchObject({ companies: 2, contracts: 2, supplies: 2, linked_to: 2, verified: 1, pending_review: 1 });
  });
});

describe("moneyTrails", () => {
  const g = buildMoneyGraph(links, companies, contracts);
  const trails = moneyTrails(g, links);

  it("traces MP → company → contract with totals, sorted by value", () => {
    expect(trails[0]).toMatchObject({ personPspId: 6790, contractCount: 2, totalAmount: 1500, fullyVerified: true });
  });

  it("marks a trail with any pending linkage as NOT fully verified", () => {
    const t = trails.find((x) => x.personPspId === 6791)!;
    expect(t).toMatchObject({ contractCount: 0, totalAmount: 0, fullyVerified: false });
  });
});
