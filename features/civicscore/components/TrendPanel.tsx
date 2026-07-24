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
 * spočítal computeContribution. Copy je český (fleet: messages/*.json je
 * sdílený a needitujeme ho — navržené i18n klíče jsou v handoffu).
 */

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ComponentKey, ContributionTrend } from "@/lib/analysis/contribution-trend";

const dec = (x: number) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(x);
const signed = (x: number) => `${x > 0 ? "+" : ""}${dec(x)}`;

/** Směrová ikona + tokenová barva (cobalt nahoru, ocelová dolů/beze změny). */
function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="font-mono text-xs text-steel">—</span>;
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const cls = flat ? "text-steel" : up ? "text-cobalt" : "text-signal";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm font-bold tabular-nums ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {signed(value)}
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
  const rows = trend.components.filter((c) => c.prior !== null);
  return (
    <section className="mt-10 border-2 border-ink bg-paper-strong p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-steel">
          Vývoj proti období {trend.priorTerm}
        </h2>
        {trend.complete && trend.scoreDelta !== null ? (
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
              {trend.priorTerm} {dec(trend.priorScore ?? 0)} → {dec(trend.currentScore)}
            </span>
            <Delta value={trend.scoreDelta} suffix=" b" />
          </div>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
            částečné srovnání
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
                {dec(c.prior ?? 0)} → {dec(c.current)}
              </span>
              <Delta value={c.delta} />
            </span>
          </div>
        ))}
      </div>

      {/* Surové počty aktivity — poctivé srovnání objemu práce */}
      <div className="mt-6 grid grid-cols-3 gap-px border border-ink bg-ink text-center">
        {[
          { label: "Tisky (spolu)autorské", v: trend.counts.billsAuthored },
          { label: "Vystoupení v sále", v: trend.counts.speechTurns },
          { label: "Výbory a komise", v: trend.counts.committeeCount },
        ].map((s) => (
          <div key={s.label} className="bg-paper p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel">{s.label}</p>
            <p className="mt-1 font-mono text-lg font-black tabular-nums">
              {s.v.prior} <span className="text-steel">→</span> {s.v.current}
            </p>
          </div>
        ))}
      </div>

      {trend.pendingComponents.length > 0 && (
        <p className="mt-4 border-l-4 border-signal pl-3 text-xs italic leading-relaxed text-steel">
          Účast při hlasování a docházka za období {trend.priorTerm} se zobrazí po doingestování
          jmenných hlasování {trend.priorTerm} (dump hl-2021ps.zip) — teď je srovnatelná jen
          výborová, legislativní a řečnická složka.
        </p>
      )}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel">
        Zdroj: psp.cz · členství ve výborech + tisky/interpelace/stenozáznamy {trend.priorTerm}
        {trend.provenance?.pass ? ` · pass ${trend.provenance.pass}` : ""}
      </p>
    </section>
  );
}
