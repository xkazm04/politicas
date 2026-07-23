"use client";

/*
 * VoteTrack — modul analýzy hlasování (fúze všech tří prototypových variant,
 * kolo 2): Deník dodal chronologickou knihu jako výběr, Sál pohled do sálu
 * jako trvalý detail, který výběr řídí, a Linie analytiku disciplíny,
 * matici a rebelie jako navazující sekce. Sytí pilíře Aktivita, Docházka
 * a Nezávislost; každé číslo cituje psp.cz.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ROLL_CALLS } from "@/lib/civic/data";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import VoteLedger from "./components/VoteLedger";
import ChamberDetail from "./components/ChamberDetail";
import DisciplineBoard from "./components/DisciplineBoard";
import Rebellions from "./components/Rebellions";

export default function VoteTrackPage() {
  const [selectedId, setSelectedId] = useState(ROLL_CALLS[0].id);
  const rc = ROLL_CALLS.find((r) => r.id === selectedId) ?? ROLL_CALLS[0];

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
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ votetrack</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> velín
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">
            votetrack · analýza hlasování · sytí pilíře aktivita + docházka + nezávislost
          </SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            Hlasování sněmovny<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            Deník jmenovitých hlasování, pohled do sálu a linie klubů — tři perspektivy
            nad týmiž daty. Vyberte zápis v deníku; sál se překreslí.
          </p>
        </div>

        {/* ── 01 Deník + sál ────────────────────────────────── */}
        <section>
          <SectionHeading
            index={1}
            title="Deník a sál"
            aside={<SourceNote>pruh = sál: kobalt pro · šedá zdržel/omluven · signální proti</SourceNote>}
          />
          <div className="mt-8 grid gap-10 pb-4 lg:grid-cols-[5fr_7fr]">
            <VoteLedger selectedId={selectedId} onSelect={setSelectedId} />
            <div className="lg:sticky lg:top-8 lg:self-start">
              <ChamberDetail rc={rc} />
            </div>
          </div>
        </section>

        {/* ── 02 Linie klubů ────────────────────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title="Linie klubů"
            aside={<SourceNote>psp.cz — odchylky od stranické linie · počítáno z rozpadů</SourceNote>}
          />
          <div className="mt-8">
            <DisciplineBoard />
          </div>
        </section>

        {/* ── 03 Rebelie a nezávislost ──────────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10 pb-20">
          <SectionHeading
            index={3}
            title="Rebelie a nezávislost"
            aside={<SourceNote>sytí pilíř nezávislost × 0.25 · metodika v1.4</SourceNote>}
          />
          <div className="mt-8">
            <Rebellions />
          </div>
        </section>
      </div>
    </main>
  );
}
