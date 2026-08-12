"use client";

/*
 * "Kolize tisků" (/zakony/kolize) — Case ③ drafting-collision surface.
 *
 * Two or more simultaneously-pending sněmovní tisky sometimes independently novelize the
 * SAME § of the SAME statute in incompatible or order-sensitive ways — a normal hazard of
 * a legislature where bills are drafted in parallel, not evidence of anything improper.
 * This page renders the case loop's 4-batch close-read findings, grouped by (statute, §)
 * rather than by bill-pair, since several are genuine N-way clusters.
 *
 * Framing discipline (law-verdict gate, non-negotiable): these are DRAFTING-COORDINATION
 * findings, never verdicts. "Confirmed" here means "grep-verified same-text or same-slot
 * clash", NOT "confirmed wrongdoing" — nobody did anything wrong by drafting a bill; the
 * finding is that the legislature has two incompatible drafts in flight on the same clause.
 * "Incidental" pairs (same §-number, different statute — a data artifact) are excluded
 * entirely; they are noise, not findings.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { CalendarDays, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { billEntityKey } from "@/features/denik/deriveDenik";
import { entityDenikHref } from "@/features/schranka/followCodec";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { CZECH_WITHHELD_CZ } from "@/lib/analysis/language-gate";
import RadarLedger from "./components/RadarLedger";
import { clusterAnchorOf } from "./deriveRadar";
import type { CollisionClassification, CollisionClusterView, CollisionData, CollisionPairView } from "./getCollisionData";
import type { RadarData } from "./getRadarData";

/** confirmed = signal (nejsilnější příznak, stejně jako „možný střet“ jinde v appce);
 * coordination-risk = ochre (měkčí příznak, stejně jako §-diff blok). Žádné nové barvy. */
const CLASS_TONE: Record<CollisionClassification, { border: string; bg: string; text: string }> = {
  "confirmed-collision": { border: "border-signal", bg: "bg-signal/5", text: "text-signal" },
  "coordination-risk": { border: "border-ochre", bg: "bg-ochre/5", text: "text-ochre" },
};

/** psp.cz historie tisku (PSP10 = o=10) — jediný stabilní veřejný odkaz na tisk. */
const pspBillUrl = (cislo: number) => `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}`;

export default function CollisionsPage({ data, radar }: { data: CollisionData | null; radar: RadarData | null }) {
  const t = useTranslations("lawwatch");
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">{t("collisions.crumb")}</span>
          </div>
          {/* Strojově čitelné podoby knihy nálezů — veřejné API radaru. */}
          <div className="flex items-center gap-4">
            <a
              href="/zakony/kolize/feed.xml"
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              RSS
            </a>
            <a
              href="/zakony/kolize/feed.json"
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              JSON
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        <div className="py-10">
          <SourceNote tone="signal">{t("collisions.eyebrow")}</SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            {t("collisions.title")}<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            {data ? t("collisions.introReal") : t("collisions.introUnavailable")}
          </p>
        </div>

        {radar && radar.entries.length > 0 ? <RadarLedger radar={radar} /> : <RadarEmptyState />}

        {data ? <RealCollisions data={data} /> : <EmptyState />}
      </div>
    </main>
  );
}

function EmptyState() {
  const t = useTranslations("lawwatch");
  return (
    <div className="mb-20 border-2 border-dashed border-hairline bg-paper-strong px-6 py-10 text-center">
      <p className="text-sm text-steel">{t("collisions.emptyData")}</p>
    </div>
  );
}

/** Radar bez nálezů nebo bez dat — poctivé prázdno, žádná fabrikace. */
function RadarEmptyState() {
  const t = useTranslations("lawwatch");
  return (
    <div className="mt-12 border-2 border-dashed border-hairline bg-paper-strong px-6 py-8 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-steel">{t("collisions.radarEmptyLabel")}</p>
      <p className="mt-2 text-sm text-steel">{t("collisions.radarEmptyText")}</p>
    </div>
  );
}

