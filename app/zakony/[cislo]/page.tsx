import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import BillDossierPage from "@/features/lawwatch/BillDossierPage";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { findBillByCislo, getLawData } from "@/features/lawwatch/getLawData";

// URL convention (mirrors /poslanec/<pspId>): /zakony/<cislo> where <cislo> is the
// public sněmovní-tisk print number (psp.cz `t=`/`ct=` param) — NEVER the graph's
// internal `bill:tisk:<tiskId>` node-id suffix, which is an unrelated internal id.
// No generateStaticParams: this app is local/single-user (per the lawwatch
// restructure brief) and the graph loader is cheap enough to resolve on demand.

export async function generateMetadata({ params }: { params: Promise<{ cislo: string }> }): Promise<Metadata> {
  const { cislo } = await params;
  const t = await getTranslations("meta");
  const n = Number(cislo);
  const lawData = Number.isFinite(n) ? await getLawData() : null;
  const dossier = lawData ? findBillByCislo(lawData, n) : null;
  if (!dossier) return { title: t("lawwatchTitle") };
  return {
    title: t("lawBillTitle", { cislo: dossier.bill.cislo ?? n, title: dossier.bill.title }),
    description: dossier.bill.title,
  };
}

export default async function ZakonyTiskPage({ params }: { params: Promise<{ cislo: string }> }) {
  const { cislo } = await params;
  const n = Number(cislo);
  if (!Number.isFinite(n)) notFound(); // a non-numeric slug is genuinely no tisk
  const lawData = await getLawData();
  // Distinguish "graf nedostupný" (loader null — single-connection PGlite held
  // elsewhere) from "tisk neexistuje" (graph loaded, no such print number). The
  // first must NOT render as 404; see DataUnavailable's rationale.
  if (!lawData) {
    const t = await getTranslations("lawwatch");
    return (
      <DataUnavailable what={t("unavailable.bill")} backHref="/zakony" backLabel={t("unavailable.backToBills")} />
    );
  }
  const dossier = findBillByCislo(lawData, n);
  if (!dossier) notFound();
  return <BillDossierPage dossier={dossier} />;
}
