import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import FollowTheMoneyPage from "@/features/money/FollowTheMoneyPage";
import { getMoneyData } from "@/features/money/getMoneyData";
import { toLedgerData } from "@/features/money/publicWire";

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
  // The PUBLIC WIRE (features/money/publicWire.ts): the ledger renders 15 of the tie's
  // 38 fields, and the other 23 — analyst prose, the corroboration capsule, the review
  // trail — are evidence the CASE FILE and the CONSOLE render, not this list page. They
  // stay on `MoneyTie`; they just stop crossing the network here.
  return <FollowTheMoneyPage data={money ? toLedgerData(money) : null} />;
}
