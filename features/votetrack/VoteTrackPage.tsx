"use client";

/*
 * VoteTrack — modul analýzy hlasování. Od 2026-07-30 (Seismograf, moonshot B1)
 * jedou sekce 01–04 nad REÁLNÝM záznamem PSP10 (getVoteRecord: vote_event +
 * vote_ballot + kluby, deterministická derivace v record/derive.ts) — mock
 * ROLL_CALLS zůstává jen jako poctivě označený fallback při výpadku store
 * (vzor LawWatch Real/Mock + LiveDataNotice). Sekce témat čte Silver vrstvu
 * vote_tag jako dřív. Každé číslo cituje psp.cz.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROLL_CALLS } from "@/lib/civic/data";
import LiveDataNotice from "@/features/shared/components/LiveDataNotice";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import VoteLedger from "./components/VoteLedger";
import ChamberDetail from "./components/ChamberDetail";
import DisciplineBoard from "./components/DisciplineBoard";
import Rebellions from "./components/Rebellions";
import RealVoteTrack from "./components/RealVoteTrack";
import VoteThemeFilter from "./components/VoteThemeFilter";
import { COPY } from "./record/copy";
import { KOMPAS_COPY } from "./kompas/copy";
import type { VoteRecordData } from "./record/types";
import type { VoteThemeData } from "./themeTypes";

export default function VoteTrackPage({
  record,
  themeData,
}: {
  record: VoteRecordData | null;
  themeData: VoteThemeData | null;
}) {
  const t = useTranslations("votetrack");
  const real = record !== null && record.ledger.length > 0;
  const themesIndex = real ? 5 : 4;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ votetrack</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          {real ? (
            <SourceNote tone="signal">{COPY.heroNote}</SourceNote>
          ) : (
            <SourceNote tone="signal">{t("heroSourceNote")}</SourceNote>
          )}
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
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">{real ? COPY.lead : t("lead")}</p>

          {/* Vstup do kompasu (moonshot 5B) — kobalt = váš pohled na záznam. */}
          <Link
            href="/kompas"
            className="group mt-6 inline-flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-1 border-2 border-cobalt px-4 py-3 transition-colors hover:bg-cobalt motion-reduce:transition-none"
          >
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-cobalt group-hover:text-paper">
              {KOMPAS_COPY.entryTitle}
            </span>
            <span className="text-sm text-steel-aa group-hover:text-paper">{KOMPAS_COPY.entryBody}</span>
            <ArrowRight className="h-4 w-4 text-cobalt group-hover:text-paper" aria-hidden />
          </Link>
        </div>

        {real ? (
          <RealVoteTrack record={record} />
        ) : (
          <>
            {/* Store outage / not-yet-ingested: say it once, loudly, then the
                labelled illustrative sample (never real-looking numbers). */}
            <div className="mb-10">
              <LiveDataNotice title={COPY.fallbackTitle} body={COPY.fallbackBody} source={COPY.fallbackSource} />
            </div>
            <MockVoteTrack />
          </>
        )}

        {/* ── Témata hlasování (reálná data ze store — Silver vrstva) ── */}
        {themeData && themeData.votes.length > 0 && (
          <section id="temata" className="mt-14 border-t-4 border-ink pt-10 pb-20">
            <SectionHeading
              index={themesIndex}
              title={t("section4Title")}
              aside={<SourceNote>{t("section4Note")}</SourceNote>}
            />
            <div className="mt-8">
              <VoteThemeFilter data={themeData} />
            </div>
          </section>
        )}
        {!(themeData && themeData.votes.length > 0) && <div className="pb-20" />}
      </div>
    </main>
  );
}

/** Původní ilustrativní ukázka (5 smyšlených hlasování) — beze změny, jen
 * sbalená do fallback větve. */
function MockVoteTrack() {
  const t = useTranslations("votetrack");
  const [selectedId, setSelectedId] = useState(ROLL_CALLS[0].id);
  const rc = ROLL_CALLS.find((r) => r.id === selectedId) ?? ROLL_CALLS[0];

  return (
    <>
      {/* ── 01 Deník + sál ────────────────────────────────── */}
      <section id="denik">
        <SectionHeading
          index={1}
          title={t("section1Title")}
          aside={<SourceNote>{t("section1Note")}</SourceNote>}
        />
        <div className="mt-8 grid gap-10 pb-4 lg:grid-cols-[5fr_7fr]">
          <VoteLedger selectedId={selectedId} onSelect={setSelectedId} />
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ChamberDetail rc={rc} />
          </div>
        </div>
      </section>

      {/* ── 02 Linie klubů ────────────────────────────────── */}
      <section id="linie" className="mt-14 border-t-4 border-ink pt-10">
        <SectionHeading
          index={2}
          title={t("section2Title")}
          aside={<SourceNote>{t("section2Note")}</SourceNote>}
        />
        <div className="mt-8">
          <DisciplineBoard />
        </div>
      </section>

      {/* ── 03 Rebelie a nezávislost ──────────────────────── */}
      <section id="rebelie" className="mt-14 border-t-4 border-ink pt-10">
        <SectionHeading
          index={3}
          title={t("section3Title")}
          aside={<SourceNote>{t("section3Note")}</SourceNote>}
        />
        <div className="mt-8">
          <Rebellions />
        </div>
      </section>
    </>
  );
}
