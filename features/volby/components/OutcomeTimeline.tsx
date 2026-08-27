/*
 * Časová osa výsledků — svislá stuha v idiomu kariérního spisu
 * (profile/CareerSpineSection): datový sloupec v mono verzálkách, tónová
 * tečka, věta z typovaných polí. Každý řádek je rozhodnutí (decidedOn) →
 * pozdější doložený fakt (laterOn, laterKind), který dnes o něm graf drží.
 * Řadí ji pravidlo (rules.outcomeTimeline, sestupně podle laterOn) — tady se
 * jen sází.
 */

import Link from "next/link";
import SourceNote from "@/features/shared/components/SourceNote";
import type { Finding } from "@/lib/analysis/volby/types";
import type { VolbyIntl } from "../volbyIntl";
import { SEVERITY_CHIP, VALENCE_DOT, ruleHref } from "../labels";

export default function OutcomeTimeline({
  timeline,
  t,
  f,
}: {
  timeline: readonly Finding[];
  t: VolbyIntl["t"];
  f: VolbyIntl["f"];
}) {
  if (timeline.length === 0) {
    return <p className="border-l-4 border-hairline pl-4 text-[15px] leading-relaxed text-steel-aa">{t("sections.timelineEmpty")}</p>;
  }
  return (
    <div className="border-l-2 border-ink">
      {timeline.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline py-3 pl-4 pr-2 sm:grid-cols-[5.5rem_auto_1fr]"
        >
          <span className="col-span-2 font-mono text-[11px] uppercase tracking-wider text-steel sm:col-span-1">
            {item.laterOn ? f.date(item.laterOn) : "—"}
          </span>
          <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${VALENCE_DOT[item.valence]}`} aria-hidden />
          <span className="min-w-0 text-[15px] leading-relaxed">
            <span className="font-bold">{item.laterKind ? t(`later.${item.laterKind}`) : "—"}</span>
            <span className="text-steel"> · </span>
            <Link href={`#${item.id}`} className="font-black uppercase tracking-tight transition-colors hover:text-signal">
              {t(`kind.${item.kind}`)}
            </Link>
            <span
              className={`ml-2 inline-block border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${SEVERITY_CHIP[item.severity]}`}
            >
              {t(`severity.${item.severity}`)}
            </span>
            <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
              {item.decidedOn ? t("finding.decidedOn", { date: f.date(item.decidedOn) }) : t("finding.undated")}
              <Link href={ruleHref(item.ruleRef)} className="ml-2 text-cobalt transition-colors hover:text-signal">
                {t("finding.rule", { ref: item.ruleRef })}
              </Link>
            </span>
          </span>
        </div>
      ))}
      <SourceNote className="mt-3 pl-4">{t("sections.timelineSource")}</SourceNote>
    </div>
  );
}
