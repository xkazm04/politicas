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
export const TIE_CLASSES = ["owner-operator", "manager", "steward"] as const;
export type TieClass = (typeof TIE_CLASSES)[number];

/** WHERE the rendered tie class came from. The product may not present these two in the
 *  same voice: `stored` is a value an ANALYSIS PASS wrote onto the `linked_to` edge
 *  (`kg_edge.props.tie_class`); `derived` is this module's `classifyTie` guess from two
 *  free-text strings, computed at read time.
 *
 *  `stored` DOES NOT MEAN "a human ruled on it", and the copy may not say so:
 *  `ReviewRepository.setTieReviewState` — the only write path the human gate at
 *  /penize/kontrola has — writes `review_state`, `review_note`, `last_decision`,
 *  `last_reviewer` and `last_reviewed_at`, and **never `tie_class`**. Nor does it mean
 *  "not a guess": the pass that wrote most of the corpus's classes
 *  (`scripts/case-loops/money/reconcile-ares-vr.ts`, 245 of them) computed them with
 *  `classifyTie` itself. See `tieClassOriginInfo` in moneyTypes.ts for what the reader
 *  is told. */
export type TieClassOrigin = "stored" | "derived";

export type ReviewDecision = "confirm" | "reject" | "needs-more";

import { asciiFold } from "@/lib/ingest/normalize";
import type { ReachableMoney } from "./reachableMoney";
// Type-only, and deliberately circular with moneyTypes.ts (which imports TieClass from
// here): both modules are erased at runtime, and ONE tie projection is worth more than a
// tidy import graph — see the ReviewTie doc comment.
import type { MoneyTie } from "./moneyTypes";
import type { ReceiptGate } from "@/features/shared/provenance/receipt";

export interface RegistryLinks {
  aresSubject: string; // ARES economic-subject (identity, legal form, active/dissolved)
  aresVr: string; // ARES public register (statutory bodies / owners) — the corroboration hinge
  justiceVr: string; // or.justice.cz obchodní rejstřík
  hlidacSubjekt: string; // Hlídač státu company page (contracts, subsidies, donations)
  hlidacPerson: string | null; // Hlídač person page (parsed from the tie source slug)
  registrSmluv: string; // Registr smluv contracts where this IČO is a party (via Hlídač)
}

/**
 * One pending tie, everything a reviewer needs on one card.
 *
 * IT IS A `MoneyTie` PLUS THE CONSOLE'S OWN FIELDS — deliberately, since 2026-08-04.
 * This interface used to re-declare a narrower copy of the same projection, and
 * `getVerificationData.ts` filled it from a second hand-written mapping of the SAME
 * `linked_to` edge that `moneyLoader.mapLinkedToTie` already reads in full. The two
 * drifted exactly the way two copies of one mapping drift: the person DECIDING saw
 * strictly less evidence than a member of the public reading `/penize/[pspId]` — no
 * flags, no analyst note, no owner stake, no prior-term note, no earlier decision.
 * Extending the shared shape makes that class of divergence impossible: a prop the
 * ledger's mapper learns to read reaches the console in the same commit.
 */
export interface ReviewTie extends MoneyTie {
  id: string; // "tie:<pspId>:<ico>"
  /** kg_edge.src / kg_edge.dst for this linked_to tie — the key the write path needs.
   *  `dst` is the same value as MoneyTie.companyId; both are kept because the write
   *  path speaks in edge endpoints and the money code speaks in company ids. */
  src: string;
  dst: string;
  pspId: number;
  mpName: string;
  club: string | null;
  absenteeManagerLead: boolean; // Case ② crossover flag
  periodFrom: string | null; // parsed from the source string
  periodTo: string | null; // null = source says "ongoing" (OFTEN STALE — reviewer must check ARES VR)
  links: RegistryLinks;
  /** Human-gate state + the tie's DECISION HISTORY, newest first — assembled by the one
   *  assembler the provenance capsule uses (`gateFromEdge`), never a second copy. null
   *  only for a relation that does not pass through the gate, which `linked_to` always
   *  does. */
  gate: ReceiptGate | null;
}

