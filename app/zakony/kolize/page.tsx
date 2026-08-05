import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CollisionsPage from "@/features/lawwatch/CollisionsPage";
import { getCollisionData } from "@/features/lawwatch/getCollisionData";
import { getRadarData } from "@/features/lawwatch/getRadarData";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("lawCollisionsTitle"),
    description: t("lawCollisionsDescription"),
  };
}

export default async function ZakonyKolizePage() {
  // Real Case-③ close-read output + the radar ledger derived over it and the
  // Case-① conflict flags (moonshot 4B). Null when the payload files or the
  // graph aren't available → the page renders explicit empty states, never a
  // fabrication.
  const [data, radar] = await Promise.all([getCollisionData(), getRadarData()]);
  return <CollisionsPage data={data} radar={radar} />;
}
