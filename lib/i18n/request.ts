// next-intl request configuration (App Router, no i18n routing).
// Resolves the active locale from the NEXT_LOCALE cookie and loads the single
// per-locale message catalog. Referenced by the next-intl plugin in
// next.config.ts.

import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieValue) ? cookieValue : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
