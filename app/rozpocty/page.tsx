import type { Metadata } from "next";
import BudgetMirrorPage from "@/features/budget/BudgetMirrorPage";

export const metadata: Metadata = {
  title: "BudgetMirror — zrcadlo rozpočtů · Politicas",
  description:
    "Hospodaření města proti vrstevníkům podobné velikosti: dluh na obyvatele, podíl investic a saldo z dat MONITOR / Státní pokladny.",
};

export default function RozpoctyPage() {
  return <BudgetMirrorPage />;
}
