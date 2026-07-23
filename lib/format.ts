// Formátování čísel pro český trh. Jediné místo, kde se řeší desetinná
// čárka — komponenty nikdy nevolají .toFixed() přímo (viz docs/DESIGN.md).

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
