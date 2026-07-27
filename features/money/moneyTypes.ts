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

// Declared once in reviewTypes.ts (D7: "rejected" is terminal, distinct from
// "pending_review") and re-exported here — same rule as TieClass below.
export type { ReviewState } from "./reviewTypes";
import type { ReviewState } from "./reviewTypes";

/** ARES-VR corroboration verdict (case-money batch 002, Q-money-1 population
 *  reconciliation) — annotates the tie, never auto-verifies it. */
export const CORROBORATIONS = ["registry-confirmed", "registry-unconfirmed", "conflicting"] as const;
export type Corroboration = (typeof CORROBORATIONS)[number];

// Re-exported from reviewTypes.ts (the /penize/kontrola console's pure classifier) so
// the main ledger and per-MP case file can render the SAME tie-class taxonomy without
// duplicating the definition. Plain module, no server imports — safe to share.
export type { TieClass } from "./reviewTypes";
import type { TieClass } from "./reviewTypes";

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
  roleValidFrom?: string | null; // ISO date, ARES-VR confirmed
  roleValidTo?: string | null; // ISO date, ARES-VR confirmed; null = role has no recorded end
  temporalStatus?: string | null; // "current" | "historical" | "money-postdates-role" | "historical-no-money"
  /** owner-operator / manager / steward — see `tieClassInfo` for the rendered P29 rule. */
  tieClass: TieClass;
  /** contracts + subsidies + party donation all present on the same firm. */
  triangle: boolean;
  /** contract amounts landing just under a 2M/6M CZK zadávací-limit threshold. */
  nearThresholdCount: number;
  /** reachable money below a materiality floor — likely noise, rendered muted. */
  deMinimis: boolean;
  /** deterministic "how story-worthy" rank key — see reviewTypes.ts::reviewSignal. */
  signalScore: number;
  /** batch-005 review-ORDER tier (0=confirmed owner-operator … 3=unconfirmed). */
  reviewTier: 0 | 1 | 2 | 3;
  /** stable per-tie sort key mirroring reviewTier (tier asc, reachable CZK desc). */
  reviewRank: number;
  /** free-text note from a human review decision (ReviewRepository.setTieReviewState). */
  reviewNote: string | null;
  /** DIFFERENT field written by the ARES-VR reconciliation pass, not review UI. */
  reviewerNote: string | null;
  lastDecision: string | null;
  lastReviewer: string | null;
  lastReviewedAt: string | null;
  /** percentage stake, when the registry reconciliation recorded one. */
  ownerStakePct: number | null;
  /** ownership-period-start note when the tie predates the current term. */
  priorTerm: string | null;
  falseEdgeSuspected: boolean;
  flags: string[];
}

/** One contract line reachable through a tied company (kg_node kind:"contract"). */
export interface ContractLine {
  id: string;
  label: string;
  amountCzk: number | null;
  signedOn: string | null;
}

/** A tie enriched with its top-N contract line items — the per-MP case-file view. */
export interface MoneyTieDetail extends MoneyTie {
  contracts: ContractLine[];
  /** contracts beyond the ones shown in `contracts` (same company). */
  contractsMoreCount: number;
}

/** Full evidence chain for one MP — the /penize/[pspId] case-file surface. */
export interface MoneyMpDetail {
  pspId: number;
  name: string;
  club: string | null;
  absenteeManagerLead: boolean;
  ties: MoneyTieDetail[];
  totalContractCzk: number;
  totalSubsidiesCzk: number;
  totalDonatedCzk: number;
  source: string;
  pass: number;
}

/** One claim in a lead dossier, cited verbatim with its primary/media source. */
export interface DossierClaim {
  claim: string;
  url: string;
  accessedAt: string;
  sourceKind: string; // "primary" | "media"
}
export interface DossierMediaContext {
  outlet: string;
  url: string;
  gist: string;
}
/** A "Kauzy / rozpracovaný podnět" dossier — batch-005 lead payload, rendered
 *  verbatim-faithful. Every claim carries its own citation; `whatSourcesSustain` /
 *  `whatSourcesDoNotSustain` are the honest two-column split the product renders —
 *  NEVER collapsed into a single verdict. Always `pending_review`; nothing here
 *  auto-verifies a tie or feeds a score. */
