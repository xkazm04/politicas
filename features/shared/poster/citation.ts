// Archivní citační patička plakátu — ČISTÁ derivace (žádný React, žádný I/O).
//
// Plakát je datovaný otisk živých dat: každý vytištěný arch musí říct, ODKUD
// čísla jsou, KE KTERÉMU DNI platí, PODLE JAKÉ metodiky vznikla a KDE žije
// jejich aktuální verze. Tohle je jediné místo, kde se ty čtyři řádky skládají
// — PosterFrame je sází, feature je nikdy neskládá ručně (stejný princip jako
// SourceNote: kanonický tvar citace bydlí v kódu, ne v úsudku volajícího).
//
// Datum jde přes lib/format (deterministicky, bez Intl — viz tamní hlavička);
// nevalidní vstup se propíše jako „—", nikdy jako „NaN. NaN. NaN".

import { czechDate, czechInt } from "@/lib/format";

export interface PosterCitationInput {
  /** Odkud data jsou, včetně kadence — „psp.cz — hlasování, tisky, členství". */
  sourceLabel: string;
  /** Živá verze plochy, plná URL — na plakátě se sází bez protokolu. */
  sourceUrl: string;
  /** ISO datum (YYYY-MM-DD), ke kterému dni čísla platí. */
  retrievedAt: string;
  /** Jednořádkové shrnutí metodiky — „index přispění, šest vážených složek…". */
  methodology: string;
  /** Výpočetní pas, který čísla autorizoval (contribution_provenance.pass). */
  provenancePass?: number | null;
}

/** Hotové řádky patičky, v pořadí, v jakém se sázejí. */
export interface PosterCitation {
  sourceLine: string;
  retrievedLine: string;
  methodologyLine: string;
  liveLine: string;
  /** URL bez protokolu a koncového lomítka — pro sazbu i aria popisky. */
  displayUrl: string;
}

/** „https://politicas.cz/zebricek/" → „politicas.cz/zebricek".
 *  Protokol je na papíře šum; koncové lomítko je typografická vata. */
export function posterDisplayUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/\/+$/, "");
}

export function buildPosterCitation(input: PosterCitationInput): PosterCitation {
  const displayUrl = posterDisplayUrl(input.sourceUrl);
  const pass =
    typeof input.provenancePass === "number" && Number.isFinite(input.provenancePass)
      ? ` · výpočetní pas ${czechInt(input.provenancePass)}`
      : "";
  return {
    sourceLine: `zdroj: ${input.sourceLabel}`,
    retrievedLine: `stav dat ke dni ${czechDate(input.retrievedAt)} — plakát je datovaný otisk, čísla se v čase mění`,
    methodologyLine: `metodika: ${input.methodology}${pass}`,
    liveLine: `živá verze: ${displayUrl}`,
    displayUrl,
  };
}
