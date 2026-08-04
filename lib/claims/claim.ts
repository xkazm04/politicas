// Claim vocabulary — the ONE canonical shape for "a rendered figure testifies
// about its origin" (batch 2E, moonshot infrastructure-observability M2).
//
// Ownership: this module OWNS the claim shape. Other features (the provenance
// capsule 2A, later formatter adoptions) consume it — do not fork a parallel
// claim type; extend here, additively.
//
// Design constraints, in order:
//   1. SMALL. A claim is a citation, not a knowledge-graph row. Everything a
//      SourceNote already says (dataset + cadence), plus the machine-readable
//      extras a crawler needs (stable ref, URL, retrieval date, review status).
//   2. DETERMINISTIC. `serializeClaim` is canonical (fixed key order, no
//      undefineds) so the same claim always produces byte-identical output —
//      data-attributes and hashes must not depend on object insertion order.
//   3. GATED. schema.org ClaimReview is only emitted for claims that passed
//      the human review gate (`reviewStatus === "verified"`). The default is
//      "pending": absent-minded call sites can never accidentally publish an
//      unreviewed figure as a machine-readable verified claim.

/** Review-gate state of the underlying fact. `pending` (the default) emits
 *  data-attributes only; `verified` additionally allows ClaimReview JSON-LD.
 *
 *  `rejected` joined the union on 2026-08-04, when live money figures started
 *  minting claims: `review_state` is TERMINAL per edge and a rejected tie stays
 *  in the graph, so a figure resting on one had to be able to say so. Collapsing
 *  it into `pending` would have published a refused claim as merely unchecked.
 *  Only `verified` ever emits ClaimReview — the gate below is unchanged. */
export type ClaimReviewStatus = "verified" | "pending" | "rejected";

/** A machine-readable citation for one rendered figure. */
export interface Claim {
  /** Stable reference id — build with `makeClaimRef`, parse with `parseClaimRef`. */
  ref: string;
  /** Dataset the figure comes from, in the SourceNote vocabulary
   *  (e.g. "psp.cz — jmenovitá hlasování", "registr smluv ⋈ ares"). */
  dataset: string;
  /** What the figure measures, machine-oriented slug (e.g. "prumerna-dochazka"). */
  metric: string;
  /** Unit of the value ("%", "Kč", "poslanců", …). Omit for dimensionless. */
  unit?: string;
  /** Subject entity the figure is about (e.g. an MP id); omit for chamber-wide. */
  subject?: string;
  /** Canonical URL of the source. */
  sourceUrl?: string;
  /** ISO date (YYYY-MM-DD) the value was retrieved/derived. */
  retrievedAt?: string;
  /** URL of the methodology note explaining the derivation. */
  methodologyUrl?: string;
  /** Human review-gate state. Defaults to "pending" when omitted. */
  reviewStatus?: ClaimReviewStatus;
  /**
   * WHAT COMPUTED THE VALUE — the identity of the derivation behind the figure,
   * as the store carries it (`contribution-committee-dedupe@42`, `kg-pass:42`).
   *
   * Not decoration: on 2026-07-29 the contribution formula changed and the store
   * was corrected only on 2026-08-04, so for six days one number had two possible
   * authors and a citation could not name its own. A value claim that carries its
   * derivation lets the gate answer "the figure is the same, but a different
   * formula wrote it" instead of stamping a coincidence "verified".
   *
   * Omit when the derivation is not knowable (a half-recomputed store has no
   * single one) — an absent basis claims nothing, which is the honest state.
   */
  derivation?: string;
}

/** Canonical key order — the single source of truth for serialization.
 *  Append-only: adding a key at the END keeps old serializations stable. */
const CLAIM_KEYS = [
  "ref",
  "dataset",
  "metric",
  "unit",
  "subject",
  "sourceUrl",
  "retrievedAt",
  "methodologyUrl",
  "reviewStatus",
  "derivation",
] as const satisfies readonly (keyof Claim)[];

export const claimStatus = (claim: Claim): ClaimReviewStatus => claim.reviewStatus ?? "pending";

// ── Claim references ─────────────────────────────────────────────────────────
// Format: `claim:<dataset>:<metric>[:<subject>]`, segments URI-encoded so the
// dataset vocabulary may contain ":" / spaces / "⋈" without breaking parsing.

const REF_PREFIX = "claim";

export interface ClaimRefParts {
  dataset: string;
  metric: string;
  subject?: string;
}

export function makeClaimRef({ dataset, metric, subject }: ClaimRefParts): string {
  const segments = [REF_PREFIX, encodeURIComponent(dataset), encodeURIComponent(metric)];
  if (subject !== undefined) segments.push(encodeURIComponent(subject));
  return segments.join(":");
}

