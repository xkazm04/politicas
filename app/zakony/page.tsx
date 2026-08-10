import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LawWatchPage from "@/features/lawwatch/LawWatchPage";
import { getDependencyData } from "@/features/lawwatch/getDependencyData";
import { getLawData } from "@/features/lawwatch/getLawData";
import { toLawWatchWire } from "@/features/lawwatch/publicWire";

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
  // batch-014 bill-dependency census (Závislosti na doprovodných tiscích) —
  // an independent artifact read, not part of the graph store, so it can be
  // null (payload missing) while lawData is present, or vice versa. The two are
  // independent, so they are awaited together rather than one after the other.
  const [lawData, dependencyData] = await Promise.all([getLawData(), getDependencyData()]);
  // THE WIRE (features/lawwatch/publicWire.ts) — applied HERE, between the loader
  // and the client, exactly like /penize and /dashboard. The index renders ~10 of
  // LawData's fields; the forensic prose, the verbatim §-diffs and the sector flags
  // belong to /zakony/[cislo], which keeps the FULL shape from the same loader.
  return <LawWatchPage lawData={lawData && toLawWatchWire(lawData)} dependencyData={dependencyData} />;
}
