// Verification-console shapes + PURE helpers for /penize/kontrola — the human-review
// surface for the 260 pending MP↔company ties (Case ① FollowTheMoney). Plain module
// (no server imports) so both the server loader (getVerificationData.ts) and the
// "use client" console import it. Everything here is DERIVED deterministically from the
// same kg_node/kg_edge money layer the ledger already reads — no new data source.
//
// TRUST IS THE PRODUCT: this console never flips review_state. It ONLY presents a
// pending tie with the evidence a human needs (money reach + role + parsed period +
// deep-links into the primary registries) so a reviewer can confirm/reject/ask-for-more
// against ARES VR / Registr smluv themselves. The write path is intentionally NOT wired
// in fleet mode (see the console's "zápis čeká na backend" state + handoff.md).

// D7 (batch 004): "rejected" is a terminal state distinct from "pending_review" — a
// reject decision must not be re-served in the pending queue forever (see
// getVerificationQueue's filter). "needs-more" legitimately stays "pending_review".
export type ReviewState = "verified" | "pending_review" | "rejected";

/** Owner-operator = MP controls/owns a private company that supplies the state (the real
 *  FollowTheMoney). Manager = board-of-directors seat. Steward = supervisory seat on a
 *  public/nonprofit body whose money is its OWN public activity, not MP enrichment. */
export type TieClass = "owner-operator" | "manager" | "steward";

export type ReviewDecision = "confirm" | "reject" | "needs-more";

export interface RegistryLinks {
  aresSubject: string; // ARES economic-subject (identity, legal form, active/dissolved)
  aresVr: string; // ARES public register (statutory bodies / owners) — the corroboration hinge
  justiceVr: string; // or.justice.cz obchodní rejstřík
  hlidacSubjekt: string; // Hlídač státu company page (contracts, subsidies, donations)
  hlidacPerson: string | null; // Hlídač person page (parsed from the tie source slug)
  registrSmluv: string; // Registr smluv contracts where this IČO is a party (via Hlídač)
}

/** One pending tie, everything a reviewer needs on one card. */
export interface ReviewTie {
  id: string; // "tie:<pspId>:<ico>"
  /** kg_edge.src / kg_edge.dst for this linked_to tie — the key the write path needs. */
  src: string;
  dst: string;
  pspId: number;
  mpName: string;
  club: string | null;
  absenteeManagerLead: boolean; // Case ② crossover flag
  ico: string;
  company: string;
  role: string;
  source: string; // verbatim provenance string (cited)
  reviewState: ReviewState;
  tieClass: TieClass;
  periodFrom: string | null; // parsed from the source string
  periodTo: string | null; // null = source says "ongoing" (OFTEN STALE — reviewer must check ARES VR)
  contractCount: number;
  contractCzk: number;
  subsidiesCount: number;
  subsidiesCzk: number;
  donatedToPartyCzk: number | null;
  donationRecipientParty: string | null;
  triangle: boolean; // contracts + subsidies + party donation all present
  nearThresholdCount: number; // contracts within 10% below a 2M/6M zadávací limit
  deMinimis: boolean; // reachable money below a materiality floor (likely noise)
  signalScore: number; // deterministic triage rank key
  links: RegistryLinks;
  /** ARES-VR reconciliation (case-money batch 001/002, Q-money-1) — absent when the
   *  tie hasn't been through the registry corroboration pass yet. `periodFrom/To` above
   *  stay the raw Hlídač-parsed period (often stale "ongoing"); these are the
   *  REGISTRY-confirmed period + verdict a reviewer should trust instead. */
  corroboration: "registry-confirmed" | "registry-unconfirmed" | "conflicting" | null;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  temporalStatus: string | null;
}

export interface ReviewStats {
  pending: number;
  ownerOperator: number;
  manager: number;
  steward: number;
  triangles: number;
  nearThreshold: number;
  totalReachableCzk: number;
}

export interface ReviewQueue {
  ties: ReviewTie[]; // pending ties only, ranked by signalScore desc
  stats: ReviewStats;
  source: string;
  pass: number;
}

/* ── pure helpers (shared with scripts/case-loops/money/triage.ts) ───────────── */

const DE_MINIMIS_CZK = 50_000; // below this reachable money the tie is likely noise
const NEAR_THRESHOLDS = [2_000_000, 6_000_000];
const NEAR_BAND = 0.1;