export interface ReviewStats {
  pending: number;
  ownerOperator: number;
  manager: number;
  steward: number;
  triangles: number;
  nearThreshold: number;
  /** Reachable public money across the PENDING queue, from the one shared definition
   *  (`reachableMoney.ts`): one row per company, steward money split out. Replaces
   *  `totalReachableCzk`, which summed per TIE across all classes — double-counting the
   *  companies tied to more than one MP and merging a public body's own contracting into
   *  the same figure as a firm an MP owns. */
  reachable: ReachableMoney;
  /** Batch-005 review-order tiers (see `reviewTier`) — the population size a reviewer
   *  must clear in each pass: registry-confirmed owner-operator / manager / steward,
   *  then everything unconfirmed. Sums to `pending`. */
  tierCounts: [number, number, number, number];
  /** How the pending queue's classes were arrived at — `stored` = written on the edge by
   *  a reviewer/analysis batch, `derived` = `classifyTie`'s guess. The console cites this
   *  instead of labelling every class "heuristika" (or, worse, none of them). */
  classOrigin: { stored: number; derived: number };
  /** Pending ties whose stored review_tier/review_rank no longer matched the tie and were
   *  recomputed — see `resolveReviewOrder`. Disclosed, never silent. */
  staleReviewOrder: number;
  /** Pending ties with a stored class that contradicts the heuristic. */
  classDisagreements: number;
  /** Pending ties carrying at least one `props.flags` token (82/211 live, 2026-08-04). */
  flagged: number;
  /** Pending ties whose flags say the graph's open-ended period is stale against the
   *  registry (`stale-ongoing-in-graph`; 42/211 live) — the population the console's
   *  staleness prompt is written for. */
  staleOngoing: number;
  /** Pending ties carrying analyst prose (`props.reviewer_note`; 211/211 live). */
  withAnalystNote: number;
}

export interface ReviewQueue {
  ties: ReviewTie[]; // pending ties only, ranked by reviewRank ASC (batch-005 review order)
  /** Ties a human has ALREADY decided (verified/rejected), newest decision first, each
   *  with its own audit history. They used to disappear from the product entirely — a
   *  review gate a person cannot inspect or correct is a one-way write, not a gate. */
  decided: ReviewTie[];
  stats: ReviewStats;
  source: string;
  pass: number;
}

/* ── pure helpers (shared with scripts/case-loops/money/triage.ts) ───────────── */

const DE_MINIMIS_CZK = 50_000; // below this reachable money the tie is likely noise
const NEAR_THRESHOLDS = [2_000_000, 6_000_000];
const NEAR_BAND = 0.1;

/**
 * JEDNA definice slovníku heuristiky — od 2026-08-13 ji importují i offline
 * skripty (`scripts/case-loops/money/{reconcile-ares-vr,prak-repoint,triage}.ts`),
 * které ji do té doby nesly každý ve vlastní kopii. Kopie se rozešly, a rozešly
 * se ve prospěch jmenovaných firem: tenhle seznam nesl `vodovody a kanalizace`,
 * ty tři ne — takže `classifyTie` uvnitř aplikace čte „Vodovody a kanalizace
 * Vsetín, a.s." jako veřejný subjekt, zatímco průchod, který na hranu ZAPSAL
 * `tie_class`, ho četl jako soukromou firmu a zapsal `manager`. Pět „rozporů
 * zapsané a odhadnuté třídy" v korpusu jsou z větší části dvě vintage TÉHOŽ
 * odhadu, ne analytikova oprava (viz `tieClassOriginInfo` v moneyTypes.ts).
 *
 * ROZHODNUTÍ o třech značkách, které nesly jen ty skriptové kopie (2026-08-13):
 *  • `krajsk` — NEPŘIDÁNO, je nadbytečná: `kraj` je její předpona, takže
 *    `c.includes("kraj")` platí vždycky, když platí `c.includes("krajsk")`.
 *    Sjednocení tady nemění ani jednu odpověď.
 *  • `z. ú`, `z. s` → `z. u`, `z. s` — PŘIDÁNO. Jsou to TYTÉŽ právní formy
 *    (zapsaný ústav / zapsaný spolek), které seznam už nese bez mezery
 *    (`z.u`, `z.s`); rejstřík píše obojí. Nejde o rozšíření pravidla, ale o
 *    doplnění druhého pravopisu.
 *
 * Změna téhle tabulky MĚNÍ, co `classifyTie` odpovídá — a tím i to, u kolika
 * vazeb se odhad rozchází se zapsanou hodnotou (`ResolvedTieClass.disagrees`,
 * `ReviewStats.classDisagreements`). To je SIGNÁL, který plocha přizná; zapsaná
 * data se tím nikdy nepřepisují (o třídě rozhoduje člověk v /penize/kontrola).
 */
export const PUBLIC_MARKERS = [
  "nemocnice", "univerzita", "vysoka skola", "vodarna", "vodarenska", "kraj",
  "mestsk", "mesto", "obec", "nadace", "nadacni", "o.p.s", "z.u", "z.s",
  "z. u", "z. s",
  "prispevkova", "muzeum", "museum", "galerie", "divadlo", "knihovna", "akademie",
  "komora", "svaz", "spolek", "fakultni", "sluzba cr", "dopravni podnik",
  "technicke sluzby", "sprava", "ustav", "fond", "sportovni", "rekreacni",
  "lidskych zdroju", "centrum", "vodovody a kanalizace",
];
export const OWNER_ROLES = ["jednatel", "spolecnik", "akcionar", "majitel", "vlastnik"];
export const BOARD_MGMT_ROLES = ["predstavenstv"];

