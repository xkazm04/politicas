import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { getReceiptData } from "@/features/shared/provenance/getReceiptData";
import ReceiptPage, { ReceiptGonePage } from "@/features/shared/provenance/ReceiptPage";
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import { toClaimReviewJsonLd } from "@/features/shared/provenance/receipt";

/**
 * /zdroj/[ref] — trvalá účtenka jednoho tvrzení znalostního grafu.
 *
 * Stránka je čistě čtecí: adresa nese celý identifikátor tvrzení
 * (features/shared/provenance/claimRef.ts), server účtenku deterministicky
 * odvodí znovu a NIC nezapisuje. Nerozluštitelná adresa je opravdové
 * „neexistuje" (404); nedostupný store naopak 404 být nesmí (DataUnavailable);
 * rozluštitelná adresa bez záznamu v dnešním grafu to o sobě poctivě řekne —
 * a od 2026-08-12 přitom VYPÍŠE, co tvrdila (ReceiptGonePage).
 *
 * Vedle lidské sazby jde ven i strojově čitelný tvar (schema.org/ClaimReview),
 * ale POUZE za záznam, který prošel lidskou branou — pravidlo drží
 * `toClaimReviewJsonLd`, ne tahle routa (viz lib/claims/claim.ts §3).
 *
 * ZÁKLAD ADRESY se čte z hlaviček requestu — týž precedens jako app/sitemap.ts
 * a všechny čtyři feedy: v dev čestně localhost, v nasazení skutečný host,
 * NIKDY vymyšlená doména. Bez hostitele se pole `url` z JSON-LD prostě vynechá.
 */

/** Absolutní adresa téhle účtenky, nebo null, když ji nelze poctivě složit. */
async function absoluteReceiptUrl(encodedRef: string): Promise<string | null> {
  const h = await headers();
  const host = h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${claimRefPath(encodedRef)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const { ref } = await params;
  const [result, t] = await Promise.all([getReceiptData(ref), getTranslations("shared")]);
  const title =
    result.status === "ok"
      ? t("receipt.meta.titleWithSubject", { subject: result.receipt.subject.label })
      : t("receipt.meta.title");
  return { title, description: t("receipt.meta.description") };
}

export default async function ZdrojPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const result = await getReceiptData(ref);

  if (result.status === "invalid") notFound();
  if (result.status === "unavailable") {
    const t = await getTranslations("shared");
    return (
      <DataUnavailable
        what={t("receipt.unavailable.what")}
        // Na /zdroj se chodí ZVENČÍ, po citaci — velín (/dashboard) je adresa
        // pro provozovatele, ne pro novináře, který sem přišel z odkazu.
        backHref="/"
        backLabel={t("receipt.unavailable.back")}
      />
    );
  }
  if (result.status === "gone") {
    return <ReceiptGonePage encodedRef={result.ref} decoded={result.decoded} />;
  }

  // null = tvrzení lidskou branou neprošlo (nebo základ adresy nejde zjistit) —
  // pak nejde ven ŽÁDNÁ fact-check značka; zeslabený náhradní typ se nevymýšlí.
  const jsonLd = toClaimReviewJsonLd(
    result.receipt,
    await absoluteReceiptUrl(result.receipt.ref),
  );
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // Serializovaná ClaimReview — obsah je náš vlastní odvozený objekt
          // (žádný uživatelský HTML vstup), < se escapuje kvůli </script>.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
        />
      )}
      <ReceiptPage receipt={result.receipt} />
    </>
  );
}
