/**
 * @catalog Svědčící číslo — vykreslí figuru přesně jako dnes, ale strojově čitelně.
 *
 * `<CitableNumber>` = `<data>` element s viditelným textem z lib/format
 * (byte-identickým s prostým formátovačem) a s data-claim-* atributy z
 * lib/claims/claim.ts. U OVĚŘENÝCH claimů (`reviewStatus: "verified"`) navíc
 * volitelně vyzáří schema.org ClaimReview JSON-LD; u pending claimů se JSON-LD
 * nikdy nevydá — bránu vynucuje claimReviewJsonLd, ne volající.
 *
 * Server-kompatibilní (žádné hooky) — locale předává volající, na serveru
 * z `getLocale()`, v klientu z `useLocale()`. Nefinální hodnota (NaN/∞)
 * vykreslí placeholder BEZ atributů: pomlčka nesmí svědčit.
 */

import type { Locale } from "@/lib/i18n/config";
import { formatCitable, type CitableKind } from "@/lib/format";
import { claimReviewJsonLd, type Claim } from "./claim";

export default function CitableNumber({
  value,
  claim,
  locale,
  kind = "dec",
  withJsonLd = false,
  className = "",
}: {
  value: number;
  claim: Claim;
  locale: Locale;
  /** Který formátovač sází viditelný text (dec/int/czk). */
  kind?: CitableKind;
  /** Vyzářit ClaimReview JSON-LD — projde jen u ověřených claimů. */
  withJsonLd?: boolean;
  className?: string;
}) {
  const { text, attrs } = formatCitable(value, claim, locale, kind);
  if (attrs === null) {
    // Ne-číslo: stejný placeholder jako prosté formátovače, žádné svědectví.
    return <span className={className}>{text}</span>;
  }
  const jsonLd = withJsonLd ? claimReviewJsonLd(claim, text) : null;
  // Každé "<" se escapuje na unicode sekvenci u003c, aby ani teoretická script
  // značka v datasetovém řetězci nemohla utéct z JSON-LD bloku (validní JSON
  // escape, parsery čtou identickou hodnotu).
  const jsonLdHtml = jsonLd ? JSON.stringify(jsonLd).replace(/</g, "\\u003c") : null;
  return (
    <>
      <data value={String(value)} {...attrs} className={className}>
        {text}
      </data>
      {jsonLdHtml !== null && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml }} />
      )}
    </>
  );
}
