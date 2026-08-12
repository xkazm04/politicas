/**
 * MEZE ČTENÍ, VYPSANÉ VĚTOU — čistá projekce `DenikLimits` (a dvou počítadel
 * ledgeru) na seznam klíčů katalogu a spočítaných hodnot.
 *
 * Pravidlo je precedens `droppedImplausible`: co se ztratí, se VYHODÍ, SPOČÍTÁ
 * a počet se vypíše. Věta se ukáže jen tehdy, když se mez SKUTEČNĚ dotkla dat —
 * nulová mez je pojistka, ne sdělení.
 *
 * Proč vlastní modul (2026-08-12): do téhle chvíle to byla privátní funkce
 * uvnitř `DenikPage.tsx`, tedy jediné místo produktu, kde se rozhoduje, jestli
 * se useknuté čtení přizná — a nešlo ho přibít testem, aniž by se do vitestu
 * tahal celý strom komponent. Deník přitom tou dobou přidával dvě meze, které
 * jsou nefalzifikovatelné právě tím, že mlčí: strop lidské brány (repozitář
 * `listReviewAudit` sám varuje, že useknuté čtení „publikuje špatné číslo") a
 * strop proudu „zaznamenáno" (čte se od NEJNOVĚJŠÍCH, takže useknutí ukusuje
 * nejstarší historii). Text vět žije v katalogu; tenhle modul skládá jen klíče.
 */

import { formatInt } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { DenikLedger } from "./deriveDenik";
import type { DenikLimits } from "./getDenikData";

/**
 * Jedna přiznaná mez: klíč do `denik.*` a jeho hodnoty.
 *
 * ČÍSLO SE PŘEDÁVÁ DVAKRÁT (2026-08-12), a je to záměr, ne duplicita: věta se
 * shoduje s číslovkou přes ICU plurál, který VYBÍRÁ podle syrového čísla
 * (`n`), zatímco čtenář musí vidět číslo zformátované po česku (`nFmt`,
 * lib/format — jediné místo, kde se sází oddělovač tisíců). Kdyby se do
 * plurálu poslal řetězec „1 234", `Intl.PluralRules` z něj udělá NaN a věta
 * spadne navždy do větve `other`. Týž vzor drží celý katalog (`{count, plural,
 * one {{countFmt} …}}` v /penize, spisu i /zakony).
 */
export interface DenikLimitNote {
  key: string;
  values: Record<string, string | number>;
}

export function limitNotes(
  limits: DenikLimits,
  ledger: DenikLedger | null,
  locale: Locale,
): DenikLimitNote[] {
  const int = (n: number) => formatInt(n, locale);
  /** Počítaná mez: syrové číslo pro shodu s číslovkou, zformátované pro oči. */
  const counted = (n: number) => ({ n, nFmt: int(n) });
  const notes: DenikLimitNote[] = [];
  if (limits.companiesOverCap > 0) {
    notes.push({
      key: "limits.companiesOverCap",
      values: { cap: int(limits.companyCap), n: int(limits.companiesOverCap) },
    });
  }
  if (limits.companiesEdgeTruncated > 0) {
    notes.push({
      key: "limits.companiesEdgeTruncated",
      values: { ...counted(limits.companiesEdgeTruncated), cap: int(limits.edgeCap) },
    });
  }
  if (limits.malformedIco > 0) {
    notes.push({ key: "limits.malformedIco", values: counted(limits.malformedIco) });
  }
  // Strop lidské brány: `auditRows` v citaci zdroje je pak SPODNÍ MEZ, ne počet
  // rozhodnutí — a je to jediné číslo, které /denik i /dukazy o bráně tisknou.
  if (limits.auditTruncated) {
    notes.push({ key: "limits.auditTruncated", values: { cap: int(limits.auditCap) } });
  }
  // Strop proudu záznamu grafu. Čtení je řazené od nejnovějších, takže useknutí
  // není náhodné: ztrácí se systematicky NEJSTARŠÍ události.
  if (limits.changesTruncated) {
    notes.push({
      key: "limits.changesTruncated",
      values: { cap: int(limits.changeCap), n: int(limits.changesRead) },
    });
  }
  if (limits.changesUndisplayable > 0) {
    notes.push({ key: "limits.changesUndisplayable", values: counted(limits.changesUndisplayable) });
  }
  if (limits.changesFromGate > 0) {
    notes.push({ key: "limits.changesFromGate", values: counted(limits.changesFromGate) });
  }
  if (ledger && ledger.mergedContractRows > 0) {
    notes.push({ key: "limits.mergedContractRows", values: counted(ledger.mergedContractRows) });
  }
  if (ledger && ledger.contractAmountConflicts > 0) {
    notes.push({
      key: "limits.contractAmountConflicts",
      values: counted(ledger.contractAmountConflicts),
    });
  }
  return notes;
}
