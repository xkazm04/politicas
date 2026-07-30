import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StatuteDossierPage from "@/features/lawwatch/StatuteDossierPage";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { deriveStatuteDossier } from "@/features/lawwatch/deriveStatuteDossier";
import { getLawData } from "@/features/lawwatch/getLawData";
import { parseStatuteSlug } from "@/features/lawwatch/statuteRef";

// Paměť zákona (moonshot 5A) — kritické vydání jednoho předpisu.
// Adresa: /zakony/predpis/<slug>, slug = URL podoba „č. N/RRRR Sb." („586-1992").
// Kodek je přísný (statuteRef.ts): nekanonický slug → notFound, žádné hádání.
// „Graf nedostupný" (loader null) se od „předpis neexistuje" poctivě rozlišuje
// — první NESMÍ být 404 (viz DataUnavailable), druhé ano.

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const canonical = parseStatuteSlug(ref);
  const lawData = canonical ? await getLawData() : null;
  const dossier = lawData && canonical ? deriveStatuteDossier(lawData, canonical) : null;
  if (!dossier) return { title: "Paměť zákona — Politicas" };
  return {
    title: `Zákon č. ${dossier.ref} Sb. — paměť zákona — Politicas`,
    description:
      dossier.title ??
      `Kritické vydání zákona č. ${dossier.ref} Sb.: kdo ho měnil a doslovná §-stopa z e-Sbírky.`,
  };
}

export default async function PredpisPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const canonical = parseStatuteSlug(ref);
  if (!canonical) notFound();
  const lawData = await getLawData();
  if (!lawData) {
    return <DataUnavailable what="Předpis" backHref="/zakony" backLabel="zpět na monitor legislativy" />;
  }
  const dossier = deriveStatuteDossier(lawData, canonical);
  if (!dossier) notFound();
  return <StatuteDossierPage dossier={dossier} />;
}
