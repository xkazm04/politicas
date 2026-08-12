"use client";

/*
 * LawWatch — monitor legislativy (/zakony, roadmapa Fáze 3).
 * REÁLNÁ data z grafu Case ③: sněmovní tisky → zákony, které novelizují
 * (hrana `amends`), předkladatelé (proklik na profil poslance), příznak
 * možného střetu zájmů z peněžních vazeb předkladatele (Case ①), formální
 * přikázání výborům (hrana `assigned_to`, F15: garanční / další, stav, datum) a
 * — u tisků, které jej nesou — gatovaný forenzní posudek (návrh k revizi, ne
 * publikovaný verdikt) a — u zákonů, kde jsme jej reálně dopočítali z e-Sbírky
 * (SPARQL point-query, ne smyšlená data) — skutečný §-diff mezi dvěma platnými
 * zněními. Když graf není dostupný, spadne stránka na jasně označený ukázkový mock.
 */

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import type { DependencyData } from "./getDependencyData";
import type { BillOrigin } from "./getLawData";
import { TOP_LAWS_RENDERED, type LawWatchWire } from "./publicWire";
import { statuteSlug } from "./statuteRef";
import BillBrowser from "./components/BillBrowser";
import DependencyRadar from "./components/DependencyRadar";
import ForensicIndexSection from "./components/ForensicIndexSection";

/** Ukázková plocha (graf nedostupný) je vlastní modul načtený až za běhu:
 *  `lib/civic/data.ts` sem tahal 27 kB mocku do parse cesty KAŽDÉHO návštěvníka,
 *  přestože se vykreslí jen při výpadku store. `next/dynamic` BEZ `ssr: false` —
 *  fallback se dál renderuje na serveru (vzor /penize a /dashboard). */
const MockLawWatch = dynamic(() => import("./components/MockLawWatch"));

