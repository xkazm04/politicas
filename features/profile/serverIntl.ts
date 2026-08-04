/*
 * Server-side twin of `useTranslations` + `useFormat` for the spis.
 *
 * The whole /poslanec surface was `"use client"` — every contract line, bill
 * title and career segment crossed the RSC flight as props — while exactly ONE
 * of its components (ExpandableText) actually needs state. The rest were client
 * components only because they call `useTranslations()` / `useFormat()`.
 *
 * This is the same two objects, read on the server: `getTranslations()` is
 * next-intl's server API for the identical `t` (including `t.rich`), and the
 * formatters come from `formattersFor(locale)` — literally what `useFormat`
 * memoizes, so a number cannot render differently on the two sides.
 *
 * Deliberately NOT `server-only`: it holds no store access and no secret, and
 * the lint boundary that matters (`custom/no-server-import-in-client`) already
 * guards the loaders. Marking it would make it un-importable from the tests
 * that render these components.
 */

import { getLocale, getTranslations } from "next-intl/server";
import { formattersFor, type Formatters } from "@/lib/format";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export interface ProfileIntl {
  /** `profile.*` — the spis catalog. */
  t: Awaited<ReturnType<typeof getTranslations>>;
  /** Czech-first formatters (`lib/format.ts` — the only display `.toFixed`). */
  f: Formatters;
}

/** `profile.*` translations + locale-bound formatters, for a server component. */
export async function profileIntl(namespace = "profile"): Promise<ProfileIntl> {
  const [t, raw] = await Promise.all([getTranslations(namespace), getLocale()]);
  return { t, f: formattersFor(isLocale(raw) ? raw : defaultLocale) };
}
