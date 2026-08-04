/*
 * SPIS KE KONCOVÉMU BODU ÚČTENKY — jediné místo, kde se z id uzlu stává
 * odkaz na naši vlastní plochu.
 *
 * Účtenka odkazovala do CIZÍCH registrů (ARES, psp.cz, registr smluv) a do
 * vlastních spisů NE — přestože `subject.id` / `object.id` jsou přesně ta id,
 * na kterých /poslanec/<pspId> a /penize/firma/<ico> stojí. Čtenář, který
 * přišel na doklad jedné vazby, tak neměl kam pokračovat.
 *
 * Pravidla:
 *  1. Odkaz jen z TVARU ULOŽENÉHO ID, nikdy z odhadu. Neznámý tvar nedostane
 *     odkaz (táž disciplína jako lib/kg/sourceLinks: „nikdy hádané").
 *  2. Jen plochy, které pro danou entitu OPRAVDU existují.
 *  3. Čistý modul — sází ho kapsle, stránka /zdroj i brána /overeni.
 */

/** Spis na naší ploše pro koncový bod účtenky. */
export interface CaseFileLink {
  href: string;
  /** Co je na druhé straně — plocha ho sází jako popisek odkazu. */
  target: "poslanec" | "firma";
}

const PERSON_ID = /^psp:person:(\d+)$/;
const COMPANY_ID = /^company:ico:(\d{1,8})$/;

/** null = pro tenhle uzel naši plochu nemáme (nebo id nemá známý tvar). */
export function caseFileLinkFor(endpoint: { id: string; kind: string }): CaseFileLink | null {
  if (endpoint.kind === "person") {
    const m = endpoint.id.match(PERSON_ID);
    return m ? { href: `/poslanec/${m[1]}`, target: "poslanec" } : null;
  }
  if (endpoint.kind === "company") {
    const m = endpoint.id.match(COMPANY_ID);
    // /penize/firma/[ico] si segment sama normalizuje na kanonický osmimístný
    // tvar (features/money/companyId.ts) — posíláme ho tak, jak ho nese id.
    return m ? { href: `/penize/firma/${m[1]}`, target: "firma" } : null;
  }
  return null;
}
