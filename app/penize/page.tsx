import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import FollowTheMoneyPage from "@/features/money/FollowTheMoneyPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("moneyTitle"),
    description: t("moneyDescription"),
  };
}

export default function PenizePage() {
  return <FollowTheMoneyPage />;
}
