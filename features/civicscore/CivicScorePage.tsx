"use client";

/*
 * CivicScore — plný žebříček republiky (/zebricek).
 * REÁLNÁ DATA: všech 207 poslanců 9. období seřazených podle indexu přispění
 * (contribution_score) z deterministického znalostního grafu (psp.cz). Šest
 * složek se zveřejněnou vahou nahrazuje původní čtyři mock pilíře — každé číslo
 * pochází z grafu, žádné se zde nedopočítává ani nevymýšlí. Trend/delta
 * (čtvrtletní řada) nemá reálné podloží (jedno období) → vynecháno.
 *
 * Data přicházejí jako typovaná prop z server-only loaderu getLeaderboardData.
 * Null (bez storu / prázdný graf) → stránka se vykreslí s ohlášeným upozorněním.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { LeaderboardListData, LeaderboardListEntry } from "./getLeaderboardData";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import ScoreHistogram from "./components/ScoreHistogram";
import HeadToHead from "./components/HeadToHead";
import LeaderboardTable from "./components/LeaderboardTable";

export default function CivicScorePage({ data }: { data: LeaderboardListData | null }) {
  const t = useTranslations("civicscore");
  // Souboj: max dva vybraní (klíč = pspId); třetí výběr vyřadí staršího.
  const initial = data?.entries.slice(0, 2).map((e) => e.pspId) ?? [];
  const [duel, setDuel] = useState<number[]>(initial);
  const toggleDuel = (pspId: number) =>
    setDuel((d) => (d.includes(pspId) ? d.filter((x) => x !== pspId) : [...d.slice(-1), pspId]));

  const byId = useMemo(
    () => new Map((data?.entries ?? []).map((e) => [e.pspId, e])),
    [data],
  );
  const pair =
    duel.length === 2 && byId.has(duel[0]) && byId.has(duel[1])
      ? ([byId.get(duel[0])!, byId.get(duel[1])!] as [LeaderboardListEntry, LeaderboardListEntry])
      : null;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ civicscore</span>
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
          {data && (
            <SourceNote className="mt-3">
              pokrytí analýzy: {data.dossierCoverage.withDossier}/{data.dossierCoverage.total} poslanců má
              pracovní profil (effort-loop enrichment, dosud probíhá)
            </SourceNote>
          )}
        </div>

        {data === null ? (
          <div className="mb-20 border-2 border-dashed border-hairline p-8">
            <p className="text-base font-black uppercase tracking-wide">{t("noData")}</p>
          </div>
        ) : (
          <>
            {/* ── 01 Rozložení ──────────────────────────────── */}
            <section id="rozlozeni">
              <SectionHeading
                index={1}
                title={t("distributionTitle")}
                aside={<SourceNote>{t("realNote")}</SourceNote>}
              />
              <div className="mt-8">
                <ScoreHistogram summary={data.summary} histogram={data.histogram} />
              </div>
            </section>

            {/* ── 02 Souboj ─────────────────────────────────── */}
            <section id="souboj" className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={2}
                title={t("duelTitle")}
                aside={<SourceNote>{t("duelSource")}</SourceNote>}
              />
              <div className="mt-8">
                <HeadToHead pair={pair} components={data.components} />
              </div>
            </section>

            {/* ── 03 Žebříček ───────────────────────────────── */}
            <section id="vsichni" className="mt-14 border-t-4 border-ink pt-10 pb-20">
              <SectionHeading
                index={3}
                title={t("allTitle")}
                aside={<SourceNote>{t("realNote")}</SourceNote>}
              />
              <div className="mt-8">
                <LeaderboardTable
                  entries={data.entries}
                  clubs={data.clubs}
                  components={data.components}
                  duel={duel}
                  onToggleDuel={toggleDuel}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
