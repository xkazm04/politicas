"use client";

/*
 * DAŇOVÁ ZÁKLADNA U ČÍSLA — jedna sazba pro celou peněžní plochu.
 *
 * Registr smluv zveřejňuje hodnotu smlouvy ve dvou základnách (bez DPH / včetně
 * DPH) a jako sčitatelné je nepublikuje; sklizeň je do jednoho pole složí, ale
 * ZAPÍŠE, kterou použila. Do 2026-08-13 to nečetla žádná plocha, takže každý
 * korunový součet o jmenovaném poslanci nebo firmě obě základny tiše míchal.
 *
 * Tenhle soubor je jediná sazba toho přiznání, aby čtyři plochy (kniha vazeb,
 * spis poslance, spis firmy, oddíl Peníze na spisu) neřekly o téže vlastnosti
 * čtyři různé věty. NIC SE TU NEPOČÍTÁ ani nepřepočítává: `BasisComposition`
 * přichází hotové z čisté projekce (`features/money/amountBasis.ts`).
 *
 * PROČ `SourceNote`: věta nese POČTY, a počet je číslo — brand rule váže citaci
 * na čísla. Zdroj je pole `amountBasis`, které sklizeň registru zapsala na hranu.
 */

import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import {
  BASIS_TAG_KEYS,
  basisSentences,
  type AmountBasis,
  type BasisComposition,
} from "../amountBasis";

/**
 * Základna U JEDNOHO smluvního řádku. Text, ne barva: „bez DPH" a „s DPH" se
 * musí dát přečíst i vytisknout, a odstín by to tvrzení neunesl.
 */
export function BasisTag({ basis, className = "" }: { basis: AmountBasis; className?: string }) {
  const t = useTranslations("money.basis");
  return (
    <span
      className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-steel-aa ${className}`}
    >
      <span className="sr-only">{t("tagLabel")}: </span>
      {t(BASIS_TAG_KEYS[basis])}
    </span>
  );
}

/**
 * Složení základen ZA JEDNÍM SOUČTEM. Čtyři možné stavy a žádný pátý:
 *
 *   • míchaný součet   — obě DPH základny; věta to říká nahlas a NEOPRAVUJE nic
 *                        (sazba DPH v grafu není, přepočet by byl vymyšlené číslo),
 *   • jedna základna   — všechny započtené řádky ji sdílí,
 *   • žádná DPH strana — započtené řádky nestojí ani na jedné (cizí měna, chybějící
 *                        hodnota, hrana bez zapsané základny),
 *   • nic započteno    — nevykreslí se vůbec: prázdná věta o prázdném součtu.
 *
 * Řádky mimo DPH rozdělení se přiznávají VŽDY zvlášť — nikdy se nepřičtou k jedné
 * ze stran, aby tvrzení o sčitatelnosti nenafoukly.
 */
export function BasisNote({
  basis,
  className = "mt-2 !text-[10px]",
  withRule = false,
}: {
  basis: BasisComposition;
  className?: string;
  /** Přidá větu o TOM, PROČ se to vypisuje — na ploše jednou, ne u každého řádku. */
  withRule?: boolean;
}) {
  const t = useTranslations("money.basis");
  const f = useFormat();
  const sentences = basisSentences(basis);
  if (sentences.length === 0) return null;

  return (
    <SourceNote className={className}>
      {sentences.map((s, i) => (
        <span key={s.key}>
          {i > 0 ? " " : ""}
          {s.key === "mixed"
            ? t(s.key, {
                bez: s.bez,
                bezFmt: f.int(s.bez),
                vcetne: s.vcetne,
                vcetneFmt: f.int(s.vcetne),
              })
            : t(s.key, { count: s.count, countFmt: f.int(s.count) })}
        </span>
      ))}
      {withRule && <> {t("rule")}</>}
    </SourceNote>
  );
}
