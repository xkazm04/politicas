import type { Metadata } from "next";
import CollisionsPage from "@/features/lawwatch/CollisionsPage";
import { getCollisionData } from "@/features/lawwatch/getCollisionData";

export const metadata: Metadata = {
  title: "Kolize tisků — Politicas",
  description:
    "Sněmovní tisky, které nezávisle novelizují stejný § téhož zákona — kolize a koordinační rizika, seskupené podle zákona a paragrafu, z case ③ legislativní forenziky.",
};

export default async function ZakonyKolizePage() {
  // Real Case-③ close-read output (batches 001–004). Null when the payload files or the
  // graph aren't available → the page renders an explicit empty state, never a fabrication.
  const data = await getCollisionData();
  return <CollisionsPage data={data} />;
}
