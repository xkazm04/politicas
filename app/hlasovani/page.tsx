import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VoteTrackPage from "@/features/votetrack/VoteTrackPage";
import { getVoteRecord } from "@/features/votetrack/getVoteRecord";
import { getVoteThemes } from "@/features/votetrack/getVoteThemes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("votetrackTitle"),
    description: t("votetrackDescription"),
  };
}

export default async function HlasovaniPage() {
  // The REAL vote record (Seismograf): full PSP10 ledger derived server-side;
  // null → the page falls back to the labelled mock + LiveDataNotice.
  const record = await getVoteRecord();
  // The materialized vote_tag Silver layer; null → the theme section hides.
  const themeData = await getVoteThemes();
  return <VoteTrackPage record={record} themeData={themeData} />;
}
