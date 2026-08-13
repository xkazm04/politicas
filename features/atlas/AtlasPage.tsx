/*
 * Atlas kvality otevřených dat (/atlas, batch-6 item 6D) — publikovaná skóre
 * kvality per zdroj, každé s vytištěným pravidlem. Institucionální paměť
 * o českých otevřených datech (kontexty zdrojů, přiznané mezery, kadence,
 * Merkle pečetě) se stává veřejnou stránkou; strojová podoba /atlas/atlas.json.
 *
 * Serverová obálka — interaktivní je jen řazení karet (AtlasCards).
 * COPY JE V KATALOGU (2026-08-05): čtenářské věty žijí v messages/{cs,en}.json
 * pod `atlas.*` a sází se přes next-intl (vzor /overeni). Strojový report
 * (atlas.json) zůstává beze změny — pravidla v něm nese lib/analysis/atlas.ts.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { formatInt } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import {
  STALE_CADENCE_MULTIPLIER,
  ZERO_CADENCE_MULTIPLIER,
  unscoredSources,
  type AtlasReport,
} from "@/lib/analysis/atlas";
import AtlasCards from "./AtlasCards";
import AtlasUnscored from "./AtlasUnscored";

function StoreDownState() {
  const t = useTranslations("atlas");
  return (
    <div className="mt-8 border-2 border-dashed border-hairline p-8">
      <p className="text-lg">{t("storeDown.body")}</p>
      <div className="mt-3">
        <SourceNote>{t("storeDown.source")}</SourceNote>
      </div>
    </div>
  );
}

export default function AtlasPage({ report, locale }: { report: AtlasReport | null; locale: Locale }) {
  const t = useTranslations("atlas");
  // Zdroje mimo dosah atlasu se vypisují i při NEČITELNÉM úložišti: seznam je
  // deklarace v kódu, ne měření, takže výpadek store o něm nic nemění. Volá se
  // TÁŽ funkce, jakou použila derivace (`report.unscored`), nikdy druhá kopie —
  // bez reportu nedostal kartu nikdo, a tak je množina „s kartou“ prázdná.
  const unscored = report?.unscored ?? unscoredSources();
  // Čísla sekcí se odvozují z toho, co se SKUTEČNĚ vykreslí (vzor /poslanec):
  // bez reportu sekce „Zdroje“ chybí a prázdný registr by vynechal tu druhou,
  // takže žádné číslo nesmí být natvrdo.
  let section = 0;
  const sourcesIndex = report === null ? null : ++section;
  const unscoredIndex = unscored.length > 0 ? ++section : null;
  const relatedIndex = ++section;
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ atlas</span>
          {/* Strojově čitelná podoba atlasu — veřejné API skóre. */}
          <a
            href="/atlas/atlas.json"
            className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            atlas.json
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">{t("hero.kicker")}</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("hero.title")}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">{t("hero.lead")}</p>

        {/* Metodika — co skóre tvrdí a co záměrně netvrdí. */}
        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
            {t("methodology.kicker")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            {t("methodology.body", {
              stale: formatInt(STALE_CADENCE_MULTIPLIER, locale),
              zero: formatInt(ZERO_CADENCE_MULTIPLIER, locale),
            })}
          </p>
        </div>

        {report === null || sourcesIndex === null ? (
          <StoreDownState />
        ) : (
          <section className="mt-14 border-t-4 border-ink pt-10">
            <SectionHeading
              index={sourcesIndex}
              title={t("sources.title")}
              aside={<SourceNote>{t("sources.aside")}</SourceNote>}
            />
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
              {t("sources.lead", { count: formatInt(report.sources.length, locale) })}
            </p>
            <div className="mt-8">
              <AtlasCards report={report} locale={locale} />
            </div>
          </section>
        )}

        {unscoredIndex !== null && (
          <AtlasUnscored unscored={unscored} index={unscoredIndex} locale={locale} />
        )}

        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={relatedIndex}
            title={t("related.title")}
            aside={<SourceNote>{t("related.aside")}</SourceNote>}
          />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href="/data"
              className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              {t("related.data")} <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
            <Link
              href="/dukazy"
              className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              {t("related.dukazy")} <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
            <SourceNote>{t("related.note")}</SourceNote>
          </div>
        </section>
      </div>
    </main>
  );
}
