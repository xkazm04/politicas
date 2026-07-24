"use client";

/**
 * Plný žebříček 200 poslanců — filtr po stranách, hledání, mini rozklad
 * skóre v každém řádku (šířka = kompozit, segmenty = vážené příspěvky
 * pilířů) a výběr dvou poslanců do souboje. Poslanci vzorku mají spis;
 * dogenerovaná jména jsou ilustrativní.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Swords } from "lucide-react";
import { PARTIES, PILLARS } from "@/lib/civic/data";
import { LEADERBOARD, type LeaderboardRow } from "@/lib/civic/leaderboard";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { PILLAR_FILL } from "@/features/landing/palette";

/** Mini rozklad: šířka pruhu = kompozit /100, segmenty = pilíř × váha. */
function MiniBreakdown({ row }: { row: LeaderboardRow }) {
  return (
    <div className="flex h-3 w-36 bg-hairline" aria-hidden>
      {PILLARS.map((p) => (
        <span
          key={p.key}
          className="h-full"
          style={{ width: `${row.pillars[p.key] * p.weight}%`, background: PILLAR_FILL[p.key] }}
        />
      ))}
    </div>
  );
}

export default function LeaderboardTable({
  duel,
  onToggleDuel,
}: {
  duel: string[];
  onToggleDuel: (id: string) => void;
}) {
  const t = useTranslations("civicscore");
  const tc = useTranslations("content");
  const f = useFormat();
  const [party, setParty] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LEADERBOARD.filter(
      (r) => (!party || r.partyCode === party) && (!q || r.name.toLowerCase().includes(q)),
    );
  }, [party, query]);

  return (
    <div>
      {/* filtry */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setParty(null)}
          className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
            party === null ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
          }`}
          aria-pressed={party === null}
        >
          {t("allParties")}
        </button>
        {PARTIES.map((p) => (
          <button
            key={p.code}
            type="button"
            onClick={() => setParty(party === p.code ? null : p.code)}
            className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              party === p.code ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
            }`}
            aria-pressed={party === p.code}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name.split(" ")[0]} · {p.seats}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAriaLabel")}
          className="ml-auto border-2 border-hairline bg-paper px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-ink placeholder:text-steel focus:border-ink focus:outline-none"
        />
      </div>

      {/* legenda mini rozkladu */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {PILLARS.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-steel">
            <span className="inline-block h-2.5 w-2.5" style={{ background: PILLAR_FILL[p.key] }} />
            {tc(`pillars.${p.key}.label`)} × {p.weight}
          </span>
        ))}
        <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
          {t("legendWidthNote")}
        </span>
      </div>

      {/* řádky */}
      <div className="mt-4 border-t-2 border-ink">
        {rows.map((r) => {
          const inDuel = duel.includes(r.id);
          return (
            <div
              key={r.id}
              className={`grid grid-cols-[3.25rem_1fr_auto_auto_auto] items-center gap-3 border-b border-hairline px-2 py-2.5 transition-colors hover:bg-paper-strong max-sm:grid-cols-[2.5rem_1fr_auto_auto] ${
                inDuel ? "bg-paper-strong" : ""
              }`}
            >
              <span className={`font-mono text-lg font-bold ${r.rank <= 3 ? "text-signal" : "text-steel"}`}>
                {r.rank}
              </span>
              <span className="min-w-0">
                {r.sample ? (
                  <Link
                    href={`/poslanec/${r.id}`}
                    className="group inline-flex items-center gap-1.5 text-[15px] font-black uppercase tracking-tight hover:text-signal"
                  >
                    <span className="truncate">{r.name}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-signal" />
                  </Link>
                ) : (
                  <span className="block truncate text-[15px] font-bold">{r.name}</span>
                )}
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-steel">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: r.partyColor }} />
                  {r.party.split(" ")[0]} · {tc(`regions.${r.region}`)}
                </span>
              </span>
              <span className="max-sm:hidden">
                <MiniBreakdown row={r} />
              </span>
              <span className="w-12 text-right text-lg font-black tabular-nums">{f.dec(r.score)}</span>
              <button
                type="button"
                onClick={() => onToggleDuel(r.id)}
                title={inDuel ? t("toggleDuelRemove") : t("toggleDuelAdd")}
                aria-pressed={inDuel}
                className={`inline-flex items-center gap-1 border-2 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  inDuel ? "border-signal bg-signal text-paper" : "border-hairline text-steel hover:border-ink hover:text-ink"
                }`}
              >
                <Swords className="h-3 w-3" /> {t("vsButton")}
              </button>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="border-2 border-dashed border-hairline p-6 text-sm text-steel">
            {t("emptyResults")}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <SourceNote>
          {t("shownOf", { count: rows.length })}
        </SourceNote>
        <SourceNote className="!text-[10px]">{t("mockNote")}</SourceNote>
      </div>
    </div>
  );
}
