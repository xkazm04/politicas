/**
 * CO TENHLE VĚSTNÍK NENESE — čistá projekce `DukazyLimits` na klíče katalogu.
 *
 * Deník důkazů měl do 2026-08-13 v prázdném stavu absolutní větu „zdroj:
 * review_audit — 0 řádků; žádný záznam není zamlčen" — a jeho vlastní požadavek
 * ji vyvracel: loader přečte VŠECHNY uzly tisků a `deriveEvidenceFeed` z nich
 * publikuje jen ty, které lidská brána podepsala. Na dnešním korpusu to je
 * **141 posudků ve stavu `pending_review`**, zahozených bez jediného počítadla.
 * Čtenář se tak dozvěděl, že věstník je prázdný a že se nic nezadržuje, zatímco
 * pravda byla, že je to FRONTA U BRÁNY.
 *
 * Pravidla (precedens features/denik/limitNotes.ts):
 *   • Mez, která se dat nedotkla, MLČÍ — nulová pojistka není sdělení.
 *   • Číslo se předává DVAKRÁT: syrové `n` vybírá větev ICU plurálu (formátovaný
 *     řetězec by z `Intl.PluralRules` udělal NaN a věta by spadla navždy do
 *     `other`), `nFmt` se čte očima.
 *   • Nečitelná vrstva je jiné tvrzení než prázdná vrstva. Selhalo-li čtení,
 *     věta jmenuje, KTERÁ věrnost se ztratila — ne že „nic není".
 *   • „Nic se nezadržuje" je ODVOZENÝ závěr, ne literál: vysloví se jen tehdy,
 *     když se všechny tři vrstvy přečetly, strop nenarazil a fronta je prázdná.
 *
 * Strop odečtu brány se tu ZÁMĚRNĚ neopakuje — plocha ho vypisuje přímo u
 * čísla (`section.sourceFloor`), a dvě věty o jedné mezi čtou jako dvě meze.
 * Strojová podoba téhož má vlastní skladač (`./feedNotes.ts`).
 */

import { formatInt } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { DukazyLimits } from "./getDukazyData";

export interface DukazyLimitNote {
  key: string;
  values: Record<string, string | number>;
}

/** Přečetly se všechny tři vrstvy, na které se plocha odvolává? */
export const allLayersRead = (l: DukazyLimits): boolean =>
  l.forensicRead && l.tieSourcesRead && l.labelsRead;

export function dukazyLimitNotes(limits: DukazyLimits, locale: Locale): DukazyLimitNote[] {
  const int = (n: number) => formatInt(n, locale);
  const notes: DukazyLimitNote[] = [];

  // Fronta u brány. Stavy se vypisují VERBATIM (precedens tieFlags.ts): token
  // grafu se nepřekládá do hezčího slova, jen se označí jako token.
  if (limits.withheld.total > 0) {
    notes.push({
      key: "limits.withheld",
      values: {
        n: limits.withheld.total,
        nFmt: int(limits.withheld.total),
        states: limits.withheld.byState.map((s) => `${s.state} — ${int(s.count)}`).join(" · "),
      },
    });
  }

  // Tři degradace, které se do 2026-08-13 odehrávaly potichu. Každá říká, KTERÁ
  // věrnost zmizela — ne že by data neexistovala.
  if (!limits.forensicRead) notes.push({ key: "limits.forensicUnread", values: {} });
  if (!limits.tieSourcesRead) notes.push({ key: "limits.tieSourcesUnread", values: {} });
  if (!limits.labelsRead) notes.push({ key: "limits.labelsUnread", values: {} });

  // Absolutní věta jen tam, kde ji data unesou.
  if (limits.withheld.total === 0 && !limits.auditTruncated && allLayersRead(limits)) {
    notes.push({ key: "limits.nothingWithheld", values: {} });
  }
  return notes;
}
