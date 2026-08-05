"use client";

/*
 * Kolizní radar — pás detekcí + kniha nálezů (moonshot 4B).
 *
 * Radar je chronologická kniha nálezů legislativního procesu, jak VSTOUPILY do
 * záznamu: kolize tisků datované okamžikem zápisu do archivu analýzy
 * (generatedAt zdrojového payloadu) a case-① příznaky střetu, které datum
 * detekce poctivě NEMAJÍ — řadí se podle čísla tisku a pravidlo je vypsané,
 * ne zamlčené. Každý nález má trvalou kotvu `#r-<id>` (veřejné API, shodné s
 * guidy feedu `politicas:radar:<id>`) a vložitelný citační blok ke zkopírování
 * (vzor CiteView / CopyExhibitLink: adresa se skládá až na klientu z
 * window.location.origin, selhání schránky se pojmenuje, nikdy tiché nic).
 *
 * Rámování (batch-4 §17, absolutní): nálezy procesu a odvozené příznaky,
 * žádná závažnost, žádná obvinění. Příznaky nesou „vyžaduje lidské ověření“
 * přímo v řádku.
 *
 * POZN. bilingvální pas: entry.titleCs/detailCs/sourceCs jsou obsah záznamu
 * z deriveRadar.ts (sdílený s RSS/JSON feedem, který zůstává český) — render
 * je vypisuje jako data, ne jako UI chrome.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Quote } from "lucide-react";
import { useTranslations } from "next-intl";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import { radarCitationCs, type RadarDay, type RadarEntry } from "../deriveRadar";
import type { RadarData } from "../getRadarData";

/** kolize = signal (nález porovnání textů), příznak = ochre (odvozený,
 * čeká na ověření — stejný tón jako pending jinde v appce). Žádné nové barvy. */
const KIND_TONE: Record<RadarEntry["kind"], { dot: string; text: string; border: string }> = {
  kolize: { dot: "bg-signal", text: "text-signal-deep", border: "border-signal" },
  priznak: { dot: "bg-ochre", text: "text-ochre", border: "border-ochre" },
};

export default function RadarLedger({ radar }: { radar: RadarData }) {
  const t = useTranslations("lawwatch");
  const f = useFormat();

  return (
    <section className="mt-12" aria-label={t("radar.sectionAria")}>
      <SectionHeading
        index={1}
        title={t("radar.title")}
        aside={
          <SourceNote>
            {t("radar.aside", { collisions: radar.collisionCount, flags: radar.flagCount })} ·{" "}
            {radar.newestDetectedAt
              ? t("radar.lastEntry", { date: f.date(radar.newestDetectedAt) })
              : t("radar.noDatedEntries")}
          </SourceNote>
        }
      />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-steel-aa">
        {t.rich("radar.intro", {
          rss: (chunks) => (
            <a href="/zakony/kolize/feed.xml" className="font-mono font-bold uppercase text-signal-deep hover:underline">
              {chunks}
            </a>
          ),
          json: (chunks) => (
            <a href="/zakony/kolize/feed.json" className="font-mono font-bold uppercase text-signal-deep hover:underline">
              {chunks}
            </a>
          ),
        })}
      </p>

      {/* Pás detekcí: jen datované zápisy — nedatovaný dílek by byl lež. */}
      {radar.days.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <div
            className="flex min-w-max items-stretch gap-px border-2 border-ink bg-ink"
            role="list"
            aria-label={t("radar.stripAria")}
          >
            {radar.days.map((d) => (
              <StripDay key={d.day} day={d} dateLabel={f.date(d.day)} />
            ))}
          </div>
        </div>
      )}
      <div className="mt-2">
        <SourceNote>{t("radar.stripSource")}</SourceNote>
      </div>

      {/* Kniha nálezů */}
      <div className="mt-6 border-t-2 border-ink">
        {radar.entries.map((e) => (
          <RadarRow key={e.id} entry={e} dateLabel={e.detectedAt ? f.date(e.detectedAt) : null} />
        ))}
      </div>
    </section>
  );
}

