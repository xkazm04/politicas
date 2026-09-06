import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import DataUnavailable from "@/features/shared/components/DataUnavailable";
import { getReceiptData } from "@/features/shared/provenance/getReceiptData";
import ReceiptPage, { ReceiptGonePage } from "@/features/shared/provenance/ReceiptPage";
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import { toClaimReviewJsonLd } from "@/features/shared/provenance/receipt";
import { liveUrl } from "@/lib/routing/liveUrl";
import { firstParam } from "@/lib/routing/searchParam";

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
 * ZÁKLAD ADRESY se čte z hlaviček requestu — JEDNOU definicí pro celý strom
 * (`lib/routing/liveUrl`, táž jako sitemapa, robots, feedy a plakát; do
 * 2026-09-08 ji tenhle soubor opisoval): v dev čestně localhost, v nasazení
 * skutečný host, NIKDY vymyšlená doména. Bez hostitele se pole `url` z JSON-LD
 * prostě vynechá.
 */

/** Absolutní adresa téhle účtenky, nebo null, když ji nelze poctivě složit
 *  (bez hostitele vrací liveUrl jen cestu — a relativní adresa do JSON-LD nejde). */
async function absoluteReceiptUrl(encodedRef: string): Promise<string | null> {
  const url = await liveUrl(claimRefPath(encodedRef));
  return url.startsWith("/") ? null : url;
}

/**
 * `?k=YYYY-MM-DD` — čočka „k tomu dni". Plumbing, nic víc: co je platný den a
 * co se stane s tím, co jím není, rozhoduje features/shared/provenance/asOfLens.ts
 * (odmítnuto, ne opraveno), a routa jen předá první hodnotu parametru —
 * sdíleným tvarovým strážcem, ne vlastní kopií.
 */
const asOfParam = firstParam;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [{ ref }, sp] = await Promise.all([params, searchParams]);
  const [result, t] = await Promise.all([
    getReceiptData(ref, asOfParam(sp.k)),
    getTranslations("shared"),
  ]);
  const title =
    result.status === "ok"
      ? t("receipt.meta.titleWithSubject", { subject: result.receipt.subject.label })
      : t("receipt.meta.title");
  return { title, description: t("receipt.meta.description") };
}

export default async function ZdrojPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: SearchParams;
}) {
  const [{ ref }, sp] = await Promise.all([params, searchParams]);
  const result = await getReceiptData(ref, asOfParam(sp.k));

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
    return <ReceiptGonePage encodedRef={result.ref} decoded={result.decoded} last={result.last} />;
  }

  // null = tvrzení lidskou branou neprošlo (nebo základ adresy nejde zjistit) —
  // pak nejde ven ŽÁDNÁ fact-check značka; zeslabený náhradní typ se nevymýšlí.
  // ...a rovněž ne z účtenky ČTENÉ K NĚJAKÉMU DNI: značka nese žádné datum
  // pohledu, takže crawler by historickou verzi (nebo dnešní záznam sázený pod
  // bannerem „k tomu dni neexistuje") přečetl jako aktuální ověřené tvrzení.
  // Mlčení je jediná poctivá strojová odpověď na dotaz do minulosti.
  const jsonLd =
    result.asOf.state === "live"
      ? toClaimReviewJsonLd(result.receipt, await absoluteReceiptUrl(result.receipt.ref))
      : null;
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
      <ReceiptPage receipt={result.receipt} asOf={result.asOf} />
    </>
  );
}
