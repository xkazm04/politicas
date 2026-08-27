/*
 * Řádek nálezu — druh, závažnost, valence, stav kontroly, vstupy pravidla,
 * doklady, odkaz na pravidlo v metodice. Hlas knihy datovaných faktů
 * (dashboard/FactRow): datový sloupec v mono verzálkách, tónová tečka,
 * věta z typovaných polí — nikdy volný text. Nález je OTÁZKA pro zastupitele,
 * radu nebo ministerstvo; řádek proto nese pravidlo a doklady, ne úsudek.
 *
 * Každé číslo tu prochází `lib/format.ts` a řádek vlastní SourceNote
 * (vstupy pravidla + doklady) — brand rule, ne styl.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import type { Finding } from "@/lib/analysis/volby/types";
import type { VolbyIntl } from "../volbyIntl";
import { SEVERITY_CHIP, VALENCE_DOT, figureEntries, figureKind, findingDate, ruleHref, sharePct } from "../labels";

/** Jen `u.<uzel>` / `h.<hrana>` mají trvalou účtenku na /zdroj (claimRef). */
const isReceiptRef = (ref: string): boolean => /^(u|h)\./.test(ref);

function figureText(key: string, value: number, f: VolbyIntl["f"]): string {
  switch (figureKind(key)) {
    case "share":
      return `${f.dec(sharePct(value))} %`;
    case "czk":
      return f.czk(value);
    case "multiple":
      return `${f.dec(value)}×`;
    default:
      return f.int(value);
  }
}

export default function FindingRow({
  finding,
  subject,
  t,
  f,
}: {
  finding: Finding;
  /** Na domovské ploše řádek vede na svůj subjekt; na kartě subjektu ne. */
  subject?: { label: string; href: string | null } | null;
  t: VolbyIntl["t"];
  f: VolbyIntl["f"];
}) {
  const date = findingDate(finding);
  const figures = figureEntries(finding.figures);
  const multiple = finding.figures.multiple;
  return (
    <div
      id={finding.id}
      className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3.5 sm:grid-cols-[5.5rem_auto_1fr]"
    >
      <span className="col-span-2 font-mono text-[11px] uppercase tracking-wider text-steel sm:col-span-1">
        {date ? f.date(date) : t("finding.undated")}
      </span>
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${VALENCE_DOT[finding.valence]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        <span className="font-black uppercase tracking-tight">{t(`kind.${finding.kind}`)}</span>
        <span
          className={`ml-2 inline-block border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${SEVERITY_CHIP[finding.severity]}`}
        >
          {t(`severity.${finding.severity}`)}
        </span>
        <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
          {t(`valence.${finding.valence}`)}
        </span>
        {finding.reviewState === "pending_review" && (
          <span className="ml-2 inline-block border border-ochre px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-ochre">
            {t("review.pending_review")}
          </span>
        )}
        {subject && (
          <span className="mt-0.5 block text-sm">
            {subject.href ? (
              <Link
                href={subject.href}
                aria-label={t("latest.open", { label: subject.label })}
                className="inline-flex items-center gap-1 font-bold text-cobalt transition-colors hover:text-signal"
              >
                {subject.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : (
              <span className="font-bold">{subject.label}</span>
            )}
          </span>
        )}
        {typeof multiple === "number" && (
          <span className="mt-0.5 block text-sm text-steel-aa">{t("finding.multiple", { multiple: f.dec(multiple) })}</span>
        )}
        <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
          {finding.decidedOn && <span>{t("finding.decidedOn", { date: f.date(finding.decidedOn) })}</span>}
          {finding.laterOn && finding.laterKind && (
            <span className="ml-2">
              {t("finding.laterOn", { date: f.date(finding.laterOn) })} · {t(`later.${finding.laterKind}`)}
            </span>
          )}
        </span>
        {figures.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs tabular-nums text-steel-aa">
            {figures.map(([key, value]) => (
              <span key={key}>
                {t.has(`figure.${key}`) ? t(`figure.${key}`) : key} {figureText(key, value, f)}
              </span>
            ))}
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] uppercase tracking-wider">
          <Link
            href={ruleHref(finding.ruleRef)}
            aria-label={t("finding.ruleLink", { ref: finding.ruleRef })}
            className="text-cobalt transition-colors hover:text-signal"
          >
            {t("finding.rule", { ref: finding.ruleRef })}
          </Link>
          <span className="text-steel-aa">{t(`review.${finding.reviewState}`)}</span>
          {finding.evidence.map((e) =>
            isReceiptRef(e.ref) ? (
              <Link
                key={`${e.ref}:${e.label}`}
                href={claimRefPath(e.ref)}
                className="text-steel-aa underline decoration-hairline underline-offset-2 transition-colors hover:text-ink"
              >
                {e.label}
              </Link>
            ) : (
              // Doklad bez účtenky (např. zdroj základu arény jako věta) — sází
              // se jako text, nikdy jako odkaz do prázdna.
              <span key={`${e.ref}:${e.label}`} className="text-steel-aa" title={e.ref}>
                {e.label}
              </span>
            ),
          )}
        </span>
        <SourceNote className="mt-1">{t("finding.figuresSource")}</SourceNote>
      </span>
    </div>
  );
}
