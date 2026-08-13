/**
 * UPOZORNĚNÍ V POPISU KANÁLU VĚSTNÍKU BRÁNY.
 *
 * Obě routy `/dukazy/feed.*` si `auditTruncated` spočítaly a ZAHODILY, zatímco
 * `FEED_DESCRIPTION` tvrdil „každé rozhodnutí revizora … a každý podepsaný
 * forenzní posudek" — absolutní věta nad čtením s tvrdým stropem 10 000 řádků.
 * Sesterský Deník republiky přitom o TÉMŽE odečtu odběratele informuje
 * (features/denik/feedNotes.ts): jeho feed uměl říct, že se čtení lidské brány
 * zastavilo na stropu, a feed brány samotné ne.
 *
 * SDÍLENÁ VĚTA SE SDÍLÍ, NEPÍŠE SE PODRUHÉ. Klauzuli o stropu brány skládá
 * `denikFeedNotice()` — týž strop, týž odečet, táž ztráta — a tenhle modul jen
 * dodává klauzule, které /dukazy má navíc a /denik pro ně nemá pole.
 *
 * ADAPTÉR JE ZÁMĚRNÝ A NEPÍŠE ŽÁDNÉ TVRZENÍ. `denikFeedNotice` bere celý
 * `DenikLimits`; /dukazy z těch měřidel provozuje jediné (strop brány), takže
 * ostatní pole jdou dovnitř jako nuly. Nula tam znamená „tenhle výpis o té mezi
 * nic netvrdí" a `denikFeedNotice` z nuly ŽÁDNOU větu nesloží — vzniknout může
 * výhradně klauzule o stropu brány (připíchnuto testem). Kdyby `DenikLimits`
 * narostl o pole, tenhle literál přestane kompilovat a někdo o něm musí
 * rozhodnout — což je přesně ta pojistka, kterou tichý cast nemá.
 *
 * ČEŠTINA NATVRDO JE ZDE ZÁMĚR, jako u sesterského modulu: feed je jednojazyčný
 * artefakt a mluví brankovanou češtinou stejně jako `entrySummaryCs`. Čtenářské
 * verze týchž vět žijí v katalogu pod `dukazy.limits.*` a sází je plocha
 * (`./limitNotes.ts`).
 */

import { denikFeedNotice } from "@/features/denik/feedNotes";
import type { DenikLimits } from "@/features/denik/getDenikData";
import { formatInt } from "@/lib/format";
import type { DukazyLimits } from "./getDukazyData";

const int = (n: number) => formatInt(n, "cs");

/** Měřidla deníku vyplněná tím JEDINÝM, které /dukazy skutečně provozuje. Viz
 *  hlavička: nula = žádné tvrzení, a `denikFeedNotice` z ní nic nesloží. */
function asDenikLimits(l: DukazyLimits): DenikLimits {
  return {
    contractCompanies: 0,
    companyCap: 0,
    companiesOverCap: 0,
    edgeCap: 0,
    companiesEdgeTruncated: 0,
    malformedIco: 0,
    changesFromGate: 0,
    changesUndisplayable: 0,
    auditCap: l.auditCap,
    auditTruncated: l.auditTruncated,
    changeCap: 0,
    changesRead: 0,
    changesTruncated: false,
  };
}

/** Klauzule, které nese jen věstník brány — fronta posudků a tři degradace. */
function dukazyClauses(l: DukazyLimits): string[] {
  const out: string[] = [];
  if (l.withheld.total > 0) {
    const states = l.withheld.byState.map((s) => `${s.state} — ${int(s.count)}`).join(" · ");
    out.push(
      `${int(l.withheld.total)} forenzních posudků lidskou branou zatím neprošlo (${states}), takže je tenhle výpis nenese`,
    );
  }
  if (!l.forensicRead) {
    out.push(
      "vrstvu podepsaných posudků (kg_node bill.forensic_*) se přečíst nepodařilo — podepsaný posudek může existovat a tenhle výpis o něm neví",
    );
  }
  if (!l.tieSourcesRead) {
    out.push(
      "provenienci vazeb (kg_edge linked_to) se přečíst nepodařilo — citace u záznamů jmenují jen tabulky, ne původní zdroj",
    );
  }
  if (!l.labelsRead) {
    out.push("jména obou konců vazby se přečíst nepodařilo — záznamy jmenují uzly grafu urnami");
  }
  return out;
}

/**
 * Jedna nebo dvě věty, nebo `null`. Mlčení znamená „nic se neztratilo" — a je to
 * odvozený závěr: vysloví se jen tehdy, když strop nenarazil, fronta je prázdná
 * a všechny tři vrstvy se přečetly.
 */
export function dukazyFeedNotice(limits: DukazyLimits): string | null {
  const shared = denikFeedNotice(null, asDenikLimits(limits));
  const own = dukazyClauses(limits);
  const mine = own.length > 0 ? `Tenhle výpis dál nenese: ${own.join("; ")}.` : null;
  const both = [shared, mine].filter((s): s is string => s !== null);
  if (both.length === 0) return null;
  return both.join(" ");
}
