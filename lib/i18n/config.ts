// i18n foundation — dual-locale Czech (default) + English.
// Routing model: next-intl WITHOUT locale-in-URL. The active locale lives in a
// cookie (see locale.ts) and is resolved per request in request.ts. This keeps
// the existing flat, Czech-named routes (/dashboard, /hlasovani, …) untouched —
// the switcher preserves the current route by construction (no navigation, just
// a cookie flip + refresh).

export const locales = ["cs", "en"] as const;
export type Locale = (typeof locales)[number];

/** Czech first — primary market and data are Czech (see CLAUDE.md / DESIGN.md). */
export const defaultLocale: Locale = "cs";

/** Endonym shown in the language switcher. */
export const localeNames: Record<Locale, string> = {
  cs: "Čeština",
  en: "English",
};

/** Short code shown in the compact toggle. */
export const localeShort: Record<Locale, string> = {
  cs: "CS",
  en: "EN",
};

/** Cookie that carries the chosen locale across requests. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);
