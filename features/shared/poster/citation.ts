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

/** Stav původu výpočtu nad CELÝM souborem, ze kterého arch čerpá — týž slovník
 *  jako `ContributionProvenance.state`, jen bez importu z feature (modul je
 *  sdílený primitiv a nesmí viset na jedné ploše). */
export type PosterProvenanceState = "uniform" | "mixed" | "absent";

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
  /**
   * Shodne-li se CELÝ soubor, ze kterého arch čerpá, na jednom původu výpočtu.
   * Zrcadlí `ContributionProvenance.state` (features/civicscore/provenance.ts):
   * `uniform` = jedna dvojice {pass, ref} na všech uzlech, `mixed` = víc verzí
   * (poloviční přepočet), `absent` = záznam o původu chybí. Vynecháno = volající
   * o tom nic netvrdí a patička se chová jako dosud.
   */
  provenanceState?: PosterProvenanceState | null;
  /** Kolik různých kombinací pasu a metodiky soubor nese (má smysl jen u `mixed`). */
  provenanceVariants?: number | null;
  /**
   * Linie formule, kterou nesou DATA, když se liší od té, kterou dnes deklaruje kód
   * (lib/analysis/contribution.ts CONTRIBUTION_FORMULA_REF). Vytištěný arch je archivní
   * dokument — nesmí tvrdit metodiku, podle které jeho čísla nevznikla. `null`/vynecháno
   * = data i kód se shodují a patička o tom mlčí.
   */
  formulaMismatch?: { storedRef: string; declaredRef: string } | null;
}

/** Hotové řádky patičky, v pořadí, v jakém se sázejí.
 *
 *  DVOJJAZYČNOST (2026-08-05): sazbu řádků dnes vlastní PosterFrame, který je
 *  skládá z katalogu `shared.poster.*` nad STRUKTUROVANÝMI poli níže — tenhle
 *  modul zůstává čistý (žádné i18n importy). České `*Line` řádky se dál
 *  odvozují beze změny kvůli zpětné kompatibilitě (a jako pinned tvar
 *  v citation.test.ts), ale nová sazba je nečte. */
export interface PosterCitation {
  sourceLine: string;
  retrievedLine: string;
  methodologyLine: string;
  liveLine: string;
  /** URL bez protokolu a koncového lomítka — pro sazbu i aria popisky. */
  displayUrl: string;
  /** Strukturovaná pole — komponenta z nich sází přes katalog `shared.poster.*`. */
  source: string;
  /** ISO datum (YYYY-MM-DD) — formátuje až sazba podle aktivního locale. */
  retrievedAt: string;
  methodology: string;
  /**
   * Výpočetní pas jako číslo; null = záznam ho nenese a nic se nedomýšlí.
   * Null i tehdy, když se soubor na jednom původu NESHODNE (`mixed`/`absent`) —
   * jistota, kterou data nemají, se z archu nevytiskne ani na přání volajícího.
   */
  pass: number | null;
  mismatch: { storedRef: string; declaredRef: string } | null;
}

/** „https://politicas.cz/zebricek/" → „politicas.cz/zebricek".
 *  Protokol je na papíře šum; koncové lomítko je typografická vata. */
export function posterDisplayUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/\/+$/, "");
}

/**
 * Věta, kterou patička řekne MÍSTO čísla pasu, když se soubor na jednom původu
 * výpočtu neshodne — nebo null, když se shodne (a číslo pasu tedy platí).
 *
 * Proč to není mlčení: dosud arch prostě žádný pas nevytiskl (loader ho u
 * nejednotné komory posílá jako null), takže vytištěná citace vypadala stejně
 * jako u záznamu, který pas nenese — mlčení nerozliší „nevíme" od „neshodneme
 * se". Archivní dokument musí umět říct obojí.
 *
 * Věta se připojuje k METODICE, protože pas je součástí řádku metodiky
 * (PosterFrame skládá `metodika · výpočetní pas N · rozpor linie`), a protože
 * arch sází strukturovaná pole přes katalog — nová věta by jinak potřebovala
 * vlastní klíč a nikdo by ji nevytiskl. Čeština je tu záměrná: `methodology`
 * je český řetězec skládaný volajícím (viz krajCitationInput) v obou jazycích.
 */
export function posterProvenanceNote(
  state: PosterProvenanceState | null | undefined,
  variants?: number | null,
): string | null {
  if (state === "mixed") {
    const n =
      typeof variants === "number" && Number.isFinite(variants) && variants > 1
        ? `${czechInt(variants)} různých kombinací`
        : "víc různých kombinací";
    return `POZOR: čísla nespočítal jeden a týž průchod — záznam nese ${n} pasu a metodiky, jediné číslo pasu proto tento arch neuvádí`;
  }
  if (state === "absent")
    return "POZOR: záznam o původu výpočtu chybí — kterou verzí metodiky čísla vznikla, nelze doložit";
  return null;
}

export function buildPosterCitation(input: PosterCitationInput): PosterCitation {
  const displayUrl = posterDisplayUrl(input.sourceUrl);
  // Nejednotný (ani chybějící) původ výpočtu ruší číslo pasu strukturálně — ne
  // proto, že by ho volající neposlal, ale proto, že žádné jedno číslo neplatí.
  const provenanceNote = posterProvenanceNote(input.provenanceState, input.provenanceVariants);
  const passValue =
    provenanceNote === null &&
    typeof input.provenancePass === "number" &&
    Number.isFinite(input.provenancePass)
      ? input.provenancePass
      : null;
  const methodology =
    provenanceNote === null ? input.methodology : `${input.methodology} · ${provenanceNote}`;
  const pass = passValue !== null ? ` · výpočetní pas ${czechInt(passValue)}` : "";
  const mismatch = input.formulaMismatch
    ? ` · POZOR: čísla spočítala starší linie metodiky „${input.formulaMismatch.storedRef}“, kód dnes deklaruje „${input.formulaMismatch.declaredRef}“`
    : "";
  return {
    sourceLine: `zdroj: ${input.sourceLabel}`,
    retrievedLine: `stav dat ke dni ${czechDate(input.retrievedAt)} — plakát je datovaný otisk, čísla se v čase mění`,
    methodologyLine: `metodika: ${methodology}${pass}${mismatch}`,
    liveLine: `živá verze: ${displayUrl}`,
    displayUrl,
    source: input.sourceLabel,
    retrievedAt: input.retrievedAt,
    methodology,
    pass: passValue,
    mismatch: input.formulaMismatch ?? null,
  };
}
