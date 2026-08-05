import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import BudgetMirrorPage from "@/features/budget/BudgetMirrorPage";
import { getSupplierTies } from "@/features/budget/getSupplierTies";

/*
 * /rozpocty — Zrcadlo rozpočtů (moonshot 4A) + peněžní stopa obce (4D).
 * Rozpočty i smlouvy jsou statické generované moduly (features/budget/data);
 * ŽIVĚ se čte jen vrstva vazeb protistran na poslance (getSupplierTies) —
 * stav lidské kontroly se nesmí zmrazit do dávky. Metadata přes next-intl
 * (meta.budgetMirror*) — dvojjazyčný start nahradil precedens /denik.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("budgetMirrorTitle"),
    description: t("budgetMirrorDescription"),
  };
}

export default async function RozpoctyPage() {
  const supplierTies = await getSupplierTies();
  return <BudgetMirrorPage supplierTies={supplierTies} />;
}
