"use client";

/**
 * Varianta A — „bolder" nad zděděným světem Konstrukt.
 *
 * Teze: Konstrukt už POV má, jen ho na úvodní straně ztlumil. Tahle varianta
 * nemění identitu ani typografii — zesiluje ji. Plakátová číslice, kterou nese,
 * je jediné číslo, na kterém stojí pozice produktu z PRODUCT.md: **207**, celá
 * sněmovna, ne výběr. Nevýběr JE zárukou nestrannosti, takže je to i největší
 * číslo na stránce.
 *
 * Data jsou skutečná (getLandingData → getLeaderboardListData, tentýž read jako
 * /zebricek), takže tu nestojí žádné „ILUSTRATIVNÍ UKÁZKA".
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import Citation from "@/features/shared/components/Citation";
import SectionRule from "@/features/shared/components/SectionRule";
import type { LandingData } from "../getLandingData";
import VariantChrome from "./VariantChrome";
import RankRow from "./RankRow";

export default function VariantBolder({ data }: { data: LandingData }) {
  const t = useTranslations("landingVariants");
  const tl = useTranslations("landing");
  const f = useFormat();

  return (
    <VariantChrome data={data}>
      {/* ── Plakátová hlava: jedno číslo, které nese pozici ─────────── */}
      <section className="border-b-4 border-ink bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <Citation tone="paper">{t("eyebrowCoverage")}</Citation>
          <div className="mt-8 grid items-end gap-8 lg:grid-cols-[auto_1fr]">
            <div>
              <span className="block font-sans text-[9rem] font-black leading-[0.8] tracking-tight tabular-nums lg:text-[14rem]">
                {f.int(data.summary.count)}
              </span>
            </div>
            <div className="pb-4">
              <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
                {tl("titleLine1")}
                <br />
                <span className="text-signal">{tl("titleLine2")}</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-paper/80">
                {t("boldLead")}
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/zebricek"
              className="inline-flex items-center gap-2 bg-signal px-7 py-4 text-sm font-black uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
            >
              {t("ctaAll")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/zakony"
              className="inline-flex items-center gap-2 border-2 border-paper px-7 py-4 text-sm font-black uppercase tracking-wider transition-colors hover:bg-paper hover:text-ink"
            >
              {tl("ctaMethod")}
            </Link>
          </div>

          <div className="mt-10 border-t border-paper/30 pt-4">
            <Citation tone="paper">{t("sourceIndex", { pass: data.provenancePass ?? "—" })}</Citation>
          </div>
        </div>
      </section>

      {/* ── Rozptyl sněmovny jako plocha, ne graf ───────────────────── */}
      <section className="border-b-4 border-ink">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
              {t("spreadTitle")}
              <span className="text-signal">.</span>
            </h2>
            <Citation>{t("sourceSpread")}</Citation>
          </div>
          <div className="mt-4">
            <SectionRule />
          </div>

          <div className="mt-8 flex items-end gap-px border border-ink bg-ink" aria-hidden>
            {data.histogram.map((b) => {
              const max = Math.max(...data.histogram.map((h) => h.count), 1);
              return (
                <div key={b.label} className="flex-1 bg-paper">
                  <div
                    className="bg-signal"
                    style={{ height: `${Math.max(4, Math.round((b.count / max) * 160))}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-px" role="list">
            {data.histogram.map((b) => (
              <div key={b.label} role="listitem" className="flex-1 pt-2 text-center">
                <span className="block font-mono text-xs tabular-nums text-ink">{b.count}</span>
                <span className="block font-mono text-xs text-steel-aa">{b.label}</span>
              </div>
            ))}
          </div>

          <dl className="mt-10 grid gap-px border border-ink bg-ink sm:grid-cols-3">
            {[
              { k: t("avgLabel"), v: f.dec(data.summary.avg) },
              { k: t("medianLabel"), v: f.dec(data.summary.median) },
              { k: t("sigmaLabel"), v: f.dec(data.summary.sigma) },
            ].map((s) => (
              <div key={s.k} className="bg-paper p-6">
                <dt className="font-mono text-xs uppercase tracking-widest text-steel-aa">{s.k}</dt>
                <dd className="mt-2 text-5xl font-black tabular-nums tracking-tight">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Hlava žebříčku ─────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
              {tl("rankingTitle")}
              <span className="text-signal">.</span>
            </h2>
            <Citation>{t("sourceRanking", { total: data.summary.count })}</Citation>
          </div>
          <ol className="mt-8 border-t-2 border-ink">
            {data.top.map((mp) => (
              <RankRow key={mp.pspId} mp={mp} scale="bold" />
            ))}
          </ol>
          <Link
            href="/zebricek"
            className="mt-8 inline-flex items-center gap-2 bg-ink px-7 py-4 text-sm font-black uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
          >
            {t("ctaRest", { rest: data.summary.count - data.top.length })}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </VariantChrome>
  );
}
