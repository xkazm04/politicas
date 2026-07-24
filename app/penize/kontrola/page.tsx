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
  // Write-path gate: only tell the client WHETHER it's configured + the display
  // name (not a secret) — the token itself never leaves the server unexamined;
  // it's checked inside submitReviewDecision against process.env.REVIEWER_TOKEN.
  const writeConfigured = Boolean(process.env.REVIEWER_TOKEN?.trim());
  const reviewerName = process.env.REVIEWER_NAME?.trim() || null;
  return <VerificationConsole data={data} writeConfigured={writeConfigured} reviewerName={reviewerName} />;
}
