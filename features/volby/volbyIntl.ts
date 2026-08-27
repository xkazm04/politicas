/*
 * Server-side twin of `useTranslations("volby")` + `useFormat()` — the pattern
 * `features/profile/serverIntl.ts` set for the spis. The /volby surface is RSC
 * except the two pickers, so every section reads its `t` and its locale-bound
 * formatters here; a number cannot render differently on the two sides because
 * `formattersFor` is literally what `useFormat` memoises.
 *
 * Deliberately NOT `server-only`: no store access, no secret — and the tests
 * that render these sections must be able to import it.
 */

import { getLocale, getTranslations } from "next-intl/server";
import { formattersFor, type Formatters } from "@/lib/format";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export interface VolbyIntl {
  /** `volby.*` — the surface's catalog. */
  t: Awaited<ReturnType<typeof getTranslations>>;
  /** Czech-first formatters (`lib/format.ts` — the only display `.toFixed`). */
  f: Formatters;
}

export async function volbyIntl(namespace = "volby"): Promise<VolbyIntl> {
  const [t, raw] = await Promise.all([getTranslations(namespace), getLocale()]);
  return { t, f: formattersFor(isLocale(raw) ? raw : defaultLocale) };
}
