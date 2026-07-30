import type { Metadata } from "next";
import CollisionsPage from "@/features/lawwatch/CollisionsPage";
import { getCollisionData } from "@/features/lawwatch/getCollisionData";
import { getRadarData } from "@/features/lawwatch/getRadarData";

export const metadata: Metadata = {
  title: "Kolizní radar — Politicas",
  description:
    "Systém včasného varování legislativního procesu: chronologická kniha nálezů (kolize souběžně projednávaných tisků nad týmž §, odvozené příznaky střetu u předkladatelů) s trvalými kotvami, citačními bloky a RSS/JSON feedem — plus shluky close-read nálezů case ③ podle zákona a paragrafu.",
};

export default async function ZakonyKolizePage() {
  // Real Case-③ close-read output + the radar ledger derived over it and the
  // Case-① conflict flags (moonshot 4B). Null when the payload files or the
  // graph aren't available → the page renders explicit empty states, never a
  // fabrication.
  const [data, radar] = await Promise.all([getCollisionData(), getRadarData()]);
  return <CollisionsPage data={data} radar={radar} />;
}
