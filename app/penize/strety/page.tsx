import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import StretyPage from "@/features/money/collisions/StretyPage";
import { getCollisionCandidates } from "@/features/money/collisions/getCollisionCandidates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("stretyTitle"),
    description: t("stretyDescription"),
  };
}

export default async function StretyRoute() {
  // Kandidáti se odvozují znovu při KAŽDÉM požadavku (žádné review-řádky,
  // žádná materializace) — null, když datová vrstva není dostupná.
  const data = await getCollisionCandidates();
  return <StretyPage data={data} />;
}
