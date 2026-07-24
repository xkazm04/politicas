import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CivicScorePage from "@/features/civicscore/CivicScorePage";
import { getLeaderboardData } from "@/features/civicscore/getLeaderboardData";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("civicscoreTitle"),
    description: t("civicscoreDescription"),
  };
}

export default async function ZebricekPage() {
  // Real knowledge-graph read: all 207 MPs ranked by the contribution index.
  // Null when no store / empty graph → CivicScorePage renders a labelled notice.
  const data = await getLeaderboardData();
  return <CivicScorePage data={data} />;
}
