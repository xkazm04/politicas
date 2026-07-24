import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import FollowTheMoneyPage from "@/features/money/FollowTheMoneyPage";
import { getMoneyData } from "@/features/money/getMoneyData";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("moneyTitle"),
    description: t("moneyDescription"),
  };
}

export default async function PenizePage() {
  // Real money layer of the knowledge graph (kg_node/kg_edge). Null when no
  // store / no materialized ties → the page keeps its labelled mock fallback.
  const money = await getMoneyData();
  return <FollowTheMoneyPage data={money} />;
}
