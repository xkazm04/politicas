import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import GraphPage from "@/features/graph/GraphPage";
import { getGraphSeed } from "@/features/graph/graphLoader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("graphTitle"),
    description: t("graphDescription"),
  };
}

export default async function Graf() {
  // Stránka posílá do prohlížeče jen rozcestí (sčítání druhů + vstupní body).
  // Uzly a hrany se dotahují serverovými akcemi až podle toho, co čtenář dělá.
  const seed = await getGraphSeed();
  return <GraphPage seed={seed} />;
}
