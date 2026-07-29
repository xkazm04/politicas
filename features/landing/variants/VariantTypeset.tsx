"use client";

/**
 * Varianta D — „typeset + colorize": nálezy auditu, ne nový nápad.
 *
 * Drží Konstrukt beze změny kompozice a mění jen to, co docs/design/
 * impeccable-pass-01.md označil za vadu:
 *
 *  1. citace se sází podle DÉLKY (Citation), ne podle role — dlouhá citace je
 *     věta ve větné sazbě, ne 115 znaků proložených verzálek v 10 px;
 *  2. drobný text jede na `steel-aa` (4,90:1) a `signal-text` (5,31:1) místo
 *     `steel` (4,11:1) a `signal` (4,10:1);
 *  3. jméno poslance přestalo přetékat řádek o 27 px při 390 px (RankRow);
 *  4. meta text na kobaltu ztratil `opacity-70/80`, které ho při 11 px sráželo
 *     na 3,2:1 měřeného kontrastu — místo průhlednosti je plná barva.
 *
 * Aby bylo co porovnávat, sekce „než / po" ukazuje starou a novou sazbu citace
 * vedle sebe na TÉŽE větě. Je to jediná varianta, která je rovnou k sloučení:
 * nic nepřidává, jen opravuje.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import Citation from "@/features/shared/components/Citation";
import SourceNote from "@/features/shared/components/SourceNote";
import SectionRule from "@/features/shared/components/SectionRule";
import type { LandingData } from "../getLandingData";
import VariantChrome from "./VariantChrome";
import RankRow from "./RankRow";

export default function VariantTypeset({ data }: { data: LandingData }) {
  const t = useTranslations("landingVariants");
  const tl = useTranslations("landing");
  const f = useFormat();

  const longCitation = t("sourceIndex", { pass: data.provenancePass ?? "—" });

  return (
    <VariantChrome data={data}>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Citation>{t("eyebrowCoverage")}</Citation>
        <h1 className="mt-6 text-6xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
          {tl("titleLine1")}
          <br />
          <span className="text-signal">{tl("titleLine2")}</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed">{t("boldLead")}</p>
        <div className="mt-6 max-w-xl">
          <Citation>{longCitation}</Citation>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/zebricek"
            className="inline-flex items-center gap-2 bg-ink px-6 py-3.5 text-sm font-black uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
          >
            {t("ctaAll")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Než / po: táž věta, dvě sazby ───────────────────────────── */}
      <section className="border-t-4 border-ink">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-4xl font-black uppercase tracking-tight">
            {t("beforeAfterTitle")}
            <span className="text-signal">.</span>
          </h2>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
            {t("beforeAfterIntro")}
          </p>

          <div className="mt-8 grid gap-px border border-ink bg-ink lg:grid-cols-2">
            <div className="bg-paper p-6">
              <span className="font-mono text-xs uppercase tracking-widest text-signal-text">
                {t("beforeLabel")}
              </span>
              <div className="mt-4">
                <SourceNote>{longCitation}</SourceNote>
              </div>
              <ul className="mt-6 space-y-1 text-sm text-steel-aa">
                <li>{t("beforeFact1")}</li>
                <li>{t("beforeFact2")}</li>
                <li>{t("beforeFact3")}</li>
              </ul>
            </div>
            <div className="bg-paper p-6">
              <span className="font-mono text-xs uppercase tracking-widest text-signal-text">
                {t("afterLabel")}
              </span>
              <div className="mt-4">
                <Citation>{longCitation}</Citation>
              </div>
              <ul className="mt-6 space-y-1 text-sm text-steel-aa">
                <li>{t("afterFact1")}</li>
                <li>{t("afterFact2")}</li>
                <li>{t("afterFact3")}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Zdroje na kobaltu — bez opacity ─────────────────────────── */}
      <section className="bg-cobalt text-paper">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black uppercase tracking-tight">{tl("sourcesTitle")}</h2>
            <Citation tone="paper">{t("sourcesOpacityNote")}</Citation>
          </div>
          <div className="mt-8 grid gap-px bg-paper/40 sm:grid-cols-2 lg:grid-cols-4">
            {data.clubs.slice(0, 8).map((c) => (
              <div key={c.abbrev} className="bg-cobalt p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-paper">
                  {c.abbrev}
                </p>
                <p className="mt-2 text-3xl font-black tabular-nums">{f.int(c.seats)}</p>
                <p className="mt-1 min-w-0 truncate text-sm text-paper">{c.name}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Citation tone="paper">{t("sourceChamber")}</Citation>
          </div>
        </div>
      </section>

      <section className="border-t-4 border-ink">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-4xl font-black uppercase tracking-tight">
            {tl("rankingTitle")}
            <span className="text-signal">.</span>
          </h2>
          <ol className="mt-8 border-t-2 border-ink">
            {data.top.map((mp) => (
              <RankRow key={mp.pspId} mp={mp} scale="bold" />
            ))}
          </ol>
          <div className="mt-4">
            <Citation>{t("sourceRanking", { total: data.summary.count })}</Citation>
          </div>
        </div>
      </section>
    </VariantChrome>
  );
}
