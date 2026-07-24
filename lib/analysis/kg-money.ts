// Money-graph edge computation (FollowTheMoney) — the IČO join + the HUMAN GATE.
//
// Design: docs/knowledge-graph-loop.md §8.6 + politicas /penize ("kniha vazeb …
// verified/pending-review states, the trail methodology: IČO join + human gate").
// This is the MOST SENSITIVE part of the graph — it links real MPs to real
// companies and public contracts — so the project's hard rule applies with full
// force: TRUST IS THE PRODUCT, NEVER FABRICATE. An automated match is a LEAD, not
// a published fact: every `linked_to` edge carries a review state, and a match
// stays `pending_review` until a human confirms it.
//
// PURE and DB-free, like kg.ts: inputs are typed rows, outputs are node/edge
// descriptors an ingest script maps to KgNodeRow/KgEdgeRow. It does NOT know how to
// fetch or parse Registr smluv / ARES / the MP-linkage source — that adapter is the
// remaining DATA dependency (F6 stays blocked on it). This module is the join + gate,
// unit-tested, ready for real data. It must NEVER be run on invented data.
//
// The pipeline it completes:
//   Registr smluv (contracts, supplier IČO)  ─┐
//   ARES (IČO → company)                       ├─►  supplies: company → contract
//   MP↔company linkage (asset/OI declarations  │
//     or OR officer records) + human gate     ─┘─►  linked_to: person → company  (review-gated)
//   ⇒ traversable trail  MP —linked_to→ Company —supplies→ Contract

export type ReviewState = "verified" | "pending_review";

/** A company keyed by IČO (Czech business id). From ARES / obchodní rejstřík. */
export interface Company {
  ico: string;
  name: string;
}
/** A public contract with its supplier's IČO. From Registr smluv. */
export interface Contract {
  id: string;
  supplierIco: string;
  amount: number | null; // CZK; null when undisclosed
  signedOn: string | null; // ISO date
  subject?: string | null;
}
/**
 * The MP↔company linkage — the load-bearing, sensitive edge. Comes from a
 * DECLARED source (conflict-of-interest / asset declarations under 159/2006, or
 * obchodní-rejstřík officer/owner records), never guessed from name similarity
 * alone. `state` is the human gate: an automated match is `pending_review` until a
 * person confirms it; only then does the app present it as an established tie.
 */
export interface PersonCompanyLink {
  personPspId: number;
  ico: string;
  role: string; // e.g. "jednatel", "společník", "člen dozorčí rady"
  source: string; // provenance of the linkage (which declaration / register)
  state: ReviewState;
}

export interface MoneyNode {
  id: string;
  kind: "company" | "contract";
  label: string;
  props: Record<string, unknown>;
}
export interface MoneyEdge {
  src: string;
  rel: "linked_to" | "supplies";
  dst: string;
  weight: number | null;
  props: Record<string, unknown>;
}
export interface MoneyGraph {
  nodes: MoneyNode[];
  edges: MoneyEdge[];
  stats: {
    companies: number;
    contracts: number;
    linked_to: number;
    supplies: number;
    verified: number;
    pending_review: number;
    contractsWithoutKnownSupplier: number;
  };
  /** Contract ids whose supplier IČO had no company — surfaced, never dropped silently. */
  danglingContracts: string[];
}

export const companyUrn = (ico: string): string => `company:ico:${ico}`;
export const contractUrn = (id: string): string => `contract:${id}`;

/**
 * Build the money sub-graph from the three typed feeds. `supplies` edges require a
 * known company for the contract's supplier IČO (a contract with an unknown supplier
 * is surfaced in `danglingContracts`, not silently linked). `linked_to` edges carry
 * their review state — nothing here is presented as fact; the gate is downstream.
 */
