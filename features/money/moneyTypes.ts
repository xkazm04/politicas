// Shared shapes for the FollowTheMoney surface (/penize) — the second feature
// fed by REAL knowledge-graph data (kg_node/kg_edge) rather than the lib/civic
// mock. Plain module (no server imports) so both the server loader
// (getMoneyData.ts) and the "use client" components can import these.
//
// GROUND TRUTH the loader encodes (verified against the live graph, pass 10–12):
//   • person --linked_to--> company     the human-GATED MP↔company tie.
//     props.review_state is one of pending_review / verified / rejected, and the
//     review console can write all three (and reverse a decision). On the live
//     store today all 211 are pending_review — but that is a MEASUREMENT, not an
//     invariant, and no copy on this surface may assume it: what the gate has
//     decided is derived from the counts (`reviewSummary.ts`). Only a `verified`
//     tie may feed a score.
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
export type { TieClass, TieClassOrigin } from "./reviewTypes";
import type { ReviewOrderOrigin, TieClass, TieClassOrigin } from "./reviewTypes";
import type { ReachableMoney } from "./reachableMoney";
// The receipt's provenance shape (pass / method / ref / computedAt), reused rather than
// re-declared: /zdroj already reads exactly these four fields off a graph row, and a tie's
// analyst note must be datable by the same rule the provenance capsule uses.
import type { ReceiptProvenance } from "@/features/shared/provenance/receipt";

