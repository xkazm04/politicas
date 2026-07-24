// Human labels for the sem_classify theme taxonomy (slug → Czech display name).
// Mirrors the slugs written by scripts/hybrid-bench/materialize-tags.ts. Kept as a
// plain module so the client filter can render labels without importing the
// classifier. Czech-first (per CLAUDE.md); vote titles are Czech anyway.

export const THEME_LABELS: Record<string, string> = {
  procedura: "Procedura",
  "rozpocet-finance": "Rozpočet a finance",
  personalie: "Personálie",
  "duvera-vlada": "Důvěra vládě",
  zdravotnictvi: "Zdravotnictví",
  "skolstvi-veda": "Školství a věda",
  "bezpecnost-obrana": "Bezpečnost a obrana",
  "justice-pravo": "Justice a právo",
  "socialni-bydleni": "Sociální a bydlení",
  "prostredi-zemedelstvi": "Prostředí a zemědělství",
  "doprava-stavebnictvi": "Doprava a stavebnictví",
  "zahranici-eu": "Zahraničí a EU",
  jine: "Jiné",
};

export const themeLabel = (slug: string): string => THEME_LABELS[slug] ?? slug;
