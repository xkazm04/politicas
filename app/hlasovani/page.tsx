import type { Metadata } from "next";
import VoteTrackPage from "@/features/votetrack/VoteTrackPage";

export const metadata: Metadata = {
  title: "VoteTrack — hlasování sněmovny · Politicas",
  description:
    "Deník jmenovitých hlasování, pohled do sálu a linie klubů — tři perspektivy nad daty psp.cz. Sytí pilíře Aktivita, Docházka a Nezávislost.",
};

export default function HlasovaniPage() {
  return <VoteTrackPage />;
}
