"use client";

/**
 * Landing Politicas — vítězná výtvarná řeč „Konstrukt" (sutnarovský
 * funkcionalistický plakát), povýšená z prototypové laboratoře na produkční
 * baseline (kolo 3). Orchestrátor drží jediný sdílený stav (vybraný poslanec
 * + uživatelské váhy) a skládá sekce; vizuální detaily žijí v components/.
 * Archivní směr Rentgen zůstává na /rentgen (features/labs/).
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Pillar } from "@/lib/civic/data";
import { MPS, PILLARS } from "@/lib/civic/data";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import SiteHeader from "./components/SiteHeader";
import HeroStory from "./components/HeroStory";
import LiveSpecimen, { type Weights } from "./components/LiveSpecimen";
import Standings from "./components/Standings";
import ScoreBreakdown from "./components/ScoreBreakdown";
import TrendChart from "./components/TrendChart";
import SystemModules from "./components/SystemModules";
import DataSources from "./components/DataSources";
import Methodology from "./components/Methodology";
import SiteFooter from "./components/SiteFooter";

const DEFAULT_WEIGHTS = () =>
  Object.fromEntries(PILLARS.map((p) => [p.key, p.weight * 100])) as Weights;

export default function LandingPage() {
  const t = useTranslations("landing");
  const [selectedId, setSelectedId] = useState(MPS[0].id);
  const mp = MPS.find((m) => m.id === selectedId) ?? MPS[0];

  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const isDefault = PILLARS.every((p) => weights[p.key] === p.weight * 100);

  const score = useMemo(() => {
    const total = PILLARS.reduce((s, p) => s + weights[p.key], 0) || 1;
    const raw = PILLARS.reduce((s, p) => s + mp.pillars[p.key] * (weights[p.key] / total), 0);
    return Math.round(raw * 10) / 10;
  }, [weights, mp]);

  const onWeightChange = (key: Pillar["key"], value: number) =>
    setWeights((w) => ({ ...w, [key]: value }));

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <SiteHeader />

      {/* ── Hero: hlavní zpráva + živý index ────────────────── */}
      <section id="k-index" className="mx-auto grid max-w-6xl gap-0 px-6 lg:grid-cols-2">
        <HeroStory />
        <LiveSpecimen
          mp={mp}
          score={score}
          weights={weights}
          isDefault={isDefault}
          onSelect={setSelectedId}
          onWeightChange={onWeightChange}
          onReset={() => setWeights(DEFAULT_WEIGHTS())}
        />
      </section>

      {/* ── Žebříček ────────────────────────────────────────── */}
      <section id="k-zebricek" className="border-t-4 border-ink">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
              {t("rankingTitle")}<span className="text-signal">.</span>
            </h2>
            <SourceNote>{t("rankingSource")}</SourceNote>
          </div>
          <div className="mt-4">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-sm text-steel">
            {t("rankingIntro")}
          </p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <Standings selected={mp} onSelect={setSelectedId} />
            <div className="min-w-0 space-y-8">
              <ScoreBreakdown selectedId={selectedId} onSelect={setSelectedId} />
              <TrendChart mp={mp} />
            </div>
          </div>
        </div>
      </section>

      <SystemModules />
      <DataSources />
      <Methodology />
      <SiteFooter />
    </main>
  );
}
