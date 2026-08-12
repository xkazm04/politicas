/*
 * TŘETÍ STAV KOMPASU — vrstva, která se nikdy nespočítala.
 *
 * Do 2026-08-12 tady stálo `DataUnavailable`, tedy věta o nedosažitelném zdroji.
 * Jenže zdroj dosažitelný je: hlasovací záznam PSP10 se čte v pořádku a /hlasovani
 * z něj kreslí celý deník. Chybí NAŠE odvozená vrstva tematických štítků nad
 * hlasováními — ta se zatím nikdy nespočítala. To je jiné tvrzení než výpadek
 * a zaslouží si vlastní věty (precedens „nečteno ≠ 0" z /penize/strety).
 *
 * Co tu záměrně NENÍ: termín. Nikdo tu vrstvu nemá naplánovanou, a slib data
 * dodání by byl závazek, který nikdo nedal. A žádný interní žargon — čtenář
 * nemá vědět, jak se ta vrstva jmenuje v databázi.
 *
 * Serverová komponenta: routa zůstává tenká, věty jdou z katalogu.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";

export default async function KompasNeverComputed() {
  const t = await getTranslations("votetrack");
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ kompas</span>
          <Link
            href="/hlasovani"
            className="font-mono text-xs uppercase tracking-widest text-steel-aa underline-offset-2 hover:text-ink hover:underline"
          >
            {t("kompas.backToVotes")} →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <SourceNote>{t("kompas.neverComputedBadge")}</SourceNote>
        <h1 className="mt-3 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("kompas.neverComputedTitle")}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-xl">
          <SectionRule />
        </div>

        <div className="mt-6 max-w-2xl border-l-4 border-ochre pl-4">
          <p className="text-base leading-relaxed text-steel">{t("kompas.neverComputedBody")}</p>
          <p className="mt-3 text-base leading-relaxed text-steel">{t("kompas.neverComputedWhat")}</p>
          <p className="mt-3 text-sm leading-relaxed text-steel-aa">{t("kompas.neverComputedNoDate")}</p>
          <div className="mt-3">
            <SourceNote>{t("kompas.neverComputedSource")}</SourceNote>
          </div>
        </div>

        <Link
          href="/hlasovani"
          className="mt-8 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal motion-reduce:transition-none"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {t("kompas.neverComputedLedgerLink")}
        </Link>
      </div>
    </main>
  );
}
