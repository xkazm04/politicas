/*
 * Serverové dvojče `useTranslations` + `useFormat` pro rubriky titulní strany.
 *
 * Proč: `DenikTeaser` se 2026-08-12 překlopil na SERVEROVOU komponentu (odečet
 * dělá `DenikSlot` uvnitř `<Suspense>`, ne prohlížeč po hydrataci), a serverová
 * komponenta hooky volat nemůže. Je to týž pár objektů, jen čtený na serveru:
 * `getTranslations()` je serverové API next-intl pro identické `t`, formátovače
 * pocházejí z `formattersFor(locale)` — doslova to, co `useFormat` memoizuje —
 * takže se číslo nemůže na obou stranách vysázet jinak.
 *
 * Kopie? Ne — precedens a doslovný vzor je `features/profile/serverIntl.ts`,
 * který dělá totéž pro spis. Dva namespace, dva moduly: sdílet by znamenalo
 * vytáhnout to do `features/shared`, kde platí zákaz importů z `features/*`
 * a `lib/civic`; tenhle modul žádný takový import nemá, ale ani žádného třetího
 * volajícího, takže by se sdílelo do zásoby.
 *
 * Záměrně NENÍ `server-only`: nedrží přístup ke storu ani tajemství, a hranice,
 * na které záleží (`custom/no-server-import-in-client`), hlídá loadery.
 */

import { getLocale, getTranslations } from "next-intl/server";
import { formattersFor, type Formatters } from "@/lib/format";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export interface LandingIntl {
  /** `landing.*` — katalog fasády. */
  t: Awaited<ReturnType<typeof getTranslations>>;
  /** Česky-první formátovače (`lib/format.ts` — jediné zobrazovací `.toFixed`). */
  f: Formatters;
}

export async function landingIntl(namespace = "landing"): Promise<LandingIntl> {
  const [t, raw] = await Promise.all([getTranslations(namespace), getLocale()]);
  return { t, f: formattersFor(isLocale(raw) ? raw : defaultLocale) };
}
