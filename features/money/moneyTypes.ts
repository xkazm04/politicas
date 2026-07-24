// Shared shapes for the FollowTheMoney surface (/penize) — the second feature
// fed by REAL knowledge-graph data (kg_node/kg_edge) rather than the lib/civic
// mock. Plain module (no server imports) so both the server loader
// (getMoneyData.ts) and the "use client" components can import these.
//
// GROUND TRUTH the loader encodes (verified against the live graph, pass 10–12):
//   • person --linked_to--> company     the human-GATED MP↔company tie.
//     Every such edge currently carries props.review_state = "pending_review":
//     nothing here is human-approved yet, so nothing feeds any score. We render
//     the whole ledger as unverified, exactly as the mock's verified:false ties.
//   • company --supplies--> contract     (weight = contract amount in CZK)
//   • company node props: {ico, subsidies_count, subsidies_total_czk,
//     donated_to_party_czk?, donation_count?, donation_recipient_party?}

export type ReviewState = "verified" | "pending_review";

/** One MP↔company tie, enriched with the public money reachable through the firm. */
export interface MoneyTie {
  companyId: string; // kg_node id, e.g. "company:ico:25586521"
  ico: string;
  company: string; // company node label
  role: string; // props.role — how the MP figures in the firm
  reviewState: ReviewState;
  /** Human-readable provenance string (props.source) — cited verbatim. */
  source: string;
  contractCount: number;
  contractCzk: number; // Σ supplies.weight for this company
  subsidiesCount: number;
  subsidiesCzk: number;
  donatedToPartyCzk: number | null;
  donationRecipientParty: string | null;
}

/** An MP with at least one tie, grouped for the ledger. */
export interface MoneyMp {
  pspId: number; // integer psp person id → /poslanec/<pspId>
  name: string;
  club: string | null;
  /** Read-only flag from the effort case; a "money + low work" hint (never computed here). */
  absenteeManagerLead: boolean;
  ties: MoneyTie[];
  verifiedCount: number; // ties whose review passed (currently always 0)
  pendingCount: number;
  totalContractCzk: number;
  totalSubsidiesCzk: number;
}

/** A short reference to an MP with no ties (absence of a finding is also a finding). */
export interface MoneyMpStub {
  pspId: number;
  name: string;
  club: string | null;
}

/** The featured single-MP subgraph rendered as the entity graph. */
export interface MoneyGraphData {
  mp: MoneyMpStub;
  companies: Array<{
    id: string;
    company: string;
    role: string;
    reviewState: ReviewState;
    contractCzk: number;
    subsidiesCzk: number;
    donatedToPartyCzk: number | null;
    donationRecipientParty: string | null;
  }>;
}

export interface MoneyStats {
  mpsWithTies: number;
  companiesLinked: number; // distinct companies across all ties
  contractCzkReachable: number; // Σ contract CZK reachable through tied firms
  totalTies: number;
  verifiedTies: number;
  pendingTies: number;
}

export interface MoneyData {
  mps: MoneyMp[]; // tied MPs, strongest evidence first
  mpsWithoutTies: MoneyMpStub[];
  graph: MoneyGraphData | null;
  stats: MoneyStats;
  /** Provenance ref cited in the SourceNote. */
  source: string;
  /** kg pass that materialized the money layer (self-awareness surface). */
  pass: number;
}

/** Compact CZK for dense tiles/graph labels: data-derived Czech (en fallback). */
export function compactCzk(n: number, locale: string): string {
  const cs = locale !== "en";
  const abs = Math.abs(n);
  const dec = (x: number) => (cs ? x.toFixed(1).replace(".", ",") : x.toFixed(1));
  if (abs >= 1e9) return cs ? `${dec(n / 1e9)} mld. Kč` : `${dec(n / 1e9)} bn CZK`;
  if (abs >= 1e6) return cs ? `${dec(n / 1e6)} mil. Kč` : `${dec(n / 1e6)} M CZK`;
  if (abs >= 1e3) {
    const k = Math.round(n / 1e3);
    return cs ? `${k.toLocaleString("cs-CZ")} tis. Kč` : `${k.toLocaleString("en-US")}k CZK`;
  }
  const r = Math.round(n);
  return cs ? `${r.toLocaleString("cs-CZ")} Kč` : `CZK ${r.toLocaleString("en-US")}`;
}
