"use client";

/*
 * Rebelie po jménech — instance pod mírou.
 *
 * Oddíl tiskl jen agregát („18,4 % · 47 z 255"), tedy jediné číslo na spisu,
 * které si čtenář nemohl otevřít. Tady jsou jmenovitá hlasování, ve kterých
 * poslanec hlasoval proti linii vlastního klubu: datum, jak hlasoval on, jak
 * stál klub, o čem se hlasovalo — a dvě adresy téhož hlasování (deník
 * /hlasovani, když je v jeho okně, a veřejná stránka psp.cz vždy).
 *
 * PRAVIDLA
 *  • Pravidlo rebelie se tu NEPOČÍTÁ. Řádky vydává táž derivace, ze které žije
 *    /hlasovani (features/votetrack/record/derive.ts); spis mění jediný
 *    PREZENTAČNÍ strop, který ta derivace sama nabízí.
 *  • Strop řádků se přiznává, zbytek se počítá — nikdy nemizí.
 *  • Kotva na /hlasovani se vykreslí jen tehdy, když tam to hlasování opravdu
 *    je (okno deníku); jinak by odkaz vedl do prázdna.
 *  • Poslanec bez jediné rebelie dostane čestný prázdný stav, ne skrytý oddíl.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import type { ProfileRebellionRecord } from "../rebellionRecord";

/** Fallback pro `<Suspense>`, dokud se hlasovací záznam čte. Říká, co se děje —
 *  tiché prázdno by se nedalo odlišit od poslance, který nikdy nerebeloval. */
export function RebellionInstancesPending() {
  const t = useTranslations("profile");
  return (
    <p className="mt-6 max-w-3xl border-l-4 border-hairline pl-4 text-[13px] leading-relaxed text-steel">
      {t("rebelInstancesPending")}
    </p>
  );
}

export default function RebellionInstances({ record }: { record: ProfileRebellionRecord | null }) {
  const t = useTranslations("profile");
  const f = useFormat();

  if (record === null) {
    // Záznam hlasování se nepodařilo přečíst. Prázdný seznam by tady tvrdil, že
    // poslanec proti klubu nikdy nehlasoval — to je výrok o člověku, ne o nás.
    return (
      <p className="mt-6 max-w-3xl border-l-4 border-ochre pl-4 text-[13px] leading-relaxed text-steel">
        {t("rebelInstancesUnavailable")}
      </p>
    );
  }

  if (record.total === 0) {
    return (
      <p className="mt-6 max-w-3xl border-l-4 border-hairline pl-4 text-[13px] leading-relaxed text-steel">
        {t("rebelInstancesNone", { votes: f.int(record.coverage.votes) })}
      </p>
    );
  }

  return (
    <div className="mt-8">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
        {t("rebelInstancesHeading")}
      </p>
      <div className="mt-3 border-t-2 border-ink">
        {record.instances.map((r) => (
          <div key={r.votePspId} className="border-b border-hairline px-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-steel">
                {r.votedOn ? f.date(r.votedOn) : t("rebelInstanceNoDate")}
              </span>
              <span className="flex flex-wrap items-center gap-4">
                {r.appHref && (
                  <Link
                    href={r.appHref}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal motion-reduce:transition-none"
                  >
                    {t("rebelInstanceLedgerLink")}
                    <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                  </Link>
                )}
                <a
                  href={r.pspUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-steel transition-colors hover:text-ink motion-reduce:transition-none"
                >
                  {t("rebelInstancePspLink")}
                  <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
                </a>
              </span>
            </div>
            <p className="mt-1 text-[15px] leading-relaxed">
              {t.rich("rebelInstanceSentence", {
                club: r.club,
                own: (chunks) => (
                  <span
                    className={`font-mono text-sm font-bold uppercase ${r.choice === "yes" ? "text-cobalt" : "text-signal-deep"}`}
                  >
                    {chunks}
                  </span>
                ),
                ownVote: r.choice === "yes" ? t("rebelVoteYes") : t("rebelVoteNo"),
                lineVote: r.line === "yes" ? t("rebelVoteYes") : t("rebelVoteNo"),
              })}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-steel">{r.title}</p>
          </div>
        ))}
      </div>
      {record.total > record.instances.length && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel">
          {t("rebelInstancesMore", {
            shown: f.int(record.instances.length),
            total: f.int(record.total),
          })}
        </p>
      )}
      <SourceNote className="mt-3 !text-[10px]">
        {t("rebelInstancesSource", {
          votes: f.int(record.coverage.votes),
          from: record.coverage.from ? f.date(record.coverage.from) : "—",
          to: record.coverage.to ? f.date(record.coverage.to) : "—",
        })}
      </SourceNote>
    </div>
  );
}
