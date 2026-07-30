import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VariantRentgen from "@/features/labs/rentgen/VariantRentgen";
import { getTerminalData } from "@/features/labs/rentgen/getTerminalData";

/*
 * /rentgen — Newsroom Evidence Terminal (moonshot batch-7, 7C): archivní
 * výtvarný směr Rentgen povýšený na tiskový produkt nad ŽIVÝM znalostním
 * grafem. Noindex trvá — terminál je deep-link plocha pro redakce (odkazuje
 * se z „pro novináře" kontextů), ne indexovaná stránka pro čtenáře.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("rentgenTitle"),
    description: t("rentgenDescription"),
    robots: { index: false },
  };
}

export default async function RentgenPage() {
  // review_audit i change_event se mění každým rozhodnutím/ingestem — čte se
  // za requestu; null → terminál PŘIZNÁ ilustrativní režim (viz loader).
  const data = await getTerminalData();
  return <VariantRentgen data={data} />;
}