function StripDay({ day, dateLabel }: { day: RadarDay; dateLabel: string }) {
  const t = useTranslations("lawwatch");
  return (
    <div role="listitem" className="flex min-w-[7.5rem] flex-col justify-between bg-paper px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums">{day.total}</span>
        <span className="flex items-center gap-1" aria-hidden>
          {day.collisions > 0 && <span className="inline-block h-2 w-2 bg-signal" />}
          {day.flags > 0 && <span className="inline-block h-2 w-2 bg-ochre" />}
        </span>
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-steel-aa">{dateLabel}</div>
      <span className="sr-only">
        {t("radar.stripSr", { collisions: day.collisions, flags: day.flags, date: dateLabel })}
      </span>
    </div>
  );
}

function RadarRow({ entry, dateLabel }: { entry: RadarEntry; dateLabel: string | null }) {
  const t = useTranslations("lawwatch");
  const tone = KIND_TONE[entry.kind];
  return (
    <article id={entry.anchor} className="scroll-mt-24 border-b border-hairline py-4 target:bg-paper-strong">
      <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 sm:grid-cols-[7rem_auto_1fr]">
        <span className="col-span-2 font-mono text-[11px] uppercase tracking-wider text-steel sm:col-span-1">
          {dateLabel ?? t("radar.undated")}
        </span>
        <span className={`mt-1.5 hidden h-2.5 w-2.5 shrink-0 sm:inline-block ${tone.dot}`} aria-hidden />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`font-mono text-[10px] font-black uppercase tracking-wider ${tone.text}`}>
              {t(`radar.kind.${entry.kind}`)}
            </span>
            <span className="text-[15px] font-bold leading-snug">{entry.titleCs}</span>
            <a
              href={`#${entry.anchor}`}
              className="font-mono text-[10px] uppercase tracking-wider text-steel-aa hover:text-signal"
              aria-label={t("radar.anchorAria", { title: entry.titleCs })}
            >
              #{entry.anchor}
            </a>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-steel-aa">{entry.detailCs}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {entry.bills.map((b) => (
              <Link key={b} href={`/zakony/${b}`} className="font-mono text-[11px] font-bold text-signal-deep hover:text-cobalt">
                {t("printNumbered", { cislo: b })}
              </Link>
            ))}
            {entry.clusterAnchor && (
              <a href={`#${entry.clusterAnchor}`} className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt hover:text-signal">
                {t("radar.clusterDetail")}
              </a>
            )}
          </div>
          <CitationBlock entry={entry} dateLabel={dateLabel} />
          <div className="mt-1">
            <SourceNote className="!text-[10px]">{entry.sourceCs}</SourceNote>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Vložitelný citační blok nálezu — rozbalí připravený text citace s trvalou
 * adresou a zkopíruje ho; adresa se skládá z window.location.origin až na
 * klientu (vzor CiteView), selhání schránky se pojmenuje a text zůstane
 * vypsaný k ručnímu výběru. */
function CitationBlock({ entry, dateLabel }: { entry: RadarEntry; dateLabel: string | null }) {
  const t = useTranslations("lawwatch");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const citationOf = () =>
    radarCitationCs(entry, new URL(`/zakony/kolize#${entry.anchor}`, window.location.origin).toString(), dateLabel);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citationOf());
      setStatus("copied");
    } catch (err) {
      // Clipboard API může být zakázané (permissions, http) — text je vypsaný
      // v bloku níže, takže selhání jen pojmenujeme.
      console.error("kolizní radar: kopírování citace selhalo", err);
      setStatus("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 3600);
  };

  return (
    <div className="mt-1.5">
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
        >
          <Quote className="h-3 w-3" aria-hidden /> {open ? t("radar.citeHide") : t("radar.citeShow")}
        </button>
        <span role="status" aria-live="polite" className="font-mono text-[10px] uppercase tracking-wider">
          {status === "copied" && (
            <span className="inline-flex items-center gap-1 font-bold text-cobalt">
              <Check className="h-3 w-3" aria-hidden /> {t("radar.citeCopied")}
            </span>
          )}
          {status === "failed" && <span className="text-signal-deep">{t("radar.citeFailed")}</span>}
        </span>
      </span>
      {open && (
        <div className="mt-2 max-w-xl border-2 border-ink bg-paper-strong p-3">
          {/* open je vždy důsledek kliknutí na klientu — window tu existuje */}
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink">{citationOf()}</pre>
          <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1.5 border border-ink px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
          >
            {t("radar.citeCopy")}
          </button>
        </div>
      )}
    </div>
  );
}
