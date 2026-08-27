import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SnemovnaPage from "@/features/volby/SnemovnaPage";
import { getVolbyHomeData } from "@/features/volby/getVolbyHomeData";
import DataUnavailable from "@/features/shared/components/DataUnavailable";

/* /volby/snemovna — index kandidátek; táž data jako domovská plocha (VolbyHomeData.lists). */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("volbySnemovnaTitle"), description: t("volbySnemovnaDescription") };
}

export default async function SnemovnaRoute() {
  const data = await getVolbyHomeData();
  if (!data) {
    const t = await getTranslations("volby");
    return <DataUnavailable what={t("unavailableWhat")} backHref="/volby" backLabel={t("unavailableBack")} />;
  }
  return <SnemovnaPage data={data} />;
}
