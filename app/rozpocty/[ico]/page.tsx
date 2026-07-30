import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BudgetMirrorPage from "@/features/budget/BudgetMirrorPage";
import { getSupplierTies } from "@/features/budget/getSupplierTies";
import { getBudgetSeries, getMunicipality } from "@/features/budget/mirrorData";
import { getSupplierTable } from "@/features/budget/supplierTrail";

/*
 * /rozpocty/[ico] — trvalá adresa zrcadla jedné obce (IČO = klíč MONITORu
 * i celého peněžního grafu). Neznámé IČO je skutečná 404: rejstřík nese
 * všech 6 254 obcí ČR, takže „není v rejstříku" znamená „taková obec
 * neexistuje", ne „data zrovna nejedou" (rozdíl viz DataUnavailable).
 */

export function generateStaticParams(): { ico: string }[] {
  // Předgeneruj obce s napojenou rozpočtovou řadou (132 v této dávce) i obce
  // se smlouvami v peněžním grafu (4D); zbytek rejstříku se renderuje na
  // vyžádání (dynamicParams default).
  const icos = new Set([...getBudgetSeries().keys(), ...getSupplierTable().keys()]);
  return [...icos].map((ico) => ({ ico }));
}

export async function generateMetadata({ params }: { params: Promise<{ ico: string }> }): Promise<Metadata> {
  const { ico } = await params;
  const town = getMunicipality(ico);
  if (!town) return { title: "Obec nenalezena — Politicas" };
  return {
    title: `${town.name} — zrcadlo rozpočtu — Politicas`,
    description: `Hospodaření obce ${town.name} (${town.krajName}) proti obcím podobné velikosti — dluh na obyvatele, podíl investic a saldo z výkazů FIN 2-12 M systému MONITOR.`,
  };
}

export default async function RozpoctyIcoPage({ params }: { params: Promise<{ ico: string }> }) {
  const { ico } = await params;
  if (!getMunicipality(ico)) notFound();
  const supplierTies = await getSupplierTies();
  return <BudgetMirrorPage initialIco={ico} supplierTies={supplierTies} />;
}