export interface LeadDossier {
  leadId: string;
  subject: { name: string; role: string; party: string };
  company?: { name: string; ico: string; legalForm: string } | null;
  claims: DossierClaim[];
  /** Free-form registry-findings block — shape varies per dossier, rendered as
   *  labelled key/value pairs, never re-summarized. */
  registryFindings: Record<string, unknown>;
  mediaContext: DossierMediaContext[];
  signalScore: number;
  signalWhy: string;
  whatSourcesSustain: string;
  whatSourcesDoNotSustain: string;
  proposedAnnotation: Record<string, unknown>;
  confidence: string;
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
  /** The part of `contractCzkReachable` that the case's attribution rule permits reading
   *  as money reaching the POLITICIAN's own firms — owner-operator and manager ties. */
  contractCzkAttributable: number;
  /** The rest: contracts of public bodies where an MP holds a board seat (`steward`).
   *  This is the institution's own activity and must NEVER be read as enrichment. After
   *  the batch-012 re-ingest it is ~91 % of the raw total, so it is surfaced separately
   *  rather than folded into one headline. */
  contractCzkSteward: number;
  totalTies: number;
  verifiedTies: number;
  pendingTies: number;
  /** MPs with at least one owner-operator tie (owns/runs a firm that supplies
   *  the state) — the actual FollowTheMoney finding, as opposed to
   *  `contractCzkReachable`, which is dominated by stewards' own institutions
   *  and must never be read as personal enrichment (see `tieClassInfo`). */
  ownerOperatorMps: number;
  /** Whether the underlying contract corpus is a capped per-company sample.
   *  The original money feed pulled at most N contracts per company, so every
   *  CZK figure derived from it is a FLOOR, not a total — detected in money
   *  batch 011 (35 companies sitting at exactly 25 contracts is not chance).
   *  Rendering a capped sum as "Σ hodnot smluv" would present a lower bound as
   *  a total, which the brand rule forbids; the surface must say "nejméně". */
  contractCoverage: ContractCoverage;
}

export interface ContractCoverage {
  /** The per-company ceiling the ingest hit, or null when no ceiling is evident. */
  perCompanyCap: number | null;
  /** How many companies sit exactly at that ceiling (the cap's signature). */
  companiesAtCap: number;
  /** True when the CZK totals must be read and rendered as lower bounds. */
  isFloor: boolean;
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

/** The honest tie-class explainer — the P29 rule. A steward's big reachable-CZK
 *  number is the body's OWN public activity flowing through it (a hospital, a
 *  university, a state fund), not personal enrichment; rendering it next to an
 *  owner-operator number without this label is how a supervisory seat gets
 *  misread as graft. Single source of truth for the copy — import, never
 *  re-word inline. */
export function tieClassInfo(cls: TieClass): {
  labelCs: string;
  labelEn: string;
  descCs: string;
  descEn: string;
  tone: "signal" | "cobalt" | "steel";
} {
  switch (cls) {
    case "owner-operator":
      return {
        labelCs: "vlastník / jednatel",
        labelEn: "owner-operator",
        descCs:
          "poslanec vlastní nebo řídí soukromou firmu, která dodává státu — reálná FollowTheMoney vazba.",
        descEn: "the MP owns or runs a private firm that supplies the state — the real FollowTheMoney tie.",
        tone: "signal",
      };
    case "manager":
      return {
        labelCs: "představenstvo",
        labelEn: "manager",
        descCs: "poslanec sedí ve statutárním orgánu (představenstvu) firmy.",
        descEn: "the MP holds a seat on the company's statutory board.",
        tone: "cobalt",
      };
    case "steward":
    default:
      return {
        labelCs: "dozorčí / správní",
        labelEn: "steward",
        descCs:
          "dozorčí nebo správní funkce ve veřejné/neziskové instituci — peníze jsou vlastní veřejnou činností té instituce, ne obohacením poslance. Velké číslo u stewarda proto NIKDY nečtěte jako u vlastníka.",
        descEn:
          "a supervisory/board seat in a public or nonprofit body — the money is that body's OWN public activity, not MP enrichment. A steward's big number must never be read like an owner-operator's.",
        tone: "steel",
      };
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
