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

/** ARES-VR corroboration verdict (case-money batch 002, Q-money-1 population
 *  reconciliation) — annotates the tie, never auto-verifies it. */
export type Corroboration = "registry-confirmed" | "registry-unconfirmed" | "conflicting";

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
  /** ARES-VR reconciliation props (present once the tie has been through the money
   *  loop's registry corroboration pass — batch 001 covers 15/260, batch 002 covers
   *  the remaining 245; absent = "not yet reconciled", rendered as a neutral badge,
   *  NEVER as "active"). */
  corroboration?: Corroboration | null;
  roleValidTo?: string | null; // ISO date, ARES-VR confirmed; null = role has no recorded end
  temporalStatus?: string | null; // "current" | "historical" | "money-postdates-role" | "historical-no-money"
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

/** Rendered temporal-status badge — the single place that decides how a tie's ARES-VR
 *  reconciliation state reads to a viewer. NEVER renders a stale/unreconciled tie as
 *  "active": absent corroboration → neutral "not yet checked", never a green "trvá".
 *  See docs/data-analysis/case-money/handoff.md (O-money-2) for the batch-002 rationale
 *  — Hlídač-sourced periods default to open-ended "ongoing" for ~80% of ties, which is
 *  frequently stale; ARES VR (veřejný rejstřík) is the ground truth this badge surfaces. */
export interface TemporalBadge {
  labelCs: string;
  labelEn: string;
  tone: "current" | "ended" | "warn" | "unknown";
}
export function temporalBadge(tie: {
  corroboration?: string | null;
  temporalStatus?: string | null;
  roleValidTo?: string | null;
}): TemporalBadge {
  const year = (d?: string | null) => (d ? d.slice(0, 4) : "?");
  if (!tie.corroboration) {
    return { labelCs: "neověřeno vůči ARES VR", labelEn: "not checked against ARES VR", tone: "unknown" };
  }
  if (tie.corroboration === "conflicting") {
    return { labelCs: "vazba v OR nepotvrzena", labelEn: "not confirmed in the registry", tone: "warn" };
  }
  if (tie.corroboration === "registry-unconfirmed") {
    return { labelCs: "OR bez záznamu o vazbě", labelEn: "no registry record found", tone: "unknown" };
  }
  // registry-confirmed
  switch (tie.temporalStatus) {
    case "current":
      return { labelCs: "trvá", labelEn: "current", tone: "current" };
    case "money-postdates-role":
      return {
        labelCs: `peníze po roli (do ${tie.roleValidTo ?? "?"})`,
        labelEn: `money postdates role (ended ${tie.roleValidTo ?? "?"})`,
        tone: "warn",
      };
    case "historical":
    case "historical-no-money":
    case "historical-undated-money":
      return {
        labelCs: `ukončeno ${year(tie.roleValidTo)}`,
        labelEn: `ended ${year(tie.roleValidTo)}`,
        tone: "ended",
      };
    default:
      return { labelCs: "neověřeno vůči ARES VR", labelEn: "not checked against ARES VR", tone: "unknown" };
  }
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