export function buildMoneyGraph(
  links: readonly PersonCompanyLink[],
  companies: readonly Company[],
  contracts: readonly Contract[],
): MoneyGraph {
  const companyByIco = new Map<string, Company>();
  for (const c of companies) companyByIco.set(c.ico, c);

  const nodes: MoneyNode[] = [];
  const edges: MoneyEdge[] = [];
  const usedCompany = new Set<string>();
  const emittedCompanyNode = new Set<string>();
  const danglingContracts: string[] = [];
  let supplies = 0;

  const ensureCompanyNode = (ico: string) => {
    if (emittedCompanyNode.has(ico)) return;
    const c = companyByIco.get(ico);
    if (!c) return;
    emittedCompanyNode.add(ico);
    nodes.push({ id: companyUrn(ico), kind: "company", label: c.name, props: { ico } });
  };

  // contracts → contract nodes + supplies edges (company → contract)
  for (const ct of contracts) {
    const company = companyByIco.get(ct.supplierIco);
    if (!company) {
      danglingContracts.push(ct.id);
      continue; // no known supplier → do not invent a company
    }
    ensureCompanyNode(ct.supplierIco);
    usedCompany.add(ct.supplierIco);
    nodes.push({
      id: contractUrn(ct.id),
      kind: "contract",
      label: ct.subject?.trim() || ct.id,
      props: { amount: ct.amount, signedOn: ct.signedOn, supplierIco: ct.supplierIco },
    });
    edges.push({
      src: companyUrn(ct.supplierIco),
      rel: "supplies",
      dst: contractUrn(ct.id),
      weight: ct.amount,
      props: {},
    });
    supplies++;
  }

  // links → linked_to edges (person → company), review-gated; ensure the company node exists
  let verified = 0;
  let pending = 0;
  for (const link of links) {
    if (!companyByIco.has(link.ico)) continue; // link to an unknown company → skip (never fabricate a node)
    ensureCompanyNode(link.ico);
    usedCompany.add(link.ico);
    edges.push({
      src: `psp:person:${link.personPspId}`,
      rel: "linked_to",
      dst: companyUrn(link.ico),
      weight: null,
      props: { role: link.role, source: link.source, review_state: link.state },
    });
    if (link.state === "verified") verified++;
    else pending++;
  }

  return {
    nodes,
    edges,
    stats: {
      companies: emittedCompanyNode.size,
      contracts: nodes.filter((n) => n.kind === "contract").length,
      linked_to: verified + pending,
      supplies,
      verified,
      pending_review: pending,
      contractsWithoutKnownSupplier: danglingContracts.length,
    },
    danglingContracts,
  };
}

/**
 * The traversable trail the product wants: MP → companies → contracts, with the
 * total contract value and whether every hop is human-verified. A trail with any
 * `pending_review` linkage is itself pending — the app must not present it as fact.
 */
export interface MoneyTrail {
  personPspId: number;
  companies: string[]; // company urns
  contractCount: number;
  totalAmount: number;
  fullyVerified: boolean;
}
export function moneyTrails(g: MoneyGraph, links: readonly PersonCompanyLink[]): MoneyTrail[] {
  const contractsByCompany = new Map<string, { count: number; amount: number }>();
  for (const e of g.edges) {
    if (e.rel !== "supplies") continue;
    const cur = contractsByCompany.get(e.src) ?? { count: 0, amount: 0 };
    cur.count++;
    cur.amount += typeof e.weight === "number" ? e.weight : 0;
    contractsByCompany.set(e.src, cur);
  }
  const byPerson = new Map<number, { companies: Set<string>; verified: boolean }>();
  for (const l of links) {
    const urn = companyUrn(l.ico);
    if (!g.nodes.some((n) => n.id === urn)) continue;
    const cur = byPerson.get(l.personPspId) ?? { companies: new Set<string>(), verified: true };
    cur.companies.add(urn);
    if (l.state !== "verified") cur.verified = false;
    byPerson.set(l.personPspId, cur);
  }
  const out: MoneyTrail[] = [];
  for (const [personPspId, { companies, verified }] of byPerson) {
    let contractCount = 0;
    let totalAmount = 0;
    for (const urn of companies) {
      const c = contractsByCompany.get(urn);
      if (c) {
        contractCount += c.count;
        totalAmount += c.amount;
      }
    }
    out.push({ personPspId, companies: [...companies], contractCount, totalAmount, fullyVerified: verified });
  }
  return out.sort((a, b) => b.totalAmount - a.totalAmount);
}