/**
 * Skládání diakritiky pro POROVNÁNÍ (heuristika `classifyTie` a hledání v knize
 * vazeb). Do 2026-08-12 tu stálo druhé schéma skládání — `normalize("NFD")` +
 * odstranění kombinujících znamének — vedle `asciiFold()`, které při ingestu
 * plní `person.name_norm`. Dvě schémata skládání nad jedním korpusem se liší
 * přesně tam, kde na tom záleží: `đ`, `ø`, `ß`, `æ` a `œ` se kanonicky
 * NEROZKLÁDAJÍ, takže je NFD-varianta nechávala projít, zatímco tabulka
 * `asciiFold` je mapuje. Zůstává tedy JEDNA funkce, ta ingestová.
 *
 * Pro české vstupy, které tahle heuristika čte (názvy firem × text role), jsou
 * obě shodné — `foldKey.test.ts` to drží na ď/ť/ň/ř/ů i na tom, že žádná vazba
 * živého korpusu nemění třídu.
 */
export function foldKey(s: string): string {
  return asciiFold(s);
}

/** The HEURISTIC. A guess over two free-text strings (company name × role text) with no
 *  registry fact behind it: `legalForm` exists on 1 of 214 company nodes, SVJ and družstvo
 *  are absent from `PUBLIC_MARKERS`, and short markers (`kraj`, `fond`, `sprava`) collide
 *  in both directions. NEVER call this directly to decide what a surface renders — call
 *  `resolveTieClass`, which prefers a class a person actually recorded. */
export function classifyTie(role: string, company: string): TieClass {
  const r = foldKey(role);
  const c = foldKey(company);
  const isPublic = PUBLIC_MARKERS.some((m) => c.includes(foldKey(m)));
  if (!isPublic && OWNER_ROLES.some((k) => r.includes(k))) return "owner-operator";
  if (!isPublic && BOARD_MGMT_ROLES.some((k) => r.includes(k))) return "manager";
  return "steward";
}

export interface ResolvedTieClass {
  /** What every surface must render. */
  tieClass: TieClass;
  origin: TieClassOrigin;
  /** What `classifyTie` says — ALWAYS computed, so a disagreement stays visible instead
   *  of being swallowed by whichever value won. */
  heuristic: TieClass;
  /** A class was stored AND it contradicts the heuristic. The surface says so; it does
   *  not quietly pick a winner. */
  disagrees: boolean;
}

/**
 * THE PRECEDENCE RULE for a tie's class, and the only entry point a surface may use.
 *
 * **A stored class wins, always.** `kg_edge.props.tie_class` was written by an analysis
 * pass that had the registry record in front of it; `classifyTie` is a substring guess
 * recomputed at read time from two free-text strings. IČO 24227901 is the MP's own
 * residential owners' association (SVJ), stored as `steward`, which the heuristic reads
 * as `owner-operator` and the product used to caption "poslanec vlastní nebo řídí
 * soukromou firmu, která dodává státu". Recomputing at read time made every such
 * correction dead data.
 *
 * THE PRECEDENCE IS RIGHT; WHAT IT DOES NOT LICENSE IS A CLAIM ABOUT PROVENANCE.
 * A disagreement does not prove the stored value was *investigated*: measured against the
 * batch payloads, 15 of the corpus's classes come from batch-001's per-tie registry
 * research and ~247 from passes that ran THIS heuristic (batch-002's 245 + batch-006's
 * PRaK re-point), so a stored value can also be an older revision of the same guess — as
 * with Vodovody a kanalizace Vsetín/Vyškov, stored `manager` by a pass whose marker table
 * did not yet carry `vodovody a kanalizace`. The graph carries NO field beside `tie_class`
 * recording which pass wrote it, so nothing here may derive that; the surface says what is
 * true of all of them (`tieClassOriginInfo`) instead of promising a review.
 *
 * The heuristic survives ONLY as the fallback for an edge that carries no stored class,
 * and it is labelled derived wherever it is used. An unrecognised stored value is treated
 * as absent — the graph is not a type system.
 */
