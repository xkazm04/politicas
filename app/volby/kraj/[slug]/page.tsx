import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import KrajPage from "@/features/volby/KrajPage";
import { getKrajData } from "@/features/volby/getKrajData";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { krajBySlug } from "@/lib/analysis/volby/kraje";

/*
 * /volby/kraj/[slug] — kraj jako subjekt krajského lístku. Slug se ověřuje
 * proti 14řádkovému crosswalku BEZ čtení store (neznámý slug je 404 za každého
 * stavu databáze); null z loaderu = výpadek → DataUnavailable + noindex.
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("meta");
  const kraj = krajBySlug(slug);
  if (!kraj) return { title: t("volbyNotFound") };
  const result = await getKrajData(slug);
  if (result === null) return { title: t("volbyUnavailableTitle"), robots: { index: false } };
  if (result.kind === "not-found") return { title: t("volbyNotFound") };
  return { title: t("volbyKrajTitle", { kraj: kraj.name }), description: t("volbyKrajDescription", { kraj: kraj.name }) };
}

export default async function KrajRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!krajBySlug(slug)) notFound();
  const result = await getKrajData(slug);
  if (result === null) {
    const t = await getTranslations("volby");
    return <DataUnavailable what={t("unavailableWhat")} backHref="/volby" backLabel={t("unavailableBack")} />;
  }
  if (result.kind === "not-found") notFound();
  return <KrajPage data={result.data} />;
}
