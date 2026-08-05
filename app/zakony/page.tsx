import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LawWatchPage from "@/features/lawwatch/LawWatchPage";
import { getDependencyData } from "@/features/lawwatch/getDependencyData";
import { getLawData } from "@/features/lawwatch/getLawData";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("lawwatchTitle"),
    description: t("lawwatchDescription"),
  };
}

export default async function ZakonyPage() {
  // Real Case-③ legislation graph (141 bills → 101 laws via 150 amends edges).
  // Null when no store / nothing materialized → the page falls back to the
  // labelled mock and never breaks.
  const lawData = await getLawData();
  // batch-014 bill-dependency census (Závislosti na doprovodných tiscích) —
  // an independent artifact read, not part of the graph store, so it can be
  // null (payload missing) while lawData is present, or vice versa.
  const dependencyData = await getDependencyData();
  return <LawWatchPage lawData={lawData} dependencyData={dependencyData} />;
}
