import type { Metadata } from "next";
import DataReleasesPage from "@/features/data-releases/DataReleasesPage";
import { getDataReleasesData } from "@/features/data-releases/getDataReleasesData";

/*
 * /data — Datové verze (batch 3D): vydávací stránka datové vrstvy. Tenká
 * routa: sestaví manifest + changelog + velikost snapshotu a předá je
 * presentační komponentě. Metadata česky přímo zde (messages/*.json je mimo
 * plochu 3D — precedens /dukazy) a ohlašují strojové podoby vydání.
 */

export const metadata: Metadata = {
  title: "Datové verze — Politicas",
  description:
    "Graf republiky vydávaný jako software: verze RRRR.MM.DD, kardinalitní prahy jako vydávací brána, Merkle kořeny a hash-řetěz revizí jako doklad integrity, snapshot ke stažení s přiznanou velikostí.",
};

// Manifest se mění každým ingest během — čte se za requestu; null → čestný
// stav „nečitelné, ne prázdné" (viz getDataReleasesData).
export const dynamic = "force-dynamic";

export default async function DataRoute() {
  const data = await getDataReleasesData();
  return <DataReleasesPage data={data} />;
}
