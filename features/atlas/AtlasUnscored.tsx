/*
 * ZDROJE MIMO DOSAH ATLASU (/atlas, 2026-08-13).
 *
 * PROČ EXISTUJE. Atlas hodnotil tři zdroje. Platforma jich čte dvanáct. Devět
 * z nich se na svou vlastní stránku kvality nikdy nedostalo — mezi nimi OBA,
 * které nesou celé /penize (registr smluv a bulk ISVR z dataor.justice.cz).
 * Čtenář, který si přišel ověřit kvalitu dat pod modulem jmenujícím firmy,
 * smlouvy a poslance, nenašel ani řádek — a stránka tím mlčky tvrdila, že
 * platforma má tři zdroje.
 *
 * CO TAHLE SEKCE JE A CO NENÍ. Není to devět dalších karet. Zdroj tady nedostane
 * ŽÁDNÉ číslo — dostane větu, kam jeho řádky dopadají a proč to atlas neumí
 * změřit. Rozdíl je podstatný: karta se čtyřmi „nehodnoceno“ by u řádku
 * `smlouvy-gov-cz` tvrdila „zdroj nemá ve store žádné řádky“, což je NEPRAVDA
 * (těch řádků je přes 150 tisíc, jen dopadají do kg_node/kg_edge, kde k nim
 * nevede měřitelná vazba). Skóre, které nemá podklad, se nevyrábí; mez se
 * pojmenuje.
 *
 * DŮVOD JE FAKT O NAŠÍ ROUŘE. Věty (`atlas.unscored.reason.*`, svázané bajtově
 * s UNSCORED_REASONS) mluví o tom, co neumí naše ukládání — ne o tom, co
 * nezveřejňuje vydavatel. Ta dvě tvrzení se nesmějí splést.
 *
 * SEKCE SE VYKRESLÍ I PŘI NEČITELNÉM ÚLOŽIŠTI: seznam je deklarace v kódu, ne
 * měření, takže výpadek store o něm nic nemění (viz AtlasPage).
 */

import { useTranslations } from "next-intl";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { formatInt } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import {
  INGESTED_SOURCES,
  UNSCORED_REASON_KEYS,
  type AtlasUnscorableLanding,
  type AtlasUnscoredSource,
} from "@/lib/analysis/atlas";

/** Strojová krajina z atlasu → klíč katalogu (vzor STALENESS_KEYS v AtlasCards). */
const LANDING_LABEL_KEYS: Record<AtlasUnscorableLanding, string> = {
  graph: "unscored.landing.graph",
  "generated-module": "unscored.landing.generatedModule",
  none: "unscored.landing.none",
};

/** Skupiny v pořadí, v jakém je nese registr — ne podle počtu (to by byl žebříček). */
function groupByLanding(
  sources: readonly AtlasUnscoredSource[],
): Array<{ landing: AtlasUnscorableLanding; sources: AtlasUnscoredSource[] }> {
  const order: AtlasUnscorableLanding[] = ["graph", "generated-module", "none"];
  return order
    .map((landing) => ({ landing, sources: sources.filter((s) => s.landing === landing) }))
    .filter((g) => g.sources.length > 0);
}

export default function AtlasUnscored({
  unscored,
  index,
  locale,
}: {
  unscored: readonly AtlasUnscoredSource[];
  /** Číslo sekce — odvozuje se z toho, co se skutečně vykreslilo (AtlasPage). */
  index: number;
  locale: Locale;
}) {
  const t = useTranslations("atlas");
  if (unscored.length === 0) return null;
  const groups = groupByLanding(unscored);
  const declared = INGESTED_SOURCES.length;

  return (
    <section className="mt-14 border-t-4 border-ink pt-10">
      <SectionHeading
        index={index}
        title={t("unscored.title")}
        aside={<SourceNote>{t("unscored.aside")}</SourceNote>}
      />
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
        {t("unscored.lead", {
          unscored: formatInt(unscored.length, locale),
          declared: formatInt(declared, locale),
          scored: formatInt(declared - unscored.length, locale),
        })}
      </p>

      <div className="mt-8 space-y-6">
        {groups.map((group) => (
          <div key={group.landing} className="border-2 border-ink bg-paper p-4">
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest">
              {t(LANDING_LABEL_KEYS[group.landing])}
            </h3>
            {/* Důvod — věta o NAŠÍ rouře, ne o vydavateli. */}
            <p className="mt-2 border-l-2 border-hairline pl-2 text-xs leading-relaxed text-steel-aa">
              {t(UNSCORED_REASON_KEYS[group.landing])}
            </p>
            <ul className="mt-3 border-t border-hairline">
              {group.sources.map((s) => (
                <li
                  key={s.source}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-hairline py-2"
                >
                  {/* Klíč i modul jsou STROJOVÉ identifikátory — doslova, bez
                      verzálkové transformace, aby zůstaly dohledatelné. */}
                  <span className="font-mono text-sm font-black">{s.source}</span>
                  <span className="font-mono text-xs text-steel-aa">{s.adapter}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <SourceNote>{t("unscored.source")}</SourceNote>
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-steel-aa">{t("unscored.scopeNote")}</p>
    </section>
  );
}
