"use server";

// Server action that persists the chosen locale in a cookie. The language
// switcher calls this, then triggers router.refresh() so the RSC tree re-renders
// under the new locale on the SAME route.

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "./config";

export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // one year
    sameSite: "lax",
  });
}
