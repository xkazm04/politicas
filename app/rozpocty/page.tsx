import type { Metadata } from "next";
import BudgetMirrorPage from "@/features/budget/BudgetMirrorPage";
import { getSupplierTies } from "@/features/budget/getSupplierTies";

/*
 * /rozpocty — Zrcadlo rozpočtů (moonshot 4A) + peněžní stopa obce (4D).
 * Rozpočty i smlouvy jsou statické generované moduly (features/budget/data);
 * ŽIVĚ se čte jen vrstva vazeb protistran na poslance (getSupplierTies) —
 * stav lidské kontroly se nesmí zmrazit do dávky. Metadata česky přímo zde
 * (messages/*.json mimo plochu — precedens /denik).
 */

export const metadata: Metadata = {
  title: "Zrcadlo rozpočtů — Politicas",
  description:
    "Hospodaření kterékoli z 6 254 obcí ČR proti obcím podobné velikosti: dluh na obyvatele, podíl investic, saldo z výkazů FIN 2-12 M systému MONITOR a peněžní stopa obce v Registru smluv — s počítanou vrstevnickou skupinou a přiznaným pokrytím.",
};

export default async function RozpoctyPage() {
  const supplierTies = await getSupplierTies();
  return <BudgetMirrorPage supplierTies={supplierTies} />;
}
