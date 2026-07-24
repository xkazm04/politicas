"use client";

/**
 * Plný žebříček 207 poslanců (REÁLNÁ DATA) — filtr po klubech, hledání, mini
 * rozklad indexu přispění v každém řádku (šířka segmentu = složka × váha, celek
 * ≈ skóre) a výběr dvou poslanců do souboje. Každý řádek odkazuje na spis
 * /poslanec/<pspId>. Žádná dogenerovaná jména — všech 207 je skutečných.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Swords } from "lucide-react";
import type { ClubFacet, LeaderboardData, LeaderboardEntry } from "../getLeaderboardData";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { COBALT, INK, OCHRE, SIGNAL, STEEL } from "@/features/landing/palette";

// Barva složky — jen tokeny palety (custom/no-hardcoded-colors). Šest složek,
// pět tokenů → leadership sdílí odstín s účastí, odlišen průhledností.
export const COMPONENT_FILL: Record<string, { color: string; opacity?: number }> = {
  participation: { color: COBALT },
  committee: { color: SIGNAL },
  legislative: { color: OCHRE },
  speech: { color: INK },
  attendance: { color: STEEL },
  leadership: { color: COBALT, opacity: 0.5 },
};

/** Mini rozklad: šířka segmentu = body složky (celek ≈ skóre /100). */
function MiniBreakdown({
  entry,
  components,
}: {
  entry: LeaderboardEntry;
  components: LeaderboardData["components"];
}) {
  return (
    <div className="flex h-3 w-36 bg-hairline" aria-hidden>
      {components.map((c) => {
        const fill = COMPONENT_FILL[c.key] ?? { color: STEEL };
        return (
          <span
            key={c.key}
            className="h-full"
            style={{ width: `${entry.components[c.key]}%`, background: fill.color, opacity: fill.opacity }}
          />
        );
      })}
    </div>
  );
}

export default function LeaderboardTable({
  entries,
  clubs,
  components,
  duel,
  onToggleDuel,
}: {
  entries: LeaderboardEntry[];
  clubs: ClubFacet[];
  components: LeaderboardData["components"];
  duel: number[];
  onToggleDuel: (pspId: number) => void;
}) {
  const t = useTranslations("civicscore");
  const f = useFormat();
  const [club, setClub] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (r) => (!club || r.clubAbbrev === club) && (!q || r.name.toLowerCase().includes(q)),
    );
  }, [entries, club, query]);

  return (
    <div>
      {/* filtry po klubech */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setClub(null)}
          className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
            club === null ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
          }`}
          aria-pressed={club === null}
        >
          {t("allParties")}
        </button>
        {clubs.map((c) => (
          <button
            key={c.abbrev}
            type="button"
            onClick={() => setClub(club === c.abbrev ? null : c.abbrev)}
            className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              club === c.abbrev ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
            }`}
            aria-pressed={club === c.abbrev}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name.split(" ")[0]} · {c.seats}
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
        {components.map((c) => {
          const fill = COMPONENT_FILL[c.key] ?? { color: STEEL };
          return (
            <span key={c.key} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-steel">
              <span className="inline-block h-2.5 w-2.5" style={{ background: fill.color, opacity: fill.opacity }} />
              {c.label} × {c.weight}
            </span>
          );
        })}
        <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
          {t("componentLegendNote")}
        </span>
      </div>

      {/* řádky */}
      <div className="mt-4 border-t-2 border-ink">
        {rows.map((r) => {
          const inDuel = duel.includes(r.pspId);
          return (
            <div
              key={r.pspId}
              className={`grid grid-cols-[3.25rem_1fr_auto_auto_auto] items-center gap-3 border-b border-hairline px-2 py-2.5 transition-colors hover:bg-paper-strong max-sm:grid-cols-[2.5rem_1fr_auto_auto] ${
                inDuel ? "bg-paper-strong" : ""
              }`}
            >
              <span className={`font-mono text-lg font-bold ${r.rank <= 3 ? "text-signal" : "text-steel"}`}>
                {r.rank}
              </span>
              <span className="min-w-0">
                <Link
                  href={`/poslanec/${r.pspId}`}
                  className="group inline-flex items-center gap-1.5 text-[15px] font-black uppercase tracking-tight hover:text-signal"
                >
                  <span className="truncate">{r.name}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-signal" />
                </Link>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-steel">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: r.clubColor }} />
                  {r.clubName.split(" ")[0]}{r.region ? ` · ${r.region}` : ""}
                </span>
              </span>
              <span className="max-sm:hidden">
                <MiniBreakdown entry={r} components={components} />
              </span>
              <span className="w-12 text-right text-lg font-black tabular-nums">{f.dec(r.score)}</span>
              <button
                type="button"
                onClick={() => onToggleDuel(r.pspId)}
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
        <SourceNote className="!text-[10px]">{t("realNote")}</SourceNote>
      </div>
    </div>
  );
}
