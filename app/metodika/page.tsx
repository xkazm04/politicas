import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import MetodikaPage from "@/features/civicscore/MetodikaPage";
import { getLeaderboardListData } from "@/features/civicscore/getLeaderboardData";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("metodikaTitle"),
    description: t("metodikaDescription"),
  };
}

export default async function MetodikaRoute() {
  // The formula itself needs no store — it is imported. The one thing only the DATA can
  // answer is which pass and which formula ref actually authored the published scores,
  // and that comes off the SAME react.cache()-wrapped read /zebricek already performs.
  // Null (no store / empty graph) degrades to a labelled sentence; the formula still
  // renders, because it is code, not data.
  const data = await getLeaderboardListData();
  return <MetodikaPage provenance={data?.provenance ?? null} />;
}
