import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VariantRentgen from "@/features/labs/rentgen/VariantRentgen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("rentgenTitle"),
    description: t("rentgenDescription"),
    robots: { index: false },
  };
}

export default function RentgenPage() {
  return <VariantRentgen />;
}
