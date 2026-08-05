"use client";

/*
 * Vývoj indexu přispění mezi obdobími (PSP9 → PSP10) — Case ② build.
 * REÁLNÁ DATA: čte `contribution_psp9` z uzlu poslance přes computeTrend.
 * Degraduje čestně: když minulé období chybí, panel se vůbec nevykreslí
 * (profil zůstane jednoobdobový, jako dnes). Když je minulé období jen
 * částečné (účast a docházka čekají na doingestování hlasování PSP9),
 * zobrazí se pouze složky, které skutečně máme, s poznámkou o zbytku.
 *
 * Čísla se zde NIKDY neautorují — panel jen odečítá dvě uložená čísla, která
 * spočítal computeContribution. Copy jde od 2026-08-05 přes next-intl
 * (civicscore.trend* v messages/*.json); věta o chybějících složkách se skládá
 * lokalizovaně (Intl.ListFormat + snížení prvního písmene uvnitř věty), dump
 * jmenuje jen období, kterého se týká (../trendCopy.priorTermVoteDump).
 */

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentKey, ContributionTrend } from "@/lib/analysis/contribution-trend";
import { useFormat } from "@/lib/i18n/useFormat";
import { priorTermVoteDump } from "../trendCopy";

/** Směrová ikona + tokenová barva (cobalt nahoru, ocelová dolů/beze změny). */
function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  const f = useFormat();
  if (value === null) return <span className="font-mono text-xs text-steel">—</span>;
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const cls = flat ? "text-steel" : up ? "text-cobalt" : "text-signal";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm font-bold tabular-nums ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {/* citation-ok: zdrojovou větu (trendSource/trendSourcePass, psp.cz) tiskne patička panelu */}
      {`${value > 0 ? "+" : ""}${f.dec(value)}`}
      {suffix}
    </span>
  );
}

export default function TrendPanel({
  trend,
  componentLabels,
}: {
  trend: ContributionTrend;
  componentLabels: Partial<Record<ComponentKey, string>>;
}) {
  const t = useTranslations("civicscore");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const f = useFormat();
  const rows = trend.components.filter((c) => c.prior !== null);
  const labelOf = (k: ComponentKey) => componentLabels[k] ?? k;

  // Věta o chybějících složkách JMENUJE, co opravdu chybí a co je srovnatelné.
  // Labely složek jsou velkým písmenem („Docházka"); uvnitř věty se snižují
  // všechny kromě prvního; výčtovou spojku dodává Intl.ListFormat („a"/„and").
  const lowerFirst = (s: string) => (s.length > 0 ? s[0].toLocaleLowerCase(locale) + s.slice(1) : s);
  const joinList = (items: string[]) =>
    new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
  const pendingLabels = trend.pendingComponents.map(labelOf);
  const comparableLabels = rows.map((c) => labelOf(c.key));
  let pendingNote: string | null = null;
  if (pendingLabels.length > 0) {
    const dump = priorTermVoteDump(trend.priorTerm);
    pendingNote = [
      t("trendPendingHead", {
        missing: joinList(pendingLabels.map((l, i) => (i === 0 ? l : lowerFirst(l)))),
        term: trend.priorTerm,
      }),
      dump ? t("trendPendingDump", { dump }) : null,
      comparableLabels.length > 0
        ? t("trendPendingComparable", { list: joinList(comparableLabels.map(lowerFirst)) })
        : t("trendPendingNone"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <section className="mt-10 border-2 border-ink bg-paper-strong p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-steel">
          {t("trendHeading", { term: trend.priorTerm })}
        </h2>
        {trend.complete && trend.scoreDelta !== null ? (
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
              {/* citation-ok: zdrojovou větu (trendSource/trendSourcePass, psp.cz) tiskne patička panelu */}
              {trend.priorTerm} {f.dec(trend.priorScore ?? 0)} → {f.dec(trend.currentScore)}
            </span>
            <Delta value={trend.scoreDelta} suffix={` ${tcom("pts")}`} />
          </div>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
            {t("trendPartial")}
          </span>
        )}
      </div>

      {/* Složky, které máme v obou obdobích */}
      <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map((c) => (
          <div key={c.key} className="flex items-center justify-between border-b border-hairline pb-2">
            <span className="text-sm font-bold uppercase tracking-tight">
              {componentLabels[c.key] ?? c.key}
            </span>
            <span className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-steel">
                {/* citation-ok: zdrojovou větu (trendSource/trendSourcePass, psp.cz) tiskne patička panelu */}
                {f.dec(c.prior ?? 0)} → {f.dec(c.current)}
              </span>
              <Delta value={c.delta} />
            </span>
          </div>
        ))}
      </div>

      {/* Surové počty aktivity — poctivé srovnání objemu práce */}
      <div className="mt-6 grid grid-cols-3 gap-px border border-ink bg-ink text-center">
        {[
          { label: t("trendCountBills"), v: trend.counts.billsAuthored },
          { label: t("trendCountSpeech"), v: trend.counts.speechTurns },
          { label: t("trendCountCommittees"), v: trend.counts.committeeCount },
        ].map((s) => (
          <div key={s.label} className="bg-paper p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel">{s.label}</p>
            <p className="mt-1 font-mono text-lg font-black tabular-nums">
              {/* citation-ok: zdrojovou větu (trendSource/trendSourcePass, psp.cz) tiskne patička panelu */}
              {s.v.prior} <span className="text-steel">→</span> {s.v.current}
            </p>
          </div>
        ))}
      </div>

      {pendingNote && (
        <p className="mt-4 border-l-4 border-signal pl-3 text-xs italic leading-relaxed text-steel">
          {pendingNote}
        </p>
      )}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel">
        {typeof trend.provenance?.pass === "number" && Number.isFinite(trend.provenance.pass)
          ? // citation-ok: tento řádek JE zdrojová věta panelu (psp.cz + průchod grafu)
            t("trendSourcePass", { term: trend.priorTerm, pass: f.int(trend.provenance.pass) })
          : t("trendSource", { term: trend.priorTerm })}
      </p>
    </section>
  );
}
