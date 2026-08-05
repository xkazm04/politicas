import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import DataReleasesPage from "@/features/data-releases/DataReleasesPage";
import { getDataReleasesData } from "@/features/data-releases/getDataReleasesData";

/*
 * /data — Datové verze (batch 3D): vydávací stránka datové vrstvy. Tenká
 * routa: sestaví manifest + changelog + velikost snapshotu a předá je
 * presentační komponentě. Copy včetně metadat žije od 2026-08-05
 * v messages/{cs,en}.json pod `dataReleases.*` (vzor /overeni) a ohlašuje
 * strojové podoby vydání.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dataReleases");
  return { title: t("meta.title"), description: t("meta.description") };
}

// Manifest se mění každým ingest během — čte se za requestu; null → čestný
// stav „nečitelné, ne prázdné" (viz getDataReleasesData).
export const dynamic = "force-dynamic";

export default async function DataRoute() {
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const data = await getDataReleasesData();
  return <DataReleasesPage data={data} locale={locale} />;
}
