"use client";

/*
 * Paměť zákona — /zakony/predpis (moonshot 5A): rejstřík všech předpisů,
 * které stopa tisků v grafu zná. Vstupní brána ke kritickým vydáním
 * (/zakony/predpis/[ref]); pokrytí §-stopy se přiznává na řádku i souhrnně.
 */

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import type { StatuteRegistryRow } from "./deriveStatuteDossier";

export default function StatuteRegistryPage({ rows }: { rows: StatuteRegistryRow[] }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();
  const withTrail = rows.filter((r) => r.changes > 0).length;
  const totalChanges = rows.reduce((s, r) => s + r.changes, 0);

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">{t("registry.crumb")}</span>
          <Link
            href="/zakony"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("registry.backToMonitor")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6">
        <div className="py-10">
          <SourceNote tone="signal">{t("registry.eyebrow")}</SourceNote>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            {t("registry.title")}<span className="text-signal">.</span>
          </h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            {t("registry.introBefore")} <span className="font-mono">#p-&lt;§&gt;</span>
            {t("registry.introAfter")}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-px border-2 border-ink bg-ink max-sm:grid-cols-1">
          {[
            { v: f.int(rows.length), l: t("registry.stats.inTrail") },
            { v: f.int(withTrail), l: t("registry.stats.withTrail") },
            { v: f.int(totalChanges), l: t("registry.stats.changes") },
          ].map((s) => (
            <div key={s.l} className="bg-paper px-4 py-4">
              <div className="text-3xl font-black tabular-nums">{s.v}</div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <SourceNote>{t("registry.statsSource")}</SourceNote>
        </div>

        <section className="mt-12 pb-20">
          <SectionHeading
            index={1}
            title={t("registry.sectionTitle")}
            aside={<SourceNote>{t("registry.sortAside")}</SourceNote>}
          />
          {/* Poctivé prázdno místo holého pravidla: s nulou řádků zbyla na ploše jen
              věta „řazeno počtem tisků" nad ničím a pod tím poznámka o §-stopě —
              čtenář nemá jak poznat, jestli se rejstřík nenačetl, nebo je opravdu
              prázdný. (Idiom dashed rámečku — CollisionsPage.EmptyState.) */}
          {rows.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline bg-paper-strong px-6 py-8">
              <p className="font-mono text-xs uppercase tracking-widest text-steel">{t("registry.emptyLabel")}</p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-steel">{t("registry.emptyText")}</p>
            </div>
          ) : (
          <div className="mt-8 border-t-2 border-ink">
            {rows.map((r) => (
              <Link
                key={r.ref}
                href={`/zakony/predpis/${r.slug}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-6 border-b border-hairline px-2 py-4 transition-colors hover:bg-paper-strong"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-xs font-bold text-signal">č. {r.ref} Sb.</span>
                    {r.changes > 0 && (
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider text-ochre">
                        {t("registry.trailBadge", { count: r.changes, countFmt: f.int(r.changes) })}
                      </span>
                    )}
                  </span>
                  {r.title ? (
                    <span className="mt-0.5 block text-[15px] font-bold leading-snug">{r.title}</span>
                  ) : (
                    <span className="mt-0.5 block text-[15px] font-bold leading-snug">{r.label}</span>
                  )}
                </span>
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black tabular-nums">{f.int(r.trailBills)}</span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                      {t("billCountWord", { count: r.trailBills })}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </Link>
            ))}
          </div>
          )}
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
            {t("registry.footnote")}
          </p>
        </section>
      </div>
    </main>
  );
}
