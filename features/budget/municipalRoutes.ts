/*
 * Trvalé adresy obcí — /rozpocty/<IČO>.
 *
 * JEDEN seznam pro dvě rozhodnutí, která se dosud dělala každé zvlášť:
 *   1. co se PŘEDGENERUJE (`generateStaticParams` v app/rozpocty/[ico]/page.tsx),
 *   2. co se ROBOTOVI NABÍDNE (app/sitemap.ts).
 * Druhý ručně psaný výčet by se rozešel při první další dávce dat — a rozešel
 * by se tiše: sitemapa by mlčky vynechala stránky, které se staví, nebo naopak
 * nabídla adresu, kterou rejstřík nezná.
 *
 * PROČ TU OBCE JSOU, ač sitemapa jinak dynamické segmenty ZÁMĚRNĚ nenese
 * (features/shell/publicRoutes.ts, vyloučení č. 2): u /poslanec/<id>,
 * /penize/firma/<ičo> a /zdroj/<ref> znamená vypsat adresy vyjmenovat konkrétní
 * lidi a firmy — a znamená to číst za běhu úložiště. Obec není ani jedno:
 * rejstřík obcí je veřejný číselník MONITORu zabudovaný do buildu (žádné čtení
 * grafu, žádný osobní údaj) a Next z něj tytéž stránky UŽ předgeneruje. Adresa,
 * která se staví do statického výstupu, ale v sitemapě chybí, je vada indexace,
 * ne opatrnost.
 *
 * Seznam je filtrovaný rejstříkem: IČO, které `getMunicipality` nezná, by dalo
 * stránku volající `notFound()` — sitemapa nesmí zvát na 404 (dnes 0 takových).
 * Řazení je vzestupné podle IČO, tedy deterministické napříč běhy.
 */

import { getBudgetSeries, getMunicipality } from "./mirrorData";
import { getSupplierTable } from "./supplierTrail";

/** Obce s vlastní předgenerovanou plochou: rozpočtová řada MONITORu (132) ∪
 *  obce se smlouvami v peněžním grafu (353). Zbytek rejstříku se renderuje na
 *  vyžádání — do sitemapy nepatří, protože žádnou stránku nemá vystavěnou. */
export function municipalRouteIcos(): string[] {
  const icos = new Set([...getBudgetSeries().keys(), ...getSupplierTable().keys()]);
  return [...icos].filter((ico) => getMunicipality(ico) !== null).sort();
}

/** Trvalá adresa zrcadla jedné obce. Jedno místo, kde je tvar cesty napsaný. */
export const municipalRoutePath = (ico: string): string => `/rozpocty/${ico}`;
