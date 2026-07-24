"use client";

/*
 * FollowTheMoney — modul sítě peněz (/penize). Produkční domov archivního
 * rentgenového grafu entit, přeloženého do řeči Konstrukt: agregátní
 * dlaždice, interaktivní peněžní stopa, kniha doložených vazeb po
 * poslancích a metodika stopy (IČO join + lidská kontrola). Sytí pilíř
 * Integrita × 0.3 — a je to plocha, kam CivicScore odkazuje jako na
 * „ukaž mi důkazy" (politicas.md §3).
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { MODULES, MONEY_TIES } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import MoneyGraph from "./MoneyGraph";
import TiesLedger from "./components/TiesLedger";
import TrailMethod from "./components/TrailMethod";

const MODULE = MODULES.find((m) => m.key === "follow-the-money")!;
const PENDING = MONEY_TIES.filter((tie) => !tie.verified).length;

export default function FollowTheMoneyPage() {
  const t = useTranslations("money");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();

  const STATS = [
    {
      label: tc(`modules.${MODULE.key}.metricLabel`),
      value: tc(`modules.${MODULE.key}.metricValue`),
      sub: t("stats.contracted.sub"),
      source: t("stats.contracted.source"),
    },
    {
      label: t("stats.sampleTies.label"),
      value: f.int(MONEY_TIES.length),
      sub: t("stats.sampleTies.sub"),
      source: t("stats.sampleTies.source"),
    },
    {
      label: t("stats.pendingReview.label"),
      value: f.int(PENDING),
      sub: t("stats.pendingReview.sub"),
      source: t("stats.pendingReview.source"),
    },
    {
      label: t("stats.joinKey.label"),
      value: "IČO",
      sub: t("stats.joinKey.sub"),
      source: t("stats.joinKey.source"),
    },
  ];

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 transition-colors hover:text-signal">
              <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
                <rect width="32" height="32" className="fill-signal" />
                <circle cx="16" cy="16" r="9" className="fill-paper" />
                <rect x="14.5" y="4" width="3" height="24" className="fill-ink" />
              </svg>
              <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ followthemoney</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("controlRoom")}
            </Link>
            <LanguageSwitcher className="my-auto" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{t("eyebrow")}</SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            {t("title")}<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            {t("intro")}
          </p>
        </div>

        {/* ── Agregátní dlaždice ────────────────────────────── */}
        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-paper p-6"
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{s.label}</p>
              <p className="mt-3 text-4xl font-black tabular-nums tracking-tight">{s.value}</p>
              <p className="mt-2 text-sm text-steel">{s.sub}</p>
              <SourceNote className="mt-3 !text-[10px]">{tcom("sourcePrefix")} {s.source}</SourceNote>
            </motion.div>
          ))}
        </div>

        {/* ── 01 Graf entit ─────────────────────────────────── */}
        <section className="mt-16">
          <SectionHeading
            index={1}
            title={t("sections.graph.title")}
            aside={<SourceNote>{t("sections.graph.aside")}</SourceNote>}
          />
          <div className="mt-8">
            <MoneyGraph />
          </div>
          <div className="mt-3">
            <SourceNote>
              {t("graphCaption")}
            </SourceNote>
          </div>
        </section>

        {/* ── 02 Kniha vazeb ────────────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title={t("sections.ledger.title")}
            aside={<SourceNote>{t("sections.ledger.aside")}</SourceNote>}
          />
          <div className="mt-8">
            <TiesLedger />
          </div>
        </section>

        {/* ── 03 Jak stopa vzniká ───────────────────────────── */}
        <section className="mt-16 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={3}
            title={t("sections.method.title")}
            aside={<SourceNote>{t("sections.method.aside")}</SourceNote>}
          />
          <div className="mt-8">
            <TrailMethod />
          </div>
        </section>
      </div>
    </main>
  );
}
