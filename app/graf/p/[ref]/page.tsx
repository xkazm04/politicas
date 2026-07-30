import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPermalinkData } from "@/features/graph/getPermalinkData";
import { decodeGraphRef, toEvidenceJsonLd } from "@/features/graph/permalink";
import PermalinkPage, { PermalinkGonePage } from "@/features/graph/PermalinkPage";
import DataUnavailable from "@/features/shared/components/DataUnavailable";

/**
 * /graf/p/[ref] — trvalá citace jednoho pohledu na znalostní graf.
 *
 * Stránka je čistě čtecí: adresa nese stav pohledu + otisk obsahu, server
 * pohled deterministicky odvodí znovu a NIC nezapisuje — citace není řádek
 * v databázi, ale adresovaný výpočet (vzor /dashboard/exponat/[id]).
 *
 * Nerozluštitelná adresa je opravdové „neexistuje" (404); nedostupný sklad
 * naopak 404 být nesmí (DataUnavailable); čitelná adresa, kterou dnešní graf
 * už nedokládá, to o sobě poctivě řekne (PermalinkGonePage).
 *
 * Vedle lidské sazby jde ven strojově čitelný balíček důkazů (JSON-LD,
 * schema.org Dataset s Claim na každou hranu) — vzor /zdroj/[ref]. Graf se
 * přepočítává dávkou, ne za provozu; denní revalidace kopíruje Exponát.
 */
export const revalidate = 86_400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const { ref } = await params;
  const result = await getPermalinkData(ref);
  const title =
    result.status === "ok" ? `Citace — ${result.view.title} · politicas` : "Citace grafu · politicas";
  return {
    title,
    description:
      "Trvalá citace pohledu na znalostní graf české politiky: tvrzení, stav lidské kontroly každé hrany, prameny a otisk obsahu v okamžiku vydání.",
  };
}

export default async function GrafPermalinkPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  // Levný syntaktický soud PŘED drahým znovuodvozením — 404 nesmí čekat na loader.
  if (decodeGraphRef(ref) === null) notFound();

  const result = await getPermalinkData(ref);
  if (result.status === "invalid") notFound();
  if (result.status === "unavailable") {
    return <DataUnavailable what="Citace grafu" backHref="/graf" backLabel="zpět na plátno grafu" />;
  }
  if (result.status === "gone") {
    return <PermalinkGonePage urlHash={result.urlHash} retrievedOn={result.retrievedOn} />;
  }

  const jsonLd = toEvidenceJsonLd(result.view);
  return (
    <>
      <script
        type="application/ld+json"
        // Serializovaný Dataset — obsah je náš vlastní odvozený objekt
        // (žádný uživatelský HTML vstup), < se escapuje kvůli </script>.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
      />
      <PermalinkPage view={result.view} />
    </>
  );
}
