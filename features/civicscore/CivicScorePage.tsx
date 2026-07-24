"use client";

/*
 * CivicScore — plný žebříček republiky (/zebricek, roadmapa Fáze 2).
 * Syntéza modulu: rozložení sněmovny, žebříček všech 200 poslanců
 * (deterministický mock kotvený na detailním vzorku) a souboj dvou
 * poslanců pilíř po pilíři. Váhy zůstávají na očích u každého čísla.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { LEADERBOARD, type LeaderboardRow } from "@/lib/civic/leaderboard";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ScoreHistogram from "./components/ScoreHistogram";
import HeadToHead from "./components/HeadToHead";
import LeaderboardTable from "./components/LeaderboardTable";

export default function CivicScorePage() {
  const t = useTranslations("civicscore");
  // Souboj: max dva vybraní; třetí výběr vyřadí staršího z dvojice.
  const [duel, setDuel] = useState<string[]>(["novakova-p", "hruska-k"]);
  const toggleDuel = (id: string) =>
    setDuel((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d.slice(-1), id]));

  const pair =
    duel.length === 2
      ? ([
          LEADERBOARD.find((r) => r.id === duel[0])!,
          LEADERBOARD.find((r) => r.id === duel[1])!,
        ] as [LeaderboardRow, LeaderboardRow])
      : null;

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
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ civicscore</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("backToControl")}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{t("sourceNote")}</SourceNote>
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
            {t("lead")}
          </p>
        </div>

        {/* ── 01 Rozložení ──────────────────────────────────── */}
        <section>
          <SectionHeading
            index={1}
            title={t("distributionTitle")}
            aside={<SourceNote>{t("distributionSource")}</SourceNote>}
          />
          <div className="mt-8">
            <ScoreHistogram />
          </div>
        </section>

        {/* ── 02 Souboj ─────────────────────────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title={t("duelTitle")}
            aside={<SourceNote>{t("duelSource")}</SourceNote>}
          />
          <div className="mt-8">
            <HeadToHead pair={pair} />
          </div>
        </section>

        {/* ── 03 Žebříček ───────────────────────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={3}
            title={t("allTitle")}
            aside={<SourceNote>{t("allSource")}</SourceNote>}
          />
          <div className="mt-8">
            <LeaderboardTable duel={duel} onToggleDuel={toggleDuel} />
          </div>
        </section>
      </div>
    </main>
  );
}
