"use client";

/** Řádky žebříčku — REÁLNÁ špička indexu přispění (competition ranking,
 *  1-2-2-4). Výběr řádku přepíná rozklad i živý vzorek nahoře. Bez trendové
 *  šipky: jedno volební období = žádná časová řada (PRODUCT.md), a bez
 *  redakčních titulků — číslo mluví, spis je na /poslanec. */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LeaderboardListEntry } from "@/features/civicscore/getLeaderboardData";
import { useFormat } from "@/lib/i18n/useFormat";

export default function Standings({
  entries,
  total,
  selectedId,
  onSelect,
}: {
  entries: LeaderboardListEntry[];
  total: number;
  selectedId: number;
  onSelect: (pspId: number) => void;
}) {
  const t = useTranslations("landing");
  const f = useFormat();
  return (
    <div className="min-w-0 border-t-2 border-ink">
      {entries.map((e) => (
        <button
          key={e.pspId}
          type="button"
          onClick={() => onSelect(e.pspId)}
          className={`grid w-full grid-cols-[3rem_1fr_auto] items-center gap-4 border-b border-hairline px-2 py-4 text-left transition-colors hover:bg-paper-strong ${
            e.pspId === selectedId ? "bg-paper-strong" : ""
          }`}
          aria-pressed={e.pspId === selectedId}
        >
          <span className={`font-mono text-2xl font-bold ${e.rank <= 3 ? "text-signal" : "text-steel-aa"}`}>
            {e.rank}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black uppercase tracking-tight">{e.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
              {/* barva klubu je datový údaj — jediné povolené inline barvy */}
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.clubColor }} />
              {e.clubAbbrev}
              {e.region ? ` · ${e.region}` : ""}
            </span>
          </span>
          <span className={`text-2xl font-black tabular-nums ${e.pspId === selectedId ? "text-signal" : "text-ink"}`}>
            {/* citation-ok: citaci sekce (rankingSource — index přispění · psp.cz) tiskne LandingPage u nadpisu */}
            {f.dec(e.score)}
          </span>
        </button>
      ))}
      <Link
        href="/zebricek"
        className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
      >
        {t("standingsAll", { count: total })}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