/** Inverse of `makeClaimRef`; null for anything that is not a claim ref. */
export function parseClaimRef(ref: string): ClaimRefParts | null {
  const segments = ref.split(":");
  if (segments[0] !== REF_PREFIX || segments.length < 3 || segments.length > 4) return null;
  try {
    const [, dataset, metric, subject] = segments.map((s) => decodeURIComponent(s));
    if (!dataset || !metric) return null;
    return segments.length === 4 ? { dataset, metric, subject } : { dataset, metric };
  } catch {
    // decodeURIComponent throws on malformed escapes ("%zz") — not a claim ref.
    return null;
  }
}

// ── Canonical serialization ──────────────────────────────────────────────────

/** Deterministic JSON: keys in CLAIM_KEYS order, undefineds omitted,
 *  reviewStatus materialized (the default "pending" is made explicit so the
 *  serialization never changes meaning if the default ever would). */
export function serializeClaim(claim: Claim): string {
  const ordered: Record<string, string> = {};
  for (const key of CLAIM_KEYS) {
    const value = key === "reviewStatus" ? claimStatus(claim) : claim[key];
    if (value !== undefined) ordered[key] = value;
  }
  return JSON.stringify(ordered);
}

// ── DOM data-attributes ──────────────────────────────────────────────────────
// The wire format for a figure in HTML: `<data value="78.3" data-claim-…>`.
// Attribute set is intentionally flat (one attribute per field, no JSON blob)
// so CSS selectors and crawlers can target individual fields.

export function claimDataAttributes(claim: Claim, value: number): Record<string, string> {
  const attrs: Record<string, string> = {
    "data-claim-ref": claim.ref,
    "data-claim-dataset": claim.dataset,
    "data-claim-metric": claim.metric,
    // Machine value: dot-decimal, locale-independent — the visible text is the
    // locale's business, this attribute is the crawler's.
    "data-claim-value": String(value),
    "data-claim-status": claimStatus(claim),
  };
  if (claim.unit !== undefined) attrs["data-claim-unit"] = claim.unit;
  if (claim.subject !== undefined) attrs["data-claim-subject"] = claim.subject;
  if (claim.sourceUrl !== undefined) attrs["data-claim-source-url"] = claim.sourceUrl;
  if (claim.retrievedAt !== undefined) attrs["data-claim-retrieved"] = claim.retrievedAt;
  if (claim.methodologyUrl !== undefined) attrs["data-claim-methodology"] = claim.methodologyUrl;
  if (claim.derivation !== undefined) attrs["data-claim-derivation"] = claim.derivation;
  return attrs;
}

// ── schema.org ClaimReview ───────────────────────────────────────────────────

/** Structural shape of the emitted JSON-LD — a minimal stable subset of
 *  schema.org/ClaimReview (the vocabulary for statistical claims is loose;
 *  we pin this subset and do not chase it). */
export interface ClaimReviewJsonLd {
  "@context": "https://schema.org";
  "@type": "ClaimReview";
  claimReviewed: string;
  itemReviewed: {
    "@type": "Claim";
    name: string;
    appearance?: { "@type": "CreativeWork"; url: string };
  };
  reviewRating: {
    "@type": "Rating";
    ratingValue: 5;
    bestRating: 5;
    worstRating: 1;
    alternateName: "ověřeno";
  };
  author: { "@type": "Organization"; name: "Politicas" };
  datePublished?: string;
  url?: string;
}

/**
 * ClaimReview for a VERIFIED claim; null otherwise — the human review gate is
 * enforced here, not trusted to call sites. `formattedValue` is the visible
 * (locale-formatted) figure; the reviewed sentence pairs it with the metric so
 * the claim is self-describing outside the page ("prumerna-dochazka: 78,3 %").
 */
export function claimReviewJsonLd(claim: Claim, formattedValue: string): ClaimReviewJsonLd | null {
  if (claimStatus(claim) !== "verified") return null;
  const figure = claim.unit !== undefined ? `${formattedValue} ${claim.unit}` : formattedValue;
  const jsonLd: ClaimReviewJsonLd = {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    claimReviewed: `${claim.metric}: ${figure} (${claim.dataset})`,
    itemReviewed: {
      "@type": "Claim",
      name: claim.ref,
      ...(claim.methodologyUrl !== undefined && {
        appearance: { "@type": "CreativeWork" as const, url: claim.methodologyUrl },
      }),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: 5,
      bestRating: 5,
      worstRating: 1,
      alternateName: "ověřeno",
    },
    author: { "@type": "Organization", name: "Politicas" },
  };
  if (claim.retrievedAt !== undefined) jsonLd.datePublished = claim.retrievedAt;
  if (claim.sourceUrl !== undefined) jsonLd.url = claim.sourceUrl;
  return jsonLd;
}