export function resolveTieClass(stored: unknown, role: string, company: string): ResolvedTieClass {
  const heuristic = classifyTie(role, company);
  const known = typeof stored === "string" && (TIE_CLASSES as readonly string[]).includes(stored);
  if (!known) return { tieClass: heuristic, origin: "derived", heuristic, disagrees: false };
  const tieClass = stored as TieClass;
  return { tieClass, origin: "stored", heuristic, disagrees: tieClass !== heuristic };
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

/* ── batch-005: deterministic REVIEW-ORDER (distinct from signalScore above) ──────
 * signalScore ranks "how story-worthy is this tie" (money × class-weight × triangle
 * × near-threshold). reviewTier/reviewRank rank "what order should a human clear the
 * 211-tie queue in" — the batch-005 spec: registry-confirmed owner-operators first,
 * then managers, then confirmed stewards, unconfirmed/conflicting last; WITHIN each
 * tier by reachable CZK (contractCzk + subsidiesCzk) descending. Corroboration
 * ("is this MP really tied to this company, per ARES VR") gates trust BEFORE money
 * gates urgency — an unconfirmed 500M-CZK tie is not yet known to be real, so it
 * must not out-rank a confirmed 5M-CZK one. */

/** Tier 0 = registry-confirmed owner-operator, 1 = registry-confirmed manager,
 *  2 = registry-confirmed steward, 3 = everything else (registry-unconfirmed,
 *  conflicting, or corroboration not yet run). */
export function reviewTier(t: { tieClass: TieClass; corroboration: ReviewTie["corroboration"] }): 0 | 1 | 2 | 3 {
  if (t.corroboration !== "registry-confirmed") return 3;
  if (t.tieClass === "owner-operator") return 0;
  if (t.tieClass === "manager") return 1;
  return 2; // steward
}

// Headroom above any realistic reachable-CZK figure (population total is ~19.8 bn CZK,
// no single tie approaches 1 trillion) — keeps the within-tier money-desc ordering exact
// while the tier term dominates so tiers never interleave.
const REVIEW_RANK_MONEY_CAP = 1_000_000_000_000; // 1e12

/** Stable, recomputable per-tie sort key (mirrors triage.ts). Ascending sort = the
 *  batch-005 review order: tier ascending, reachable CZK descending within tier. No
 *  global list needed — pure function of the tie's own fields, same pattern as
 *  `reviewSignal`. Persisted at read time only this batch (not written to `kg_edge.props`
 *  — see `docs/data-analysis/case-money/payloads/batch-005-review-rank.json` for the
 *  precomputed payload if a future ingest wants to persist it). */
export function reviewRank(t: {
  tieClass: TieClass;
  corroboration: ReviewTie["corroboration"];
  contractCzk: number;
  subsidiesCzk: number;
}): number {
  const tier = reviewTier(t);
  const money = Math.min(Math.max(t.contractCzk + t.subsidiesCzk, 0), REVIEW_RANK_MONEY_CAP - 1);
  return tier * REVIEW_RANK_MONEY_CAP + (REVIEW_RANK_MONEY_CAP - money);
}

/** `stored` — the graph's own value, still valid against the tie's current fields.
 *  `stale-recomputed` — a stored value exists but its inputs moved under it, so the
 *  current-vintage recomputation is used and the divergence is counted, never hidden.
 *  `derived` — nothing stored; computed here. */
export type ReviewOrderOrigin = "stored" | "stale-recomputed" | "derived";

export interface ResolvedReviewOrder {
  reviewTier: 0 | 1 | 2 | 3;
  reviewRank: number;
  origin: ReviewOrderOrigin;
}

/**
 * Review ORDER (tier + rank), resolved against `kg_edge.props.review_tier` /
 * `review_rank`.
 *
 * Unlike `tie_class` these two are NOT a judgement: this module defines them as pure
 * functions of the tie's own current fields (class × corroboration × reachable CZK), and
 * the stored copies are one snapshot of that function — written at pass 24, before the
 * batch-006 dataor corroboration sweep (pass 27) and before the batch-012 contract
 * re-ingest grew `supplies` from 2 290 to 153 731 rows. Measured on the live store:
 * **153 of 208** stored ranks and **4 of 208** stored tiers no longer match the tie they
 * are attached to, and **3 of 211** ties carry neither.
 *
 * `review_rank` is a SORT KEY whose magnitude encodes money. Ordering one queue by a
 * mixture of pass-24 ranks and current-corpus ranks is not a valid order at all — the two
 * vintages are not comparable — so the whole queue must use one vintage. This function
 * therefore keeps the stored value when it still agrees with the tie in front of the
 * reader, recomputes when it does not, and reports which happened so the staleness is a
 * disclosed number rather than an assumption.
 */
export function resolveReviewOrder(t: {
  storedTier: unknown;
  storedRank: unknown;
  tieClass: TieClass;
  corroboration: ReviewTie["corroboration"];
  contractCzk: number;
  subsidiesCzk: number;
}): ResolvedReviewOrder {
  const tier = reviewTier(t);
  const rank = reviewRank(t);
  const hasStored = typeof t.storedTier === "number" && typeof t.storedRank === "number";
  if (!hasStored) return { reviewTier: tier, reviewRank: rank, origin: "derived" };
  const agrees = t.storedTier === tier && Math.abs((t.storedRank as number) - rank) < 0.5;
  return { reviewTier: tier, reviewRank: rank, origin: agrees ? "stored" : "stale-recomputed" };
}