function RealCollisions({ data }: { data: CollisionData }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();
  return (
    <>
      {/* Statistický pás */}
      <div className="grid grid-cols-2 gap-px border-2 border-ink bg-ink sm:grid-cols-4">
        {/* Čtyři čísla pásu přes `lib/format.ts` — `useFormat` je tu vázaný od
            začátku a čísla ho přesto míjela, takže se sázela syrovým JS. */}
        {[
          { v: f.int(data.confirmedPairCount), l: t("collisions.stats.confirmed") },
          { v: f.int(data.coordinationRiskPairCount), l: t("collisions.stats.risks") },
          { v: f.int(data.clusterCount), l: t("collisions.stats.clusters") },
          { v: f.int(data.nWayClusterCount), l: t("collisions.stats.nWay") },
        ].map((s) => (
          <div key={s.l} className="bg-paper px-4 py-4">
            <div className="text-3xl font-black tabular-nums">{s.v}</div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <SourceNote>
          {t("collisions.statsSource", {
            batches: data.batchesRun,
            batchesFmt: f.int(data.batchesRun),
          })}
        </SourceNote>
      </div>
      {/* Vyřazené nahodilé dvojice se počítají a přiznávají. Pravidlo („stejné číslo §,
          jiný zákon") stálo v citaci pod pásem už dřív, ale bez čísla — a čtyři čísla nad
          ním pak vypadala jako celý výstup ručního porovnání, ne jako jeho zbytek.
          (Precedens: `droppedImplausible` v deníku.) */}
      {data.incidentalPairCount > 0 && (
        <div className="mt-2">
          <SourceNote>
            {t("collisions.incidentalDropped", {
              count: data.incidentalPairCount,
              countFmt: f.int(data.incidentalPairCount),
            })}
          </SourceNote>
        </div>
      )}
      {data.czechPendingCount > 0 && (
        <div className="mt-2 border-2 border-dashed border-ochre bg-ochre/5 px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ochre">
            {t("collisions.czechPending", {
              count: data.czechPendingCount,
              countFmt: f.int(data.czechPendingCount),
            })}
          </p>
        </div>
      )}

      <section className="mt-12 pb-20">
        <SectionHeading
          index={2}
          title={t("collisions.clustersTitle")}
          aside={
            <SourceNote>
              {t("collisions.clustersAside", {
                clusters: data.clusterCount,
                clustersFmt: f.int(data.clusterCount),
                pairs: data.confirmedPairCount + data.coordinationRiskPairCount,
                pairsFmt: f.int(data.confirmedPairCount + data.coordinationRiskPairCount),
              })}
            </SourceNote>
          }
        />
        <div className="mt-8 space-y-8">
          {data.clusters.map((c) => (
            <ClusterCard key={c.key} cluster={c} />
          ))}
        </div>
        <p className="mt-10 max-w-3xl border-t-2 border-ink pt-4 text-sm italic leading-relaxed text-steel">
          {t("collisions.clustersFootnote")}
        </p>
      </section>
    </>
  );
}

function ClusterCard({ cluster }: { cluster: CollisionClusterView }) {
  const t = useTranslations("lawwatch");
  const reduceMotion = useReducedMotion();
  const tone = CLASS_TONE[cluster.classification];
  const nWay = cluster.bills.length >= 3;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.25 }}
      // Kotva shluku (`#k-<zákon>-<§>`) — cíl odkazu „detail shluku" z knihy
      // nálezů radaru; stejná sanitizace jako v deriveRadar.clusterAnchorOf.
      id={clusterAnchorOf(cluster.key)}
      className={`scroll-mt-24 border-2 ${tone.border} target:bg-paper-strong`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b-2 ${tone.border} ${tone.bg} px-4 py-3`}>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-sm font-bold text-signal">č. {cluster.lawRef} Sb.</span>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink">§ {cluster.paragraph}</span>
          {nWay && (
            <span className="border border-ink bg-ink px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-paper">
              {t("collisions.nWayBadge", { count: cluster.bills.length })}
            </span>
          )}
        </div>
        <SourceNote tone="steel" className={`!${tone.text}`}>
          {t(`collisions.class.${cluster.classification}`)}
        </SourceNote>
      </div>

      <div className="px-4 py-4">
        {cluster.lawTitle && <p className="text-sm leading-snug text-steel">{cluster.lawTitle}</p>}

        {/* dotčené tisky — dosje na /zakony/[cislo] (restrukturalizace), datované kroky
            v deníku republiky (týž veřejný klíč `tisk:<číslo>`, klíč staví builder deníku
            a adresu kodek schránky — ani jedno se tu neopisuje), historie na psp.cz.
            Kolize je nález o SOUBĚHU dvou tisků v čase; bez deníku si čtenář jejich
            časovou osu nemá kde přečíst. */}
        <div className="mt-2 flex flex-wrap gap-2">
          {cluster.bills.map((b) => (
            <span
              key={b.cislo}
              className="group inline-flex max-w-full items-center gap-1.5 border-2 border-hairline px-3 py-1.5 transition-colors hover:border-ink hover:bg-paper-strong"
              title={b.title ?? undefined}
            >
              <Link href={`/zakony/${b.cislo}`} className="whitespace-nowrap font-mono text-xs font-bold text-signal hover:text-cobalt">
                {t("printNumbered", { cislo: b.cislo })}
              </Link>
              {b.title && <span className="truncate text-[13px] font-medium">{b.title}</span>}
              <Link
                href={entityDenikHref(billEntityKey(b.cislo))}
                title={t("collisions.denikLink", { cislo: b.cislo })}
                aria-label={t("collisions.denikLink", { cislo: b.cislo })}
                className="shrink-0 text-steel opacity-0 transition-opacity group-hover:opacity-100 hover:text-cobalt"
              >
                <CalendarDays className="h-3 w-3" />
              </Link>
              <a
                href={pspBillUrl(b.cislo)}
                target="_blank"
                rel="noreferrer"
                title={t("detail.pspHistory")}
                className="shrink-0 text-steel opacity-0 transition-opacity group-hover:opacity-100 hover:text-signal"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          ))}
        </div>

        {/* dvojice v rámci shluku */}
        <div className="mt-5 space-y-3">
          {cluster.pairs.map((p) => (
            <PairCard key={p.pairId} pair={p} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function PairCard({ pair }: { pair: CollisionPairView }) {
  const t = useTranslations("lawwatch");
  const [open, setOpen] = useState(false);
  const tone = CLASS_TONE[pair.classification];
  const hasEvidence = pair.evidence.billAExcerpt || pair.evidence.billBExcerpt;

  return (
    <div className={`border-l-4 ${tone.border} bg-paper-strong/60 pl-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
        {/* VEŘEJNÉ číslo tisku, ne interní id. `billA`/`billB` nesou totéž číslo, jaké
            o dva řádky níž popisky citací předávají jako `cislo` a jakým je klíčovaný
            dosje /zakony/<cislo> — přesto se tu sázela zpráva „tisk {tiskId}", takže
            272 karet nálezů pojmenovávalo tisk špatným rejstříkem a nevedlo nikam.
            Odkaz je týž vzor jako v hlavičce shluku výš. */}
        <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-bold">
          <Link
            href={`/zakony/${pair.billA}`}
            className="text-signal underline decoration-hairline underline-offset-2 transition-colors hover:text-cobalt"
          >
            {t("printNumbered", { cislo: pair.billA })}
          </Link>
          <span className="text-steel">×</span>
          <Link
            href={`/zakony/${pair.billB}`}
            className="text-signal underline decoration-hairline underline-offset-2 transition-colors hover:text-cobalt"
          >
            {t("printNumbered", { cislo: pair.billB })}
          </Link>
          <span className="font-mono text-[11px] font-normal uppercase tracking-wider text-steel">
            § {pair.sharedParagraph}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className="border border-hairline px-1 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-steel"
            title={t("collisions.batchTitle")}
          >
            {t("collisions.batchBadge", { batch: pair.sourceBatch })}
          </span>
          <span className={`font-mono text-[10px] font-black uppercase tracking-wider ${tone.text}`}>
            {t(`collisions.class.${pair.classification}`)}
          </span>
        </span>
      </div>

      {pair.reasoning ? (
        <p className={`pb-2 text-[13px] leading-relaxed text-steel ${open ? "" : "line-clamp-2"}`}>{pair.reasoning}</p>
      ) : pair.reasoningWithheld ? (
        <p className="pb-2 text-[13px] italic leading-relaxed text-steel/70">{CZECH_WITHHELD_CZ}</p>
      ) : null}

      {open && hasEvidence && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {pair.evidence.billAExcerpt && (
            <div className="border-l-4 border-hairline bg-paper p-3">
              <SourceNote className="!text-[10px]">
                {t("collisions.excerptLabel", { cislo: pair.billA })}
              </SourceNote>
              <p className="mt-1.5 text-[12px] leading-relaxed text-steel">{pair.evidence.billAExcerpt}</p>
            </div>
          )}
          {pair.evidence.billBExcerpt && (
            <div className="border-l-4 border-hairline bg-paper p-3">
              <SourceNote className="!text-[10px]">
                {t("collisions.excerptLabel", { cislo: pair.billB })}
              </SourceNote>
              <p className="mt-1.5 text-[12px] leading-relaxed text-steel">{pair.evidence.billBExcerpt}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {open
            ? t("less")
            : hasEvidence
              ? t("collisions.fullReasoningWithQuotes")
              : t("collisions.fullReasoning")}
        </button>
        <SourceNote className="!text-[10px]">
          {t("collisions.pairSource", { batch: pair.sourceBatch, method: pair.sourceMethod })}
        </SourceNote>
      </div>
    </div>
  );
}
