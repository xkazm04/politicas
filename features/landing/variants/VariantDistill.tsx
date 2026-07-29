"use client";

/**
 * Varianta B — „distill". Zbavit stránku všeho, co není důkaz.
 *
 * Teze: volič, který přišel z odkazu na sociální síti, nechce prohlížet pět
 * modulů — chce jeden verdikt a důvod mu věřit. Tahle varianta drží jednu větu,
 * jednu tabulku a jednu citaci; žádný graf, žádné dlaždice, žádný hemicykl.
 *
 * Test, který má tahle varianta projít: co ubyde, když se odečte všechno, co
 * není tvrzení nebo jeho doklad — a zůstane to pořád Politicas?
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import Citation from "@/features/shared/components/Citation";
import type { LandingData } from "../getLandingData";
import VariantChrome from "./VariantChrome";
import RankRow from "./RankRow";

export default function VariantDistill({ data }: { data: LandingData }) {
  const t = useTranslations("landingVariants");
  const f = useFormat();

  return (
    <VariantChrome data={data}>
      <section className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
        <h1 className="text-4xl font-black uppercase leading-[1.05] tracking-tight sm:text-5xl">
          {t("distillClaim", { count: data.summary.count })}
        </h1>
        <p className="mt-8 text-lg leading-relaxed">{t("distillLead")}</p>
        <div className="mt-8">
          <Citation>{t("sourceIndex", { pass: data.provenancePass ?? "—" })}</Citation>
        </div>

        <ol className="mt-14 border-t-2 border-ink">
          {data.top.map((mp) => (
            <RankRow key={mp.pspId} mp={mp} scale="quiet" />
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <Link
            href="/zebricek"
            className="font-mono text-xs uppercase tracking-widest underline decoration-signal decoration-2 underline-offset-4 hover:text-signal-text"
          >
            {t("ctaRest", { rest: data.summary.count - data.top.length })}
          </Link>
          <span className="font-mono text-xs tabular-nums text-steel-aa">
            {t("medianInline", { median: f.dec(data.summary.median) })}
          </span>
        </div>

        <p className="mt-16 border-t border-hairline pt-6 text-sm leading-relaxed text-steel-aa">
          {t("distillDisagree")}
        </p>
      </section>
    </VariantChrome>
  );
}
