import type { Metadata } from "next";
import StatuteRegistryPage from "@/features/lawwatch/StatuteRegistryPage";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { listStatuteRegistry } from "@/features/lawwatch/deriveStatuteDossier";
import { getLawData } from "@/features/lawwatch/getLawData";

// Paměť zákona (moonshot 5A) — rejstřík předpisů. Čisté pivotování nad
// getLawData() (React cache ⇒ sdílený promise s metadaty), žádné další čtení
// store. Bez grafu se poctivě ukáže DataUnavailable, nikdy mock rejstříku.

export const metadata: Metadata = {
  title: "Paměť zákona — rejstřík předpisů — Politicas",
  description:
    "Kritická vydání českých zákonů: kdo který předpis měnil, s doslovnou §-stopou z e-Sbírky tam, kde ji archiv nese.",
};

export default async function PredpisRegistryPage() {
  const lawData = await getLawData();
  if (!lawData) {
    return <DataUnavailable what="Rejstřík předpisů" backHref="/zakony" backLabel="zpět na monitor legislativy" />;
  }
  return <StatuteRegistryPage rows={listStatuteRegistry(lawData)} />;
}
