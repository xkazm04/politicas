// Paměť zákona — kodek adres předpisu a §-kotev (moonshot 5A).
//
// Veřejné adresy jsou API: /zakony/predpis/<slug>, kde slug je „586-1992"
// (URL-bezpečná podoba „č. 586/1992 Sb."), a v rámci stránky kotvy `#p-<§>`
// (např. `#p-35ba`) — pátý kotevní jmenný prostor vedle #h- #z- #d- #r- #s-.
// Kodek je záměrně přísný: parsuje se JEN kanonický tvar, nikdy se nehádá
// (resolver disciplína — raději 404 než tichá domněnka).
//
// Čistý modul bez server importů: sdílí ho route handler, derivace,
// klientské komponenty i testy.

/** „586/1992" → „586-1992"; null pro cokoli mimo kanonický tvar č./rok. */
export function statuteSlug(ref: string): string | null {
  const m = /^(\d{1,4})\/(\d{4})$/.exec(ref);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** „586-1992" → „586/1992"; null pro nekanonický slug (→ notFound, ne domněnka). */
export function parseStatuteSlug(slug: string): string | null {
  const m = /^(\d{1,4})-(\d{4})$/.exec(slug);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Id uzlu předpisu v grafu: „586/1992" → „law:sb:586-1992"; null pro ref mimo
 * kanonický tvar č./rok.
 *
 * Bydlí TADY, a ne u claimů nebo v loaderu, protože uzel a veřejná adresa
 * předpisu sdílejí JEDEN tvar („586-1992"). Druhý parser téhož tvaru by se
 * rozešel při první změně kanonizace — a rozešel by se tiše, protože obě
 * podoby by pořád vypadaly správně (memory/ico-node-id-canonical-form.md je
 * týž případ na straně IČO).
 */
export function lawNodeId(ref: string): string | null {
  const slug = statuteSlug(ref);
  return slug === null ? null : `law:sb:${slug}`;
}

/** Inverze `lawNodeId`: „law:sb:586-1992" → „586/1992". Null pro cokoli jiného
 *  — včetně nekanonického slugu za prefixem (raději žádná adresa než domněnka). */
export function refFromLawNodeId(id: string): string | null {
  const m = /^law:sb:(.+)$/.exec(id);
  return m === null ? null : parseStatuteSlug(m[1]);
}

/** Klíč rezidua pro fragmenty, které nezačínají „§ …" (přílohy, nadpisy částí).
 *  Skupina se poctivě jmenuje „mimo §", nic se nedomýšlí. */
export const NON_PARAGRAPH_KEY = "ostatni";

/**
 * Doslovný e-Sbírka fragment → klíč paragrafu nejvyšší úrovně:
 * „§ 35ba odst. 1 písm. b)" → „35ba", „§ 88" → „88".
 * Fragment bez „§ …" hlavy padá do NON_PARAGRAPH_KEY.
 */
export function paragraphKeyOf(fragment: string): string {
  const m = /^§\s*(\d+[a-zA-Z]*)/.exec(fragment.trim());
  return m ? m[1].toLowerCase() : NON_PARAGRAPH_KEY;
}

/** Klíč paragrafu → id kotvy na stránce předpisu: „35ba" → „p-35ba". */
export function paragraphAnchor(key: string): string {
  const safe = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `p-${safe.length > 0 ? safe : NON_PARAGRAPH_KEY}`;
}

/** Lidský štítek skupiny: „§ 35ba", resp. „mimo §" pro reziduum. */
export function paragraphLabel(key: string): string {
  return key === NON_PARAGRAPH_KEY ? "mimo §" : `§ ${key}`;
}
