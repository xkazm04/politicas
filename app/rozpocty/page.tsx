import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import BudgetMirrorPage from "@/features/budget/BudgetMirrorPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("budgetTitle"),
    description: t("budgetDescription"),
  };
}

export default function RozpoctyPage() {
  return <BudgetMirrorPage />;
}
