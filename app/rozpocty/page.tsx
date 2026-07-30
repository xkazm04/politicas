import type { Metadata } from "next";
import BudgetMirrorPage from "@/features/budget/BudgetMirrorPage";

/*
 * /rozpocty — Zrcadlo rozpočtů (moonshot 4A). Tenká routa nad klientskou
 * plochou; data jsou statické generované moduly (features/budget/data),
 * žádný server loader. Metadata česky přímo zde (messages/*.json mimo
 * plochu — precedens /denik) — původní klíče meta.budget* popisovaly
 * ukázková data, což už není pravda.
 */

export const metadata: Metadata = {
  title: "Zrcadlo rozpočtů — Politicas",
  description:
    "Hospodaření kterékoli z 6 254 obcí ČR proti obcím podobné velikosti: dluh na obyvatele, podíl investic a saldo z výkazů FIN 2-12 M systému MONITOR (Státní pokladna), s počítanou vrstevnickou skupinou a přiznaným pokrytím.",
};

export default function RozpoctyPage() {
  return <BudgetMirrorPage />;
}
