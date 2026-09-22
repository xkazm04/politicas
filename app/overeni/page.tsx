import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getVerdictData } from "@/features/overeni/getVerdictData";
import { getGuideExample } from "@/features/overeni/getGuideExample";
import { buildExamples } from "@/features/overeni/guide";
import OvereniPage from "@/features/overeni/OvereniPage";
import { firstParam } from "@/lib/routing/searchParam";

/*
 * /overeni — Civic Claim Gate (moonshot 6C): veřejná ověřovací plocha.
 * Tenká routa: `?ref=` z URL (formulář je čistý GET — ověření je sdílitelná
 * adresa), serverové znovuodvození, presentační komponenta. Copy včetně
 * metadat žije od 2026-08-04 v messages/{cs,en}.json pod `overeni.*`.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("overeni");
  return { title: t("meta.title"), description: t("meta.description") };
}

export default async function OvereniRoute({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; k?: string | string[] }>;
}) {
  const params = await searchParams;
  const input = firstParam(params.ref) ?? "";
  // `&k=YYYY-MM-DD` — „a co jste tvrdili TOHO DNE?". Plumbing, nic víc: co je
  // platný den a co se stane s tím, co jím není, rozhoduje asOfLens.ts.
  const asOfDay = firstParam(params.k) ?? "";

  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const [data, live] = await Promise.all([
    getVerdictData(input === "" ? null : input, asOfDay === "" ? null : asOfDay),
    // Živá adresa pro příklad v návodu; null → guide.ts sází ilustrační tvar
    // OZNAČENÝ jako ilustrační (nikdy nabídku ke zkopírování slepé adresy).
    getGuideExample(),
  ]);
  return (
    <OvereniPage data={data} input={input} locale={locale} examples={buildExamples(live)} />
  );
}
