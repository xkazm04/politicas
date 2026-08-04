// Locale-aware number & date formatting. The single place decimal separators,
// thousands groups and date order are decided — components never call .toFixed()
// or toLocaleDateString() directly (viz docs/DESIGN.md).
//
// Czech (cs): decimal comma, narrow-space thousands (ČSN 01 6910), `d. M. yyyy`.
// English (en): decimal point, comma thousands, `MMM d, yyyy`. Currency stays
// CZK, formatted per locale.

import type { Locale } from "./i18n/config";
import { claimDataAttributes, type Claim } from "./claims/claim";

/** Every numeric formatter below routes through this before touching the real
 * value — NaN/Infinity must never reach `toFixed`/digit-grouping, which would
 * otherwise render the literal string "NaN" or "Infinity" to end users. */
const NOT_A_NUMBER_PLACEHOLDER = "—";

/** Deterministic thousands-grouping, no `Intl`/`toLocaleString` — the same
 * SSR/CSR-hydration rationale already applied to date formatting below (server
 * and client can have different ICU versions, which can vary the grouping
 * separator byte-for-byte and break hydration). Groups an unsigned digit
 * string every 3 digits from the right. */
const groupDigits = (digits: string, sep: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

/** Rounds to a whole number and applies grouped-digit formatting; shared by
 * every "integer" entry point so the integer contract (no stray fraction
 * digits) is enforced once, not assumed at each call site. */
const groupedInt = (n: number, sep: string) => {
  const sign = n < 0 ? "-" : "";
  return sign + groupDigits(String(Math.round(Math.abs(n))), sep);
};

// ── Czech primitives (pinned by lib/civic/data.test.ts — keep exact for finite input) ──

/** 88.3 → "88,3" — skóre a další desetinná čísla s českou čárkou, tisíce groupované stejně jako čechInt. */
export const czech = (n: number) => {
  if (!Number.isFinite(n)) return NOT_A_NUMBER_PLACEHOLDER;
  const sign = n < 0 ? "-" : "";
  const [intPart, fracPart] = Math.abs(n).toFixed(1).split(".");
  return `${sign}${groupDigits(intPart, " ")},${fracPart}`;
};

/** 5214 → "5 214" — tisícové skupiny úzkou mezerou (ČSN 01 6910). */
export const czechInt = (n: number) => {
  if (!Number.isFinite(n)) return NOT_A_NUMBER_PLACEHOLDER;
  return groupedInt(n, " ");
};

/**
 * "2026-07-14" → "14. 7. 2026" — deterministicky, bez Intl. Server a klient
 * mohou mít různé verze ICU; toLocaleDateString by rozjelo hydrataci.
 */
export const czechDate = (iso: string) => {
  const parts = parseIsoDateParts(iso);
  if (!parts) return NOT_A_NUMBER_PLACEHOLDER;
  const [y, m, d] = parts;
  return `${d}. ${m}. ${y}`;
};

// ── English primitives (deterministic — no Intl, avoids SSR/CSR drift) ──────

/** 88.3 → "88.3" (thousands grouped the same way as enInt for values ≥ 1000). */
const enDecimal = (n: number) => {
  if (!Number.isFinite(n)) return NOT_A_NUMBER_PLACEHOLDER;
  const sign = n < 0 ? "-" : "";
  const [intPart, fracPart] = Math.abs(n).toFixed(1).split(".");
  return `${sign}${groupDigits(intPart, ",")}.${fracPart}`;
};

/** 5214 → "5,214" */
const enInt = (n: number) => {
  if (!Number.isFinite(n)) return NOT_A_NUMBER_PLACEHOLDER;
  return groupedInt(n, ",");
};

const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Validates and extracts [year, month, day] from a leading `YYYY-MM-DD`
 * segment — tolerates a trailing time component (e.g. a full ISO timestamp
 * passed through without truncation) but rejects anything that doesn't yield
 * three finite numeric parts, so malformed input never silently becomes
 * "NaN. NaN. NaN" / "Jul NaN, 2026". */
function parseIsoDateParts(iso: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return [y, m, d];
}

/** "2026-07-14" → "Jul 14, 2026" — deterministic, no Intl. */
const enDate = (iso: string) => {
  const parts = parseIsoDateParts(iso);
  if (!parts) return NOT_A_NUMBER_PLACEHOLDER;
  const [y, m, d] = parts;
  return `${EN_MONTHS[m - 1]} ${d}, ${y}`;
};

// ── Locale-aware entry points ────────────────────────────────────────────────

/** One-decimal number: cs "88,3" · en "88.3". */
export const formatDecimal = (n: number, locale: Locale) =>
  locale === "en" ? enDecimal(n) : czech(n);

/** Grouped integer: cs "5 214" · en "5,214". */
export const formatInt = (n: number, locale: Locale) =>
  locale === "en" ? enInt(n) : czechInt(n);

/** ISO date: cs "14. 7. 2026" · en "Jul 14, 2026". */
export const formatDate = (iso: string, locale: Locale) =>
  locale === "en" ? enDate(iso) : czechDate(iso);

/** CZK amount, currency kept but placed per locale: cs "2 300 Kč" · en "CZK 2,300". */
export const formatCzk = (n: number, locale: Locale) =>
  locale === "en" ? `CZK ${enInt(n)}` : `${czechInt(n)} Kč`;

// ── Citable formatting (batch 2E — additive, zero visual change) ─────────────
// Same visible string as the plain formatters above, plus the machine-readable
// claim payload from lib/claims. The claim shape and gate live in
// lib/claims/claim.ts; this is only the join point with locale formatting.

/**
 * Compact CZK for dense tiles, graph labels and ledger cells — "23,7 mld. Kč".
 *
 * Lived in `features/money/moneyTypes.ts` until 2026-08-04, when the money figures
 * became citable claims: a claim's visible text has to be byte-identical to the plain
 * formatter of its `kind`, and that contract is only enforceable while every kind is
 * declared here (`CitableKind` below). Moved verbatim, with the file's own non-finite
 * guard added — a "—" placeholder must never reach `toFixed`.
 */
export function formatCompactCzk(n: number, locale: string): string {
  if (!Number.isFinite(n)) return NOT_A_NUMBER_PLACEHOLDER;
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

/** Which plain formatter sets the visible text of a citable figure. `czkCompact`
 *  is the money surfaces' own density (`formatCompactCzk`) — the machine value in
 *  `data-claim-value` stays full precision, the compaction is the locale's business. */
export type CitableKind = "dec" | "int" | "czk" | "czkCompact";

export interface CitableText {
  /** Visible string — byte-identical to the plain formatter of `kind`. */
  text: string;
  /** data-claim-* attributes; null when the value is not finite (a "—"
   *  placeholder must never testify as a machine-readable figure). */
  attrs: Record<string, string> | null;
}

/** The plain formatter of a `CitableKind` — the ONE mapping from kind to visible
 *  text. Exported because a surface that compares a CITED value with today's has to
 *  set both in the same density (the gate's verdict body), and re-deriving that
 *  mapping there is how two numbers stacked on each other start disagreeing about
 *  what they are. */
export const formatByKind = (n: number, locale: Locale, kind: CitableKind = "dec"): string =>
  kind === "int"
    ? formatInt(n, locale)
    : kind === "czk"
      ? formatCzk(n, locale)
      : kind === "czkCompact"
        ? formatCompactCzk(n, locale)
        : formatDecimal(n, locale);

/** Formats `n` exactly like the plain formatter of `kind`, and attaches the
 *  claim's data-attributes. Pure strings — the element wrapper lives in
 *  lib/claims/CitableNumber.tsx. */
export const formatCitable = (
  n: number,
  claim: Claim,
  locale: Locale,
  kind: CitableKind = "dec",
): CitableText => {
  return { text: formatByKind(n, locale, kind), attrs: Number.isFinite(n) ? claimDataAttributes(claim, n) : null };
};

/** Bundle of formatters bound to a locale — convenient in components. */
export interface Formatters {
  dec: (n: number) => string;
  int: (n: number) => string;
  date: (iso: string) => string;
  czk: (n: number) => string;
  /** Citable variant — same visible text as dec/int/czk, plus claim payload. */
  cite: (n: number, claim: Claim, kind?: CitableKind) => CitableText;
}

export const formattersFor = (locale: Locale): Formatters => ({
  dec: (n) => formatDecimal(n, locale),
  int: (n) => formatInt(n, locale),
  date: (iso) => formatDate(iso, locale),
  czk: (n) => formatCzk(n, locale),
  cite: (n, claim, kind) => formatCitable(n, claim, locale, kind),
});
