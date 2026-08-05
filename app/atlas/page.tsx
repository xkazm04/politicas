import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import AtlasPage from "@/features/atlas/AtlasPage";
import { getAtlasReport } from "@/features/atlas/getAtlasData";

/*
 * /atlas — Atlas kvality otevřených dat (batch 6D). Tenká routa: sestaví
 * report (features/atlas/getAtlasData) a předá presentační komponentě.
 * Copy včetně metadat žije od 2026-08-05 v messages/{cs,en}.json pod
 * `atlas.*` (vzor /overeni).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("atlas");
  return { title: t("meta.title"), description: t("meta.description") };
}

// Skóre se mění každým ingest během — čte se za requestu; null → čestný stav
// „nečitelné, ne prázdné“ (viz getAtlasReport).
export const dynamic = "force-dynamic";

export default async function AtlasRoute() {
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const report = await getAtlasReport();
  return <AtlasPage report={report} locale={locale} />;
}
