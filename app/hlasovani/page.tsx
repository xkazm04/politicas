import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VoteTrackPage from "@/features/votetrack/VoteTrackPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("votetrackTitle"),
    description: t("votetrackDescription"),
  };
}

export default function HlasovaniPage() {
  return <VoteTrackPage />;
}
