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

/**
 * `?okoli=<id>` — vstup do okolí uzlu z JINÉ plochy (spis firmy, zakázka).
 *
 * Route zůstává tenká: parametr se jen VALIDUJE a předá dál — okolí samo se
 * dotahuje serverovou akcí až na klientu, protože je to dotaz na uzel, ne
 * artefakt stránky. Prázdný nebo přehnaně dlouhý parametr se zahazuje, ne
 * opravuje (adresa je tvrzení, ne návrh).
 */
const MAX_ID = 200;

export default async function Graf({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Stránka posílá do prohlížeče jen rozcestí (sčítání druhů + vstupní body).
  // Uzly a hrany se dotahují serverovými akcemi až podle toho, co čtenář dělá.
  const [seed, params] = await Promise.all([getGraphSeed(), searchParams]);
  const raw = params.okoli;
  const okoli = typeof raw === "string" && raw.length > 0 && raw.length <= MAX_ID ? raw : null;
  return <GraphPage seed={seed} okoli={okoli} />;
}
