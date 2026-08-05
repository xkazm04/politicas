import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VerificationConsole from "@/features/money/components/VerificationConsole";
import { getVerificationQueue } from "@/features/money/getVerificationData";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("kontrolaTitle"),
    description: t("kontrolaDescription"),
    // Interní fronta nerozhodnutých vazeb, veřejně prolinkovaná z /penize. Není to
    // publikace: nese poznámky revizora a analytickou prózu o jmenovaných lidech,
    // které ještě neprošly branou. `app/robots.ts` k tomu přidává Disallow; obojí je
    // prosba k prohledávači, nikoli řízení přístupu (to dělá REVIEWER_TOKEN).
    robots: { index: false },
  };
}

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
