import type { Metadata } from "next";
import VerificationConsole from "@/features/money/components/VerificationConsole";
import { getVerificationQueue } from "@/features/money/getVerificationData";

export const metadata: Metadata = {
  title: "Kontrola vazeb · FollowTheMoney",
  description:
    "Ověřovací konzole pro nepotvrzené vazby poslanec↔firma — důkazní složka a proklik do primárních rejstříků. Lidská brána: potvrdit vazbu může jedině člověk.",
};

export default async function KontrolaPage() {
  // Pending money-ties from the materialized knowledge graph. Null when no store /
  // no materialized layer → the console renders its labelled empty state.
  const data = await getVerificationQueue();
  return <VerificationConsole data={data} />;
}
