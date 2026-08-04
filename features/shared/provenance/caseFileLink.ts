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

/*
 * Tvar id JE gramatika — a bydlí tady, jednou. Hodnotové claimy (/penize,
 * /zebricek) nesou v `subject` přesně tahle id, takže je brána musí umět
 * přečíst zpátky na pspId / IČO. Kdyby si na to napsala vlastní regulární
 * výraz, měl by repozitář dvě definice toho, co je „naše id", a rozešly by se
 * na první změně (přesně to, čemu se vyhýbá refDetect u adres).
 */

/** `psp:person:6881` → 6881; jiný tvar → null. */
export function pspIdFromEntityId(id: string): number | null {
  const m = id.match(PERSON_ID);
  return m ? Number(m[1]) : null;
}

/** `company:ico:46347534` → „46347534"; jiný tvar → null. Nenormalizuje —
 *  kanonický osmimístný tvar vlastní features/money/companyId.ts. */
export function icoFromEntityId(id: string): string | null {
  const m = id.match(COMPANY_ID);
  return m ? m[1] : null;
}

/** null = pro tenhle uzel naši plochu nemáme (nebo id nemá známý tvar). */
export function caseFileLinkFor(endpoint: { id: string; kind: string }): CaseFileLink | null {
  if (endpoint.kind === "person") {
    const pspId = pspIdFromEntityId(endpoint.id);
    return pspId === null ? null : { href: `/poslanec/${pspId}`, target: "poslanec" };
  }
  if (endpoint.kind === "company") {
    // /penize/firma/[ico] si segment sama normalizuje na kanonický osmimístný
    // tvar (features/money/companyId.ts) — posíláme ho tak, jak ho nese id.
    const ico = icoFromEntityId(endpoint.id);
    return ico === null ? null : { href: `/penize/firma/${ico}`, target: "firma" };
  }
  return null;
}
