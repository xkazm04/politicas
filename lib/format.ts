// Locale-aware number & date formatting. The single place decimal separators,
// thousands groups and date order are decided — components never call .toFixed()
// or toLocaleDateString() directly (viz docs/DESIGN.md).
//
// Czech (cs): decimal comma, narrow-space thousands (ČSN 01 6910), `d. M. yyyy`.
// English (en): decimal point, comma thousands, `MMM d, yyyy`. Currency stays
// CZK, formatted per locale.

import type { Locale } from "./i18n/config";

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

/** Bundle of formatters bound to a locale — convenient in components. */
export interface Formatters {
  dec: (n: number) => string;
  int: (n: number) => string;
  date: (iso: string) => string;
  czk: (n: number) => string;
}

export const formattersFor = (locale: Locale): Formatters => ({
  dec: (n) => formatDecimal(n, locale),
  int: (n) => formatInt(n, locale),
  date: (iso) => formatDate(iso, locale),
  czk: (n) => formatCzk(n, locale),
});
