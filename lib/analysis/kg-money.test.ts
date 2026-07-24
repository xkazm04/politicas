import { describe, expect, it } from "vitest";
import {
  buildMoneyGraph,
  isPreservedTiePropKey,
  mergePreservedTieProps,
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

describe("mergePreservedTieProps (D1, batch 004)", () => {
  const fresh = { role: "jednatel", source: "oi-declaration-2026", review_state: "pending_review" };

  it("no existing edge (first ingest) → fresh wins entirely", () => {
    expect(mergePreservedTieProps(undefined, fresh)).toEqual(fresh);
  });

  it("existing edge with a preserved key present → existing wins for that key", () => {
    const existing = {
      role: "jednatel",
      source: "oi-declaration-2026",
      review_state: "verified",
      last_decision: "confirm",
      last_reviewer: "tester",
      last_reviewed_at: "2026-07-01T00:00:00.000Z",
      review_note: "confirmed via ARES VR",
      corroboration: "registry-confirmed",
    };
    const merged = mergePreservedTieProps(existing, fresh);
    expect(merged.review_state).toBe("verified");
    expect(merged.last_decision).toBe("confirm");
    expect(merged.last_reviewer).toBe("tester");
    expect(merged.last_reviewed_at).toBe("2026-07-01T00:00:00.000Z");
    expect(merged.review_note).toBe("confirmed via ARES VR");
    expect(merged.corroboration).toBe("registry-confirmed");
    // non-preserved keys still come from fresh
    expect(merged.role).toBe("jednatel");
    expect(merged.source).toBe("oi-declaration-2026");
  });

  it("existing edge missing a preserved key → fresh fills it in (never forces undefined)", () => {
    const existing = { role: "jednatel", source: "old-source" }; // no review_state at all
    const merged = mergePreservedTieProps(existing, fresh);
    expect(merged.review_state).toBe("pending_review"); // fresh's default, not erased to undefined
    expect(merged.source).toBe("oi-declaration-2026"); // non-preserved key: fresh still wins
  });

  it("preserves prefixed/suffixed preserved-key families: corroboration*, role_valid_*, false_edge_*, owner_stake_*, *_provenance", () => {
    const existing = {
      corroboration_source: "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/29442044",
      corroboration_provenance: "ares-vr:2026-06-01",
      corroboration_confidence: "high",
      role_valid_from: "2016-01-01",
      role_valid_to: "2020-01-01",
      temporal_status: "ended",
      tie_class: "owner-operator",
      false_edge_suspected: true,
      false_edge_reason: "name collision candidate",
      role_provenance: "ares-vr:2026-06-01",
      owner_stake_pct: 25,
      owner_stake_from: "2015-11-11",
    };
    const merged = mergePreservedTieProps(existing, fresh);
    expect(merged).toMatchObject(existing);
  });

  // D2 (batch 004, Opus re-audit): the preserve list was originally hand-written from
  // a defect writeup and missed real fields. This is the fix's regression guard:
  // the COMPLETE real key set reconcile-ares-vr.ts's propsMerge + the batch-001
  // corroboration payload actually write onto a `linked_to` edge (verified against a
  // live census of all 260 edges, see kg-money.ts's PRESERVED_TIE_PROP_KEYS comment).
  // If a future edit narrows the preserve list, this test catches it structurally
  // instead of relying on someone re-deriving the list from a writeup again.
  it("covers every prop key the live graph's 260 linked_to edges + reconcile-ares-vr.ts actually write (D2 regression)", () => {
    const liveGraphKeySnapshot = {
      // present on all 260 edges (base link fields — NOT preserved, fresh legitimately wins)
      role: "jednatel",
      source: "oi-declaration-2026",
      // human-gated / annotation fields — MUST be preserved
      tie_class: "owner-operator",
      review_state: "verified",
      corroboration: "registry-confirmed",
      reviewer_note: "ARES VR: jednatel/společník 2017-08-29→trvá (25% podíl) · peníze: current",
      corroboration_source: "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/04934482",
      corroboration_provenance: "ares-vr:2026-06-01",
      corroboration_confidence: "high",
      temporal_status: "current",
      role_valid_to: "2020-01-01",
      role_valid_from: "2016-01-01",
      flags: ["stale-ongoing-in-graph"],
      false_edge_reason: "name collision candidate",
      false_edge_suspected: true,
      false_edge_provenance: "ares-vr:2026-06-01",
      signal: 5,
      owner_stake_pct: 25,
      corroboration_note: "not a real field — corroboration* prefix must still not choke on it",
      owner_stake_from: "2015-11-11",
      prior_term: "2005-04-15..2011-02-21",
    };
    const NOT_PRESERVED = new Set(["role", "source"]); // base fields; fresh legitimately overwrites
    for (const key of Object.keys(liveGraphKeySnapshot)) {
      if (NOT_PRESERVED.has(key)) continue;
      expect(isPreservedTiePropKey(key), `expected "${key}" to be preserved`).toBe(true);
    }
  });
});
