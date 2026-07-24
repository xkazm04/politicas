// Locale-aware number & date formatting. The single place decimal separators,
// thousands groups and date order are decided — components never call .toFixed()
// or toLocaleDateString() directly (viz docs/DESIGN.md).
//
// Czech (cs): decimal comma, narrow-space thousands (ČSN 01 6910), `d. M. yyyy`.
// English (en): decimal point, comma thousands, `MMM d, yyyy`. Currency stays
// CZK, formatted per locale.

import type { Locale } from "./i18n/config";

// ── Czech primitives (pinned by lib/civic/data.test.ts — keep exact) ─────────

/** 88.3 → "88,3" — skóre a další desetinná čísla s českou čárkou. */
export const czech = (n: number) => n.toFixed(1).replace(".", ",");

/** 5214 → "5 214" — tisícové skupiny úzkou mezerou (ČSN 01 6910). */
export const czechInt = (n: number) => n.toLocaleString("cs-CZ");

/**
 * "2026-07-14" → "14. 7. 2026" — deterministicky, bez Intl. Server a klient
 * mohou mít různé verze ICU; toLocaleDateString by rozjelo hydrataci.
 */
export const czechDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
};

// ── English primitives (deterministic — no Intl for dates, avoids SSR/CSR drift)

/** 88.3 → "88.3" */
const enDecimal = (n: number) => n.toFixed(1);

/** 5214 → "5,214" */
const enInt = (n: number) => n.toLocaleString("en-US");

const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** "2026-07-14" → "Jul 14, 2026" — deterministic, no Intl. */
const enDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
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
