import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { municipalRouteIcos, municipalRoutePath } from "@/features/budget/municipalRoutes";
import { publicStaticRoutes } from "@/features/shell/publicRoutes";
import { DISALLOWED_PATHS } from "./robots";

/*
 * SITEMAP — druhá polovina toho, co `app/robots.ts` začal. Robots říká, co
 * procházet NEMÁ; do teď neexistovalo nic, co by řeklo, co procházet MÁ, takže
 * celá evidenční část platformy (deník, důkazy, datové verze, atlas, ověření
 * citace) čekala, až ji robot najde náhodným proklikem.
 *
 * Co sem patří a co ne, rozhoduje `features/shell/publicRoutes.ts` — tytéž dvě
 * deklarace, kterými o veřejnosti plochy rozhoduje navigace, mínus cesty
 * zakázané v robots (`DISALLOWED_PATHS`, importované, nikdy přepsané) a mínus
 * dynamické segmenty. Sitemapa proto NENESE /poslanec/<id>, /zakony/<číslo>,
 * /penize/firma/<ičo> ani /zdroj/<ref>: vypsat je znamená vyjmenovat konkrétní
 * lidi a firmy, tedy číst úložiště v každém requestu. Je to přiznaná neúplnost —
 * rozcestníky, ze kterých na ně vede odkaz, tu jsou.
 *
 * JEDINÁ VÝJIMKA jsou obce (/rozpocty/<IČO>), a je to výjimka Z PRAVIDLA, ne
 * z chuti: oba důvody vyloučení tu odpadají. Obec není osoba ani firma — je to
 * veřejný číselník MONITORu zabudovaný do buildu, takže vypsání adres nikoho
 * nevyjmenovává; a nečte se pro ně úložiště, protože rejstřík je statický modul
 * (`features/budget/municipalRoutes.ts`), z něhož Next tytéž stránky UŽ
 * předgeneruje (`generateStaticParams`). Adresa, která se staví do statického
 * výstupu, ale v sitemapě chybí, je vada indexace. Seznam se odsud NEODVOZUJE
 * podruhé — importuje se týž, který build používá.
 *
 * ZÁKLAD ADRESY se čte z hlaviček requestu — týž precedens jako všechny čtyři
 * feedy (/denik, /dukazy, /zakony/kolize, /schranka): v dev čestně localhost, v
 * nasazení skutečný host, NIKDY vymyšlená doména. Proto `force-dynamic`: bez
 * hostitele by se stránky do sitemapy zapsat nedaly a build by musel hádat.
 *
 * `lastModified` se ZÁMĚRNĚ nevyplňuje. Datum poslední změny stránky nikde
 * neevidujeme (verze nese datová vrstva, ne routa), a čas sestavení odpovědi
 * není datum změny obsahu — bylo by to číslo, které nic netvrdí.
 *
 * Feedy tu nejsou: sitemapa nese STRÁNKY. Jejich adresář je sekce „Odběry" na
 * /data — a ta v sitemapě je.
 */

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${proto}://${host}` : "";

  // Kořen se sází s lomítkem („https://host/"), ne jako holý původ — holý
  // původ je platná, ale nezvyklá podoba a čtečky sitemap ji hlásí jako odchylku.
  const routes = [
    ...publicStaticRoutes(DISALLOWED_PATHS),
    ...municipalRouteIcos().map(municipalRoutePath),
  ];
  return routes.map((route) => ({
    url: route === "/" ? `${baseUrl}/` : `${baseUrl}${route}`,
  }));
}