const PUBLIC_MARKERS = [
  "nemocnice", "univerzita", "vysoka skola", "vodarna", "vodarenska", "kraj",
  "mestsk", "mesto", "obec", "nadace", "nadacni", "o.p.s", "z.u", "z.s",
  "prispevkova", "muzeum", "museum", "galerie", "divadlo", "knihovna", "akademie",
  "komora", "svaz", "spolek", "fakultni", "sluzba cr", "dopravni podnik",
  "technicke sluzby", "sprava", "ustav", "fond", "sportovni", "rekreacni",
  "lidskych zdroju", "centrum", "vodovody a kanalizace",
];
const OWNER_ROLES = ["jednatel", "spolecnik", "akcionar", "majitel", "vlastnik"];
const BOARD_MGMT_ROLES = ["predstavenstv"];

export function foldKey(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function classifyTie(role: string, company: string): TieClass {
  const r = foldKey(role);
  const c = foldKey(company);
  const isPublic = PUBLIC_MARKERS.some((m) => c.includes(foldKey(m)));
  if (!isPublic && OWNER_ROLES.some((k) => r.includes(k))) return "owner-operator";
  if (!isPublic && BOARD_MGMT_ROLES.some((k) => r.includes(k))) return "manager";
  return "steward";
}

/** "… · 2016-01-01–ongoing" / "… · 2003-01-01–2007-01-01" → {from,to}. */
export function parsePeriod(source: string): { from: string | null; to: string | null } {
  const m = source.match(/(\d{4}-\d{2}-\d{2}|\?)[–-](\d{4}-\d{2}-\d{2}|ongoing|\?)/);
  if (!m) return { from: null, to: null };
  return {
    from: m[1] === "?" ? null : m[1],
    to: m[2] === "ongoing" || m[2] === "?" ? null : m[2],
  };
}

/** Hlídač person slug embedded in the provenance string: "hlidac:osoby/robert-teleky · …". */
export function slugFromSource(source: string): string | null {
  const m = source.match(/osoby\/([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

export function nearThresholdCount(amounts: readonly number[]): number {
  let n = 0;
  for (const a of amounts) {
    for (const limit of NEAR_THRESHOLDS) {
      if (a > 0 && a <= limit && a >= limit * (1 - NEAR_BAND)) n++;
    }
  }
  return n;
}

export function buildRegistryLinks(ico: string, source: string): RegistryLinks {
  const slug = slugFromSource(source);
  return {
    aresSubject: `https://ares.gov.cz/ekonomicke-subjekty?ico=${ico}`,
    aresVr: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/${ico}`,
    justiceVr: `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${ico}`,
    hlidacSubjekt: `https://www.hlidacstatu.cz/subjekt/${ico}`,
    hlidacPerson: slug ? `https://www.hlidacstatu.cz/osoba/${slug}` : null,
    registrSmluv: `https://www.hlidacstatu.cz/hledatsmlouvy?Q=${encodeURIComponent(`ico:${ico}`)}`,
  };
}

export function isDeMinimis(contractCzk: number, subsidiesCzk: number): boolean {
  return contractCzk + subsidiesCzk < DE_MINIMIS_CZK;
}

/** Deterministic rank key (mirrors triage.ts). Kept here so the console and the
 *  offline triage agree exactly. */
export function reviewSignal(t: {
  contractCzk: number;
  subsidiesCzk: number;
  tieClass: TieClass;
  triangle: boolean;
  nearThresholdCount: number;
  donatedToPartyCzk: number | null;
  absenteeManagerLead: boolean;
}): number {
  const log10 = (v: number) => (v > 0 ? Math.log10(v) : 0);
  const money = log10(t.contractCzk + t.subsidiesCzk);
  const classW = t.tieClass === "owner-operator" ? 1.0 : t.tieClass === "manager" ? 0.7 : 0.35;
  const s =
    classW *
      (money * 4 +
        (t.triangle ? 12 : 0) +
        Math.min(t.nearThresholdCount, 5) * 2 +
        (t.donatedToPartyCzk ? 4 : 0)) +
    (t.tieClass === "owner-operator" ? 10 : 0) +
    (t.absenteeManagerLead ? 6 : 0);
  return Math.round(s * 100) / 100;
}
