import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VolbyPage from "@/features/volby/VolbyPage";
import { getVolbyHomeData } from "@/features/volby/getVolbyHomeData";
import DataUnavailable from "@/features/shared/components/DataUnavailable";

/*
 * /volby — Volby: zrcadlo. Tenká routa: jeden loader, jedna plocha. Null z
 * loaderu = store nedostupný (jednospojkový PGlite) — poctivé DataUnavailable,
 * nikdy ilustrativní census: plocha nemá mock a mít ho nemá (nálezy nejde
 * vymyslet a označit „ilustrativní" — byla by to obvinění bez dokladu).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("volbyTitle"), description: t("volbyDescription") };
}

export default async function VolbyRoute() {
  const data = await getVolbyHomeData();
  if (!data) {
    const t = await getTranslations("volby");
    return <DataUnavailable what={t("unavailableWhat")} backHref="/dashboard" backLabel={t("unavailableBackHome")} />;
  }
  return <VolbyPage data={data} />;
}
