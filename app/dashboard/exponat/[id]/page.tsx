import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ExhibitPage from "@/features/dashboard/ExhibitPage";
import { getExhibitData } from "@/features/dashboard/getExhibitData";
import { decodeExhibitId } from "@/features/dashboard/exhibit";
import DataUnavailable from "@/features/shared/components/DataUnavailable";

/**
 * Exponát dědí denní okno velína (viz app/dashboard/page.tsx a
 * features/dashboard/freshness.ts) — obsah se znovuodvozuje z týchž loaderů,
 * takže čerstvější než velín být nemůže a starší být nesmí. Literál ze
 * stejného důvodu jako tam: Next čte segmentovou konfiguraci staticky.
 *
 * Stránka je čistě čtecí: adresa nese druh + otisk obsahu, server obsah
 * deterministicky odvodí znovu a NIC nezapisuje — exponát není řádek
 * v databázi, ale adresovaný výpočet.
 */
export const revalidate = 86_400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodeExhibitId(id);
  const what = decoded?.kind === "fakt" ? "datovaný fakt" : "výřez grafu státu";
  return {
    title: decoded ? `Exponát — ${what} · politicas` : "Exponát · politicas",
    description:
      "Citovatelný otisk výřezu velína: obsah adresovaný content-hashem, s prameny, otiskem a datem získání dat v citační patičce.",
  };
}

export default async function ExponatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getExhibitData(id);
  // Nerozluštitelná adresa je opravdové „neexistuje" — žádný obsah ji nikdy
  // nenesl. Nedostupný store naopak 404 být nesmí (viz DataUnavailable).
  if (result.status === "invalid") notFound();
  if (result.status === "unavailable") {
    return <DataUnavailable what="Exponát" backHref="/dashboard" backLabel="zpět do velína" />;
  }
  return <ExhibitPage data={result} />;
}
