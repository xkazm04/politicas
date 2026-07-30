import type { Metadata } from "next";
import AtlasPage from "@/features/atlas/AtlasPage";
import { getAtlasReport } from "@/features/atlas/getAtlasData";

/*
 * /atlas — Atlas kvality otevřených dat (batch 6D). Tenká routa: sestaví
 * report (features/atlas/getAtlasData) a předá presentační komponentě.
 * Metadata česky přímo zde (messages/*.json je mimo plochu 6D — precedens
 * /data, batch 3D).
 */

export const metadata: Metadata = {
  title: "Atlas kvality otevřených dat — Politicas",
  description:
    "Veřejné známky kvality zdrojů, které politicas nasypává: pokrytí provenancí, čerstvost proti kadenci, integrita Merkle pečetí, úplnost měřená přiznanými mezerami. Každé skóre s vytištěným pravidlem; dimenze bez podkladu je „nehodnoceno“, nikdy nula.",
};

// Skóre se mění každým ingest během — čte se za requestu; null → čestný stav
// „nečitelné, ne prázdné“ (viz getAtlasReport).
export const dynamic = "force-dynamic";

export default async function AtlasRoute() {
  const report = await getAtlasReport();
  return <AtlasPage report={report} />;
}
