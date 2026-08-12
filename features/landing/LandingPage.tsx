"use client";

/**
 * Landing Politicas — vítězná výtvarná řeč „Konstrukt" (sutnarovský
 * funkcionalistický plakát). Od 2026-08-05 stojí na REÁLNÝCH datech:
 * server (app/page.tsx) čte týž loader jako /zebricek a sem posílá špičku
 * žebříčku + vektor skóre; ukázková data z lib/civic/data.ts titulní strana
 * už nečte. Orchestrátor drží jediný sdílený stav (vybraný poslanec +
 * čtenářovy váhy) a skládá sekce; vizuální detaily žijí v components/.
 *
 * Váhová interakce zrcadlí pravidlo čočky (features/civicscore/lens.ts):
 * při zveřejněných vahách se ukazuje autoritativní contribution_score
 * z grafu; jakmile se váhy liší, VŠE pochází z přepočtu a nese označení
 * „vaše váhy". Nikdy se ty dva režimy nemíchají.
 *
 * `data === null` = store nedostupný → poctivý degradovaný stav
 * (LiveDataNotice + panel ve stylu DataUnavailable), nikdy mock.
 */

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ComponentDef, LeaderboardListEntry } from "@/features/civicscore/getLeaderboardData";
import {
  effectiveWeights,
  isPublishedWeights,
  LENS_COMPONENT_ORDER,
  PUBLISHED_WEIGHTS,
  PUBLISHED_WEIGHTS_LABEL,
  type WeightVector,
} from "@/features/civicscore/lens";
import type { ContributionProvenance } from "@/features/civicscore/provenance";
import { contributionScoreClaim } from "@/features/civicscore/scoreClaim";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import LiveDataNotice from "@/features/shared/components/LiveDataNotice";
import type { LandingSourceState } from "./sourceStates";
import SiteHeader from "./components/SiteHeader";
import HeroStory from "./components/HeroStory";
import LiveSpecimen from "./components/LiveSpecimen";
import Standings from "./components/Standings";
import ReferendumTeaser from "./components/ReferendumTeaser";
import SystemModules from "./components/SystemModules";
import DataSources from "./components/DataSources";
import Methodology from "./components/Methodology";
import SiteFooter from "./components/SiteFooter";

/*
 * Skládaný rozklad skóre je JEDINÁ plocha fasády, která kreslí recharts —
 * a vykreslí se jen tehdy, když je store dostupný (`data && mp`). Statickým
 * importem přesto celá knihovna vstupovala do PRVNÍHO NAČTENÍ titulní strany
 * (změřeno 401 838 B syrově / 116 667 B gz = 27 % first-loadu), tedy i každému
 * čtenáři, kterému graf nikdy nenaběhne.
 *
 * `next/dynamic` BEZ `ssr: false` — doktrína repa (/penize, /zakony,
 * /dashboard): fallback i tenhle graf se dál renderují na serveru, mění se jen
 * to, co musí prohlížeč rozparsovat, než stránka ožije. Poctivá mez: recharts
 * se tím nemaže, jen odchází z kritické cesty.
 */
const ScoreBreakdown = dynamic(() => import("./components/ScoreBreakdown"));