/** One MP↔company tie, enriched with the public money reachable through the firm. */
export interface MoneyTie {
  companyId: string; // kg_node id, e.g. "company:ico:25586521"
  /** The tie's PERMANENT citable address — the `h.<src>.<rel>.<dst>` claim ref behind
   *  `/zdroj/<ref>`. Computed once in the loader from the edge's own endpoints with the
   *  shared `edgeClaimRef` (features/shared/provenance/claimRef.ts); no surface may build
   *  a second one. Until this existed, /penize published 211 money claims and not one of
   *  them had an address a reader — or /overeni, the citation verifier — could resolve. */
  receiptRef: string;
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
  /** The registry document the corroboration pass actually read (props.corroboration_source
   *  — an ARES-VR REST URL or a dataor.justice.cz export URL). 211/211 ties carry one; it is
   *  what turns `reviewerNote` from an assertion into something a reader can re-check. */
  corroborationSource: string | null;
  /** WHEN and by WHICH pass the corroboration (and with it `reviewerNote`) was written.
   *  Read verbatim off `props.corroboration_provenance` through the SAME `toProvenance`
   *  the /zdroj receipt uses — analyst prose is only presentable as analyst prose when it
   *  is dated and attributed. Fields are null when the edge does not carry them. */
  corroborationProvenance: ReceiptProvenance;
  /** owner-operator / manager / steward — see `tieClassInfo` for the rendered P29 rule.
   *  Resolved by `resolveTieClass`: a class stored on the edge beats the heuristic. */
  tieClass: TieClass;
  /** Whether `tieClass` was READ off the edge or GUESSED — the two may not be rendered
   *  in the same voice (`tieClassOriginInfo`). */
  tieClassOrigin: TieClassOrigin;
  /** What the heuristic alone would have said; equal to `tieClass` unless a stored class
   *  overrode it. */
  tieClassHeuristic: TieClass;
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
  /** whether that tier/rank pair was read off the edge or recomputed — see
   *  `resolveReviewOrder`. The console states the recomputed count; nothing may
   *  silently mix two vintages of one sort key. */
  reviewOrderOrigin: ReviewOrderOrigin;
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

/** One MP↔company tie seen FROM THE COMPANY — the shared `MoneyTie` plus who the MP is.
 *  Extends the shared shape rather than re-declaring a subset of it: a prop the ledger's
 *  mapper learns to read reaches this surface in the same commit
 *  (memory/two-mappers-over-one-edge-starve-the-decider.md). Same rule as `ReviewTie`. */
export interface CompanyTie extends MoneyTie {
  pspId: number;
  mpName: string;
  club: string | null;
}

/** The company case file (/penize/firma/[ico]).
 *
 *  A company is the graph's JUNCTION node — the one entity a contract, a subsidy, a party
 *  donation and (for 14 of them) SEVERAL MPs all meet at. Until this existed the
 *  cross-MP view was computable and unpublished: the ledger showed one row per tie and
 *  the case file showed one MP's side of it, so nothing said "these three MPs sit on the
 *  same board".
 *
 *  IT IS NOT A RANKING and there is no index page above it. The multi-MP pattern renders
 *  as fact rows in the graph's own order; adjacency is not an accusation. */
export interface MoneyCompanyDetail {
  companyId: string;
  ico: string;
  name: string;
  /** Every MP tied to this company, strongest evidence first (reviewRank asc). */
  ties: CompanyTie[];
  /** Contract line items, amount desc — the top `contractsShownCount` of them. */
  contracts: ContractLine[];
  /** Contracts the company has beyond the ones in `contracts`. */
  contractsMoreCount: number;
  /** Of the rows in `contracts`, how many carry a `signedOn` that could not have happened
   *  (the corpus holds 0002 / 1970 / 2027 / 3062). The row and its amount stay, the DATE
   *  is dropped, and the count is disclosed — never repaired
   *  (lib/analysis/plausible-date.ts, the /poslanec precedent). */
  implausibleDateCount: number;
  /** The day the plausibility bound was drawn against, printed so the reader can redo it. */
  asOf: string;
  /** THE shared definition (`reachableMoney.ts`) over this company's ties. One company,
   *  so exactly one of the two buckets is populated — which one IS the attribution rule's
   *  answer for this firm, and the page states it rather than summing both. */
  money: ReachableMoney;
  subsidiesCount: number;
  subsidiesCzk: number;
  donatedToPartyCzk: number | null;
  donationRecipientParty: string | null;
  source: string;
  pass: number;
}

/** Full evidence chain for one MP — the /penize/[pspId] case-file surface. */
export interface MoneyMpDetail {
  pspId: number;
  name: string;
  club: string | null;
  absenteeManagerLead: boolean;
  ties: MoneyTieDetail[];
  /** THE shared definition (`reachableMoney.ts`), scoped to this MP. Replaces the three
   *  class-MIXING totals this file used to carry (`totalContractCzk`,
   *  `totalSubsidiesCzk`, `totalDonatedCzk`), which summed a hospital's own contracting
   *  into the same headline as a firm the MP owns, above the fold, with no source note
   *  and no cap caveat — on the surface most likely to be screenshotted. */
  money: ReachableMoney;
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
  /** ties whose review passed — 0 until a human confirms one in /penize/kontrola, which
   *  it can since the console learned to write `verified`; nothing here assumes zero. */
  verifiedCount: number;
  pendingCount: number;
  /** Σ reach of the companies this MP OWNS OR RUNS, from the shared definition
   *  (`reachableMoney` → `bucketReachCzk`), per company de-duplicated. THE ranking key
   *  for the featured case file. Replaces `totalContractCzk`/`totalSubsidiesCzk`, which
   *  summed a hospital's own contracting into the same number and then sorted by it. */
  attributableReachCzk: number;
  /** The other side of the split — the institutions' own activity. Rendered separately
   *  and never in the alarm colour; never a ranking key. */
  stewardReachCzk: number;
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
  /** The value the selection rule ranked on — this MP's attributable reach. Rendered in
   *  the caption so the picture states WHY it is this MP and not another. */
  selectedByCzk: number;
  companies: Array<{
    id: string;
    company: string;
    role: string;
    reviewState: ReviewState;
    tieClass: TieClass;
    /** `tieReach()` — computed in the loader from the shared definition, never re-added
     *  in the renderer. */
    reachCzk: number;
    attributable: boolean;
    donatedToPartyCzk: number | null;
    donationRecipientParty: string | null;
  }>;
}

export interface MoneyStats {
  mpsWithTies: number;
  companiesLinked: number; // distinct companies across all ties
  /** Reachable public money, from THE shared definition (`reachableMoney.ts`): one row
   *  per company, split into what the attribution rule permits reading as the
   *  politician's (owner-operator + manager) and what is a public body's own activity
   *  (steward). There is no undifferentiated "reachable" total here on purpose — after
   *  the batch-012 re-ingest stewards are ~91 % of it. */
  money: ReachableMoney;
  /** `money.attributable.contractCzk` — a named view, read by /dashboard's headline. */
  contractCzkAttributable: number;
  /** `money.steward.contractCzk` — same. NEVER read as MP enrichment. */
  contractCzkSteward: number;
  /** Every `linked_to` edge the layer READ — including ones dropped for an unresolved
   *  endpoint. It is therefore NOT the population of the three counts below, and the
   *  review banner must not mix them (see `reviewSummary.ts`). */
  totalTies: number;
  verifiedTies: number;
  pendingTies: number;
  /** "rejected" is TERMINAL (D7) — decided, not pending. Counted so the banner can say
   *  what the gate ruled instead of asserting that nothing has been ruled on. */
  rejectedTies: number;
  /** MPs with at least one owner-operator tie (owns/runs a firm that supplies
   *  the state) — the actual FollowTheMoney finding, as opposed to
   *  `contractCzkReachable`, which is dominated by stewards' own institutions
   *  and must never be read as personal enrichment (see `tieClassInfo`). */
  ownerOperatorMps: number;
  /** Of `ownerOperatorMps`, how many rest on a class RECORDED on the edge rather than on
   *  `classifyTie`'s substring guess. The difference is not cosmetic: a derived class has
   *  no registry fact behind it, so the tile may not cite ARES for the whole count. */
  ownerOperatorMpsStoredClass: number;
  /** `money.coverage` — a named view, read by /dashboard. */
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

/** How a tie's class was arrived at, in the reader's own words. The P29 caption in
 *  `tieClassInfo` is written as an established fact ("poslanec vlastní nebo řídí…") — it
 *  may only be read that way when a person recorded the class. When `classifyTie` guessed
 *  it from a company name and a role string, the surface says so at the badge. Single
 *  source of truth for the copy, same rule as `tieClassInfo`: import, never re-word. */
export function tieClassOriginInfo(origin: TieClassOrigin): {
  labelCs: string;
  labelEn: string;
  noteCs: string;
  noteEn: string;
} {
  if (origin === "stored") {
    return {
      labelCs: "zapsaná třída",
      labelEn: "recorded class",
      noteCs:
        "třídu nese hrana v grafu (kg_edge.props.tie_class) — zapsal ji analytický průchod nebo lidská kontrola, není to automatický odhad.",
      noteEn:
        "the class is stored on the edge (kg_edge.props.tie_class) — written by an analysis pass or a human review, not guessed at read time.",
    };
  }
  return {
    labelCs: "odvozená třída",
    labelEn: "derived class",
    noteCs:
      "třídu odhadl program z názvu firmy a textu role (classifyTie) — v grafu k ní není zapsaný žádný rejstříkový údaj. Berte ji jako vodítko, ne jako zjištěný fakt.",
    noteEn:
      "the class was guessed from the company name and the role text (classifyTie) — no registry fact backs it. Read it as a lead, not a finding.",
  };
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
