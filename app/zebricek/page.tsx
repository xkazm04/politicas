import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CivicScorePage from "@/features/civicscore/CivicScorePage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("civicscoreTitle"),
    description: t("civicscoreDescription"),
  };
}

export default function ZebricekPage() {
  return <CivicScorePage />;
}
