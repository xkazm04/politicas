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

/** Jedna přiznaná mez: klíč do `denik.*` a už zformátovaná čísla. */
export interface DenikLimitNote {
  key: string;
  values: Record<string, string>;
}

export function limitNotes(
  limits: DenikLimits,
  ledger: DenikLedger | null,
  locale: Locale,
): DenikLimitNote[] {
  const int = (n: number) => formatInt(n, locale);
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
      values: { n: int(limits.companiesEdgeTruncated), cap: int(limits.edgeCap) },
    });
  }
  if (limits.malformedIco > 0) {
    notes.push({ key: "limits.malformedIco", values: { n: int(limits.malformedIco) } });
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
    notes.push({ key: "limits.changesUndisplayable", values: { n: int(limits.changesUndisplayable) } });
  }
  if (limits.changesFromGate > 0) {
    notes.push({ key: "limits.changesFromGate", values: { n: int(limits.changesFromGate) } });
  }
  if (ledger && ledger.mergedContractRows > 0) {
    notes.push({ key: "limits.mergedContractRows", values: { n: int(ledger.mergedContractRows) } });
  }
  if (ledger && ledger.contractAmountConflicts > 0) {
    notes.push({
      key: "limits.contractAmountConflicts",
      values: { n: int(ledger.contractAmountConflicts) },
    });
  }
  return notes;
}