export default function LawWatchPage({
  lawData,
  dependencyData,
}: {
  /** Už projitý veřejnou projekcí (features/lawwatch/publicWire.ts) — plný `LawData`
   *  sem nikdy nedorazí; posudky a §-diffy patří dosje /zakony/[cislo]. */
  lawData: LawWatchWire | null;
  dependencyData: DependencyData | null;
}) {
  const t = useTranslations("lawwatch");

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ lawwatch</span>
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
            {lawData ? t("realIntro") : t("intro")}
          </p>
        </div>

        {lawData ? <RealLawWatch data={lawData} dependencyData={dependencyData} /> : <MockLawWatch />}
      </div>
    </main>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * REÁLNÁ data — bill → law spine
 * ════════════════════════════════════════════════════════════════════════ */

function RealLawWatch({ data, dependencyData }: { data: LawWatchWire; dependencyData: DependencyData | null }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();

  const originOrder: BillOrigin[] = ["government", "mp_group", "mp", "senate", "other"];

  return (
    <>
      {/* Statistický pás */}
      <div className="grid grid-cols-2 gap-px border-2 border-ink bg-ink sm:grid-cols-4">
        {[
          { v: f.int(data.totalBills), l: t("stats.bills") },
          { v: f.int(data.totalLaws), l: t("stats.laws") },
          { v: f.int(data.totalAmends), l: t("stats.links") },
          { v: f.int(data.flaggedCount), l: t("stats.flagged") },
        ].map((s) => (
          <div key={s.l} className="bg-paper px-4 py-4">
            <div className="text-3xl font-black tabular-nums">{s.v}</div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {/* „?" místo průchodu byl otazník vydávaný za citaci. Když uzly tisků
            provenienci nenesou, řekne se to větou — vzor `forensicIndex.sourceNoPass`
            hned pod touhle sekcí. */}
        <SourceNote>
          {data.pass !== null
            ? t("statsSource", { pass: data.pass, committeeRouted: f.int(data.committeeRoutedBills) })
            : t("statsSourceNoPass", { committeeRouted: f.int(data.committeeRoutedBills) })}
        </SourceNote>
        <span className="flex flex-wrap gap-x-3 font-mono text-[11px] uppercase tracking-wider text-steel">
          {originOrder
            .filter((o) => data.originCounts[o])
            .map((o) => (
              <span key={o}>
                {t(`origin.${o}`)} <span className="font-bold text-ink">{f.int(data.originCounts[o] ?? 0)}</span>
              </span>
            ))}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-signal bg-signal/5 px-4 py-3">
        <p className="text-[13px] leading-snug">
          <span className="font-black uppercase tracking-wide text-signal">{t("radarBanner.title")}</span> —{" "}
          {t("radarBanner.text")}
        </p>
        <Link
          href="/zakony/kolize"
          className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-signal transition-colors hover:text-cobalt"
        >
          {t("radarBanner.cta")} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-2 border-cobalt bg-cobalt/5 px-4 py-3">
        <p className="text-[13px] leading-snug">
          <span className="font-black uppercase tracking-wide text-cobalt">{t("memoryBanner.title")}</span> —{" "}
          {t("memoryBanner.textBefore")} <span className="font-mono">#p-&lt;§&gt;</span>{" "}
          {t("memoryBanner.textAfter")}
        </p>
        <Link
          href="/zakony/predpis"
          className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {t("memoryBanner.cta")} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── 01 Bill browser: filtr + hledání + detailní dosje na /zakony/[cislo] ── */}
      <section id="tisky" className="mt-12 pb-4">
        <SectionHeading
          index={1}
          title={t("realSection1Title")}
          aside={
            <SourceNote>
              {t("section1AsideReal", {
                bills: f.int(data.totalBills),
                summaries: f.int(data.summaryCount),
                amends: f.int(data.totalAmends),
              })}
            </SourceNote>
          }
        />
        <div className="mt-8">
          <BillBrowser data={data} />
        </div>
      </section>

      {/* ── 02 Nejčastěji novelizované zákony ─────────────── */}
      <section id="zakony" className="mt-14 border-t-4 border-ink pt-10 pb-20">
        <SectionHeading
          index={2}
          title={t("realSection2Title")}
          aside={<SourceNote>{t("section2AsideReal")}</SourceNote>}
        />
        <div className="mt-8 border-t-2 border-ink">
          {/* Strop je JEDNA konstanta sdílená se serverem (publicWire.ts): server řeže
              seznam na to, co se tady vykreslí, a kdyby si každá strana držela vlastní
              číslo, jedna by tiše vezla víc nebo míň, než druhá umí ukázat. */}
          {data.topLaws.slice(0, TOP_LAWS_RENDERED).map((l) => {
            const slug = statuteSlug(l.ref);
            const row = (
              <>
                <span className="min-w-0">
                  <span className="block font-mono text-xs font-bold text-signal">č. {l.ref} Sb.</span>
                  {l.title && <span className="mt-0.5 block text-[15px] font-bold leading-snug">{l.title}</span>}
                </span>
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black tabular-nums">{f.int(l.billCount)}</span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                      {t("billCountWord", { count: l.billCount })}
                    </span>
                  </span>
                  {slug && (
                    <ArrowUpRight className="h-4 w-4 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </span>
              </>
            );
            return slug ? (
              <Link
                key={l.urn}
                href={`/zakony/predpis/${slug}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-6 border-b border-hairline px-2 py-4 transition-colors hover:bg-paper-strong"
              >
                {row}
              </Link>
            ) : (
              <div
                key={l.urn}
                className="grid grid-cols-[1fr_auto] items-center gap-6 border-b border-hairline px-2 py-4"
              >
                {row}
              </div>
            );
          })}
        </div>
        {/* STROP SE PŘIZNÁVÁ. Dvacet řádků je řez, ne výstup — a dokud se řez
            nepojmenoval, četl se jako „tolik zákonů někdo novelizuje". Populace se
            počítá na serveru PŘED řezem (publicWire.ts `topLawsTotal`); `totalLaws`
            to není, ten počítá všechny uzly zákonů v grafu, tedy jinou množinu. */}
        {data.topLawsTotal > data.topLaws.length && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <SourceNote>
              {t("section2Capped", {
                shownFmt: f.int(data.topLaws.length),
                total: data.topLawsTotal,
                totalFmt: f.int(data.topLawsTotal),
              })}
            </SourceNote>
            <Link
              href="/zakony/predpis"
              className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {t("section2RegistryLink")}
            </Link>
          </div>
        )}
        <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
          {t("titleLinkNote")}{" "}
          {data.paragraphDiffCount > 0
            ? t("titleLinkNoteDiff", {
                count: data.paragraphDiffCount,
                countFmt: f.int(data.paragraphDiffCount),
              })
            : t("titleLinkNoteNoDiff")}
        </p>
        {data.censusBillCount > 0 && (
          <p className="mt-3 max-w-3xl border-l-4 border-ochre bg-ochre/5 p-4 text-sm leading-relaxed">
            <span className="font-black uppercase tracking-wide text-ochre">{t("honesty.label")} </span>
            {t.rich("honesty.text", {
              census: f.int(data.censusBillCount),
              undercount: f.int(data.censusUndercountTotal),
              b: (chunks) => <span className="font-black">{chunks}</span>,
            })}
          </p>
        )}
      </section>

      {/* ── 03 Rejstřík forenzních posudků ─────────────────────────────
          Vykresluje se VŽDY, když jsou reálná data — i s nulou posudků má
          vlastní poctivý prázdný stav. Sekce s kotvou v levém pruhu nesmí
          někdy zmizet (pravidlo z /poslanec: rail nenabízí kotvu, která
          občas nikam nevede), a proto stojí mimo podmínku níže. */}
      <ForensicIndexSection data={data} index={3} />

      {/* ── 04 Závislosti na doprovodných tiscích (batch-014 census) ────
          Vykresluje se VŽDY, když jsou reálná data — stejně jako rejstřík posudků
          nad ním. Kotva `#zavislosti` je od téhle změny v levém pruhu, a pruh nesmí
          nabízet kotvu, která někdy nikam nevede; nečitelný census proto sekci
          neruší, jen v ní stojí přiznané prázdno. */}
      <DependencyRadar data={data} dependencyData={dependencyData} index={4} />
    </>
  );
}
