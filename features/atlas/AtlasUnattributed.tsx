/*
 * ŘÁDKY GRAFU BEZ PŘIZNANÉHO VYDAVATELE (/atlas, 2026-09-04).
 *
 * PROČ EXISTUJE. Když kg_node/kg_edge dostaly sloupec `source`, dala se položit
 * otázka, která do té doby položit nešla: kolik řádků grafu se k žádnému
 * deklarovanému zdroji nehlásí. Odpověď je číslo, a to číslo se tiskne.
 *
 * PROČ TO NENÍ KARTA. „unknown" není vydavatel. Karta o něm by měla čtyři
 * dimenze, souhrnné skóre a řadila by se mezi psp-poslanci a smlouvy-gov-cz —
 * a tvrdila by tím, že existuje zdroj toho jména. Neexistuje. Je to počet
 * řádků, o kterých migrace poctivě říká, že jejich původ zrekonstruovat neumí.
 *
 * DVĚ ČÍSLA, DVĚ RŮZNÉ PRAVDY, a splynout nesmějí:
 *  · „nedohledáno" (`unknown`) — migrace řádek MINULA a původ se z toho, co
 *    nese, rekonstruovat nedal. Číslo ke splácení: doběhne-li zapisovač, který
 *    ten řádek vlastní, přepíše ho skutečným zdrojem.
 *  · „neorazítkováno" — migrace k řádku ještě nedošla. To není výpověď o
 *    původu, ale o postupu migrace.
 * Sečíst je do jednoho „chybí původ" by zamlčelo, které z nich je práce a
 * které přiznání.
 */

import { useTranslations } from "next-intl";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { formatInt } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { AtlasUnattributed as AtlasUnattributedFacts } from "@/lib/analysis/atlas";

export default function AtlasUnattributed({
  facts,
  index,
  locale,
}: {
  facts: AtlasUnattributedFacts;
  /** Číslo sekce — odvozuje se z toho, co se skutečně vykreslilo (AtlasPage). */
  index: number;
  locale: Locale;
}) {
  const t = useTranslations("atlas");
  // Prázdný rozpad = graf o sobě nic neříká (nečitelný store). Nula řádků je
  // naopak REGULÉRNÍ výsledek a tiskne se — „každý řádek se k něčemu hlásí".
  if (facts.byEntity.length === 0) return null;

  return (
    <section className="mt-14 border-t-4 border-ink pt-10">
      <SectionHeading
        index={index}
        title={t("unattributed.title")}
        aside={<SourceNote>{t("unattributed.aside")}</SourceNote>}
      />
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
        {t("unattributed.lead", {
          unknown: formatInt(facts.unknownRows, locale),
          unstamped: formatInt(facts.unstampedRows, locale),
        })}
      </p>

      <ul className="mt-6 border-t-2 border-ink">
        {facts.byEntity.map((e) => (
          <li
            key={e.entity}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-hairline py-2"
          >
            {/* Jméno tabulky je STROJOVÝ identifikátor — doslova, dohledatelně. */}
            <span className="font-mono text-sm font-black">{e.entity}</span>
            <span className="font-mono text-xs text-steel-aa">
              {t("unattributed.row", {
                unknown: formatInt(e.unknownRows, locale),
                unstamped: formatInt(e.unstampedRows, locale),
              })}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <SourceNote>{t("unattributed.source")}</SourceNote>
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-steel-aa">{t("unattributed.note")}</p>
    </section>
  );
}
