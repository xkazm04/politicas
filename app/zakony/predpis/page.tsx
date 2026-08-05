import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import StatuteRegistryPage from "@/features/lawwatch/StatuteRegistryPage";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { listStatuteRegistry } from "@/features/lawwatch/deriveStatuteDossier";
import { getLawData } from "@/features/lawwatch/getLawData";

// Paměť zákona (moonshot 5A) — rejstřík předpisů. Čisté pivotování nad
// getLawData() (React cache ⇒ sdílený promise s metadaty), žádné další čtení
// store. Bez grafu se poctivě ukáže DataUnavailable, nikdy mock rejstříku.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("lawStatuteRegistryTitle"),
    description: t("lawStatuteRegistryDescription"),
  };
}

export default async function PredpisRegistryPage() {
  const lawData = await getLawData();
  if (!lawData) {
    const t = await getTranslations("lawwatch");
    return (
      <DataUnavailable
        what={t("unavailable.registry")}
        backHref="/zakony"
        backLabel={t("unavailable.backToMonitor")}
      />
    );
  }
  return <StatuteRegistryPage rows={listStatuteRegistry(lawData)} />;
}
