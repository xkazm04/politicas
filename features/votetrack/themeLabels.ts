// The sem_classify theme taxonomy (slug set) → i18n keys under votetrack.themes.
// Mirrors the slugs written by scripts/hybrid-bench/materialize-tags.ts. Display
// labels live in messages/*.json (votetrack.themes.<slug>); render sites resolve
// them via useTranslations("votetrack") and fall back to the raw slug for any
// slug outside this set (never a missing-message error for unknown data).

export const THEME_SLUGS = new Set([
  "procedura",
  "rozpocet-finance",
  "personalie",
  "duvera-vlada",
  "zdravotnictvi",
  "skolstvi-veda",
  "bezpecnost-obrana",
  "justice-pravo",
  "socialni-bydleni",
  "prostredi-zemedelstvi",
  "doprava-stavebnictvi",
  "zahranici-eu",
  "jine",
]);

/** i18n key (relative to the `votetrack` namespace) for a known theme slug,
 * or null for an unknown slug — the caller renders the slug verbatim then. */
export const themeLabelKey = (slug: string): string | null =>
  THEME_SLUGS.has(slug) ? `themes.${slug}` : null;
