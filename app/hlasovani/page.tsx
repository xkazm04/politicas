import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VoteTrackPage from "@/features/votetrack/VoteTrackPage";
import { getVoteThemes } from "@/features/votetrack/getVoteThemes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("votetrackTitle"),
    description: t("votetrackDescription"),
  };
}

export default async function HlasovaniPage() {
  // First real-store read in a feature surface: the materialized vote_tag layer.
  // Null when no store / no tags yet → the theme section is simply hidden.
  const themeData = await getVoteThemes();
  return <VoteTrackPage themeData={themeData} />;
}
