/*
 * Veřejné statické cesty aplikace — vstup pro `app/sitemap.ts`.
 *
 * Seznam se NEOPISUJE: skládá se z týchž dvou deklarací, kterými navigace už
 * rozhoduje, co je veřejná plocha (navModel.ts) — vypsané řádky railu i jejich
 * podstránky (NAV) a vědomě nevypsané deep-link plochy (UNLISTED_ROUTES). Nová
 * stránka tak vstoupí do sitemapy tímtéž rozhodnutím, kterým vstupuje do
 * navigace, a `navModel.test.ts` už dnes shodí každou routu, o které nikdo
 * nerozhodl. Druhý ručně psaný seznam by se rozešel při prvním přejmenování.
 *
 * DVĚ VYLOUČENÍ, obě z pravidla, ne z chuti:
 *
 *  1. Cesty, které `app/robots.ts` zakazuje procházet. Sitemapa je POZVÁNKA
 *     robotovi; nabízet v ní cestu, kterou robots.txt zakazuje stáhnout, jsou
 *     dva soubory tvrdící o jedné adrese opak. Zákaz se proto importuje
 *     (`DISALLOWED_PATHS`), nikdy nepřepisuje — a vylučuje se i všechno POD ním.
 *
 *  2. Dynamické segmenty (`/poslanec/[id]`, `/zdroj/[ref]`…). Vypsat je by
 *     znamenalo vyjmenovat konkrétní poslance, tisky a firmy — tedy číst za
 *     běhu úložiště. Tahle sitemapa to VĚDOMĚ nedělá a stránka /data (rozcestník
 *     odběrů) to říká nahlas: je to neúplnost, ne tvrzení, že takové adresy
 *     neexistují. Rozcestníky, ze kterých se k nim robot proklikne
 *     (/zebricek, /zakony, /penize, /data), v sitemapě jsou.
 *
 * Feedy (RSS/JSON) v sitemapě ZÁMĚRNĚ nejsou — sitemapa nese stránky. Jejich
 * adresář je sekce na /data, a ta v sitemapě je.
 */

import { NAV, UNLISTED_ROUTES } from "./navModel";

/** Cesta s dynamickým segmentem — `[id]`, `[ref]`, `[...slug]`. */
export const isDynamicRoute = (route: string): boolean => route.includes("[");

/** Cesta je zakázaná, je-li to sama zakázaná cesta, nebo cokoli pod ní. */
export const isDisallowed = (route: string, disallowed: readonly string[]): boolean =>
  disallowed.some((d) => route === d || route.startsWith(`${d}/`));

/**
 * Veřejné statické cesty, deterministicky (podle abecedy) a bez duplicit.
 * `disallowed` je vždy vstup, nikdy lokální kopie — viz hlavička.
 */
export function publicStaticRoutes(disallowed: readonly string[]): string[] {
  const declared = [
    ...NAV.flatMap((e) => [e.href, ...e.children.map((c) => c.href)]),
    ...UNLISTED_ROUTES.map((u) => u.route),
  ];
  const kept = declared.filter((r) => !isDynamicRoute(r) && !isDisallowed(r, disallowed));
  return [...new Set(kept)].sort();
}