/** Co titulní strana skutečně vykreslí — server ji sestaví z loaderu /zebricek. */
export interface LandingData {
  /** Špička žebříčku (competition ranking), v pořadí loaderu. */
  featured: LeaderboardListEntry[];
  /** Skóre všech poslanců, řazeno sestupně — hemicykl. */
  scores: number[];
  /** Kolik poslanců index pokrývá (207). */
  count: number;
  /** Šest zveřejněných složek (label/weight/source) — z loaderu, ne kopie. */
  components: ComponentDef[];
  /** Komorový agregát `{pass, ref}` — základ citace skóre (scoreClaim.ts,
   *  pravidlo 2: půlkou přepočtená komora nemá jednu provenienci a claim
   *  pak žádný základ nenese). */
  provenance: ContributionProvenance;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Přepočet jednoho poslance pod čtenářovými vahami — TÝŽ vzorec jako
 *  lens.reweigh (míra naplnění × efektivní váha), jen pro jeden řádek. */
function lensScore(e: LeaderboardListEntry, weights: WeightVector): number {
  const eff = effectiveWeights(weights);
  let s = 0;
  for (const k of LENS_COMPONENT_ORDER) {
    const pub = PUBLISHED_WEIGHTS[k];
    s += (pub > 0 ? clamp01(e.components[k] / pub) : 0) * eff[k];
  }
  return round1(s);
}

export default function LandingPage({
  data,
  sources,
  denikSlot,
}: {
  data: LandingData | null;
  /** Měřený stav zdrojů z atlasu kvality; `null` = atlas nečitelný. Degraduje
   *  NEZÁVISLE na žebříčku — dvě vrstvy, dvě čtení, dvě přiznání. */
  sources: LandingSourceState[] | null;
  /**
   * Rubrika „Dnešní zápis" jako HOTOVÝ UZEL ze serveru (app/page.tsx:
   * `<Suspense fallback={<DenikTeaserPending/>}><DenikSlot/></Suspense>`).
   *
   * Proč slot a ne props: odečet deníku je server-only a studený stojí ~12 s,
   * takže musí streamovat — a hranice `<Suspense>` se dá otevřít jen tam, kde
   * ten serverový komponent vzniká. Titulní strana je klient (drží vybraného
   * poslance a čtenářovy váhy), takže rubrika k ní doputuje jako uzel, ne jako
   * data. Precedens: `ProfilePage`'s `rebellionSlot`.
   */
  denikSlot: ReactNode;
}) {
  const t = useTranslations("landing");

  const featured = data?.featured ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(featured[0]?.pspId ?? null);
  const mp = featured.find((e) => e.pspId === selectedId) ?? featured[0] ?? null;

  const [weights, setWeights] = useState<WeightVector>({ ...PUBLISHED_WEIGHTS });
  const isDefault = isPublishedWeights(weights);

  // Zveřejněné váhy → autoritativní skóre z grafu; jinak přepočet čočkou.
  const score = useMemo(() => {
    if (!mp) return 0;
    return isDefault ? mp.score : lensScore(mp, weights);
  }, [mp, weights, isDefault]);

  // Citace se razí JEN nad zveřejněným kompozitem — týmž čistým razidlem, jaké
  // používá spis i karta kraje (žádná druhá ražba téže figury). Pod čtenářovou
  // čočkou se ZADRŽUJE: přepočtené číslo v grafu nikde nestojí, takže by
  // adresa vedla k něčemu, co nelze ověřit.
  const scoreClaim = useMemo(
    () =>
      mp && data && isDefault
        ? contributionScoreClaim(mp.pspId, mp.score, data.provenance).claim
        : undefined,
    [mp, data, isDefault],
  );

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <SiteHeader />

      {/* ── Hero: hlavní zpráva + živý index ────────────────── */}
      <section id="k-index" className="mx-auto grid max-w-6xl gap-0 px-6 lg:grid-cols-2">
        <HeroStory scores={data?.scores ?? null} count={data?.count ?? null} />
        {mp && data ? (
          <LiveSpecimen
            mp={mp}
            featured={featured}
            components={data.components}
            total={data.count}
            score={score}
            claim={scoreClaim}
            weights={weights}
            isDefault={isDefault}
            onSelect={setSelectedId}
            onWeightChange={(key, value) => setWeights((w) => ({ ...w, [key]: value }))}
            onReset={() => setWeights({ ...PUBLISHED_WEIGHTS })}
          />
        ) : (
          <SpecimenUnavailable />
        )}
      </section>

      {/* ── Žebříček (reálná špička; plný na /zebricek) ─────── */}
      <section id="k-zebricek" className="border-t-4 border-ink">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
              {t("rankingTitle")}<span className="text-signal">.</span>
            </h2>
            <SourceNote>{t("rankingSource", { weights: PUBLISHED_WEIGHTS_LABEL })}</SourceNote>
          </div>
          <div className="mt-4">
            <SectionRule />
          </div>
          {data && mp ? (
            <>
              <p className="mt-4 max-w-2xl text-sm text-steel-aa">
                {t("rankingIntro", { count: data.count })}
              </p>
              <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
                <Standings
                  entries={featured}
                  total={data.count}
                  selectedId={mp.pspId}
                  onSelect={setSelectedId}
                />
                <ScoreBreakdown
                  entries={featured}
                  components={data.components}
                  selectedId={mp.pspId}
                  onSelect={setSelectedId}
                />
              </div>
            </>
          ) : (
            <div className="mt-8">
              <LiveDataNotice
                title={t("unavailableTag")}
                body={t("unavailableBody")}
                source={t("unavailableSource")}
              />
              <Link
                href="/zebricek"
                className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                {t("standingsAllShort")} →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Dnešní zápis — rubrika Deníku republiky (moonshot 3A), streamovaná ── */}
      {denikSlot}

      {/* ── Referendum o metodice — tři redakční čočky (moonshot 7B) ── */}
      <ReferendumTeaser count={data?.count ?? null} />

      <SystemModules />
      <DataSources sources={sources} />
      <Methodology />
      <SiteFooter />
    </main>
  );
}

/** Pravá polovina hero, když je store nedostupný — stylová řeč
 *  DataUnavailable (poctivé „teď nelze načíst", nikdy mock). */
function SpecimenUnavailable() {
  const t = useTranslations("landing");
  return (
    <div className="py-14 lg:pl-12">
      <SourceNote tone="signal">{t("unavailableTag")}</SourceNote>
      <h2 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight">
        {t("unavailableTitle")}<span className="text-signal">.</span>
      </h2>
      <div className="mt-4 max-w-md">
        <SectionRule />
      </div>
      <p className="mt-4 max-w-md text-base leading-relaxed text-steel-aa">
        {t("unavailableBody")}
      </p>
      <SourceNote className="mt-6">{t("unavailableSource")}</SourceNote>
    </div>
  );
}
