import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { getReceiptData } from "@/features/shared/provenance/getReceiptData";
import ReceiptPage, { ReceiptGonePage } from "@/features/shared/provenance/ReceiptPage";
import { toClaimReviewJsonLd } from "@/features/shared/provenance/receipt";

/**
 * /zdroj/[ref] — trvalá účtenka jednoho tvrzení znalostního grafu.
 *
 * Stránka je čistě čtecí: adresa nese celý identifikátor tvrzení
 * (features/shared/provenance/claimRef.ts), server účtenku deterministicky
 * odvodí znovu a NIC nezapisuje. Nerozluštitelná adresa je opravdové
 * „neexistuje" (404); nedostupný store naopak 404 být nesmí (DataUnavailable);
 * rozluštitelná adresa bez záznamu v dnešním grafu to o sobě poctivě řekne.
 *
 * Vedle lidské sazby jde ven i strojově čitelný tvar (schema.org/ClaimReview)
 * — fact-check crawler si účtenku přečte bez parsování HTML.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const { ref } = await params;
  const result = await getReceiptData(ref);
  const title =
    result.status === "ok"
      ? `Účtenka původu — ${result.receipt.subject.label} · politicas`
      : "Účtenka původu · politicas";
  return {
    title,
    description:
      "Doklad k tvrzení znalostního grafu: záznam, jeho provenience, stav lidské kontroly a odkazy do veřejných registrů.",
  };
}

export default async function ZdrojPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const result = await getReceiptData(ref);

  if (result.status === "invalid") notFound();
  if (result.status === "unavailable") {
    return <DataUnavailable what="Účtenka původu" backHref="/dashboard" backLabel="zpět do velína" />;
  }
  if (result.status === "gone") {
    return <ReceiptGonePage encodedRef={result.ref} />;
  }

  const jsonLd = toClaimReviewJsonLd(result.receipt, `/zdroj/${result.receipt.ref}`);
  return (
    <>
      <script
        type="application/ld+json"
        // Serializovaná ClaimReview — obsah je náš vlastní odvozený objekt
        // (žádný uživatelský HTML vstup), < se escapuje kvůli </script>.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
      />
      <ReceiptPage receipt={result.receipt} />
    </>
  );
}
