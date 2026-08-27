/*
 * Volby: zrcadlo — rubrika titulní strany (/spark election-replay, vlna 3):
 * jen VSTUP do „Kde volíte?" a jedna věta. Žádné číslo, žádný picker — picker
 * i census žijí na /volby, a hero zůstává netknuté (rozhodnutí vlny 3).
 * Copy z katalogu (`landing.volby.*`); hlídá to hardcodedCopy.test.ts.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import SectionRule from "@/features/shared/components/SectionRule";

const ENTRIES = [
  { key: "obec", href: "/volby#kde-volite" },
  { key: "kraj", href: "/volby#kde-volite" },
  { key: "chamber", href: "/volby/snemovna" },
] as const;

export default function VolbySection() {
  const t = useTranslations("landing.volby");
  return (
    <section id="k-volby" aria-label={t("regionLabel")} className="border-t-4 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
            {t("title")}
            <span className="text-signal">?</span>
          </h2>
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">{t("regionLabel")}</span>
        </div>
        <div className="mt-4">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("lead")}</p>
        <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-3">
          {ENTRIES.map((e) => (
            <Link
              key={e.key}
              href={e.href}
              className="group flex items-center justify-between gap-3 bg-paper px-5 py-5 text-lg font-black uppercase tracking-tight transition-colors hover:bg-ink hover:text-paper"
            >
              {t(e.key)}
              <ArrowUpRight className="h-5 w-5 shrink-0 text-signal transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
        <Link
          href="/volby"
          className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {t("cta")} →
        </Link>
      </div>
    </section>
  );
}
