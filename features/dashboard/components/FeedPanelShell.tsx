"use client";

/*
 * Rám pásu provozu — hlavička s počtem, banner aktivního filtru, tělo, patička.
 *
 * Existuje proto, aby REÁLNÁ kniha faktů a OZNAČENÝ vzorkový provoz byly dva
 * moduly (vzorek se pak dá načíst až tehdy, když graf není k dispozici — viz
 * ../DashboardPage.tsx), aniž by se rám okna opsal dvakrát. Dvě kopie téhož
 * chrome by se rozešly na první změně a čtenář by ze dvou stavů jedné plochy
 * dostal dvě různá okna.
 *
 * Rám sám nic neodvozuje: počty i jméno filtru dostává hotové od panelu, který
 * ví, nad čím počítá.
 */

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useFormat } from "@/lib/i18n/useFormat";

export default function FeedPanelShell({
  matchCount,
  total,
  headerLink,
  selected,
  filterLabel,
  onClear,
  footer,
  children,
}: {
  /** Kolik řádků vyhovuje aktivnímu filtru (bez filtru = všechny). */
  matchCount: number;
  total: number;
  /** Odkaz vedle počtu — reálný panel jím vede do deníku, vzorkový nikam. */
  headerLink?: ReactNode;
  selected: string | null;
  /** Jméno vybraného uzlu do banneru filtru. */
  filterLabel: string | null;
  onClear: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const tf = useTranslations("dashboard.feed");
  const f = useFormat();

  return (
    <div className="flex h-full flex-col border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest">{tf("title")}</span>
        <span className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-steel">
            {/* Počet řádků okna. Citaci sází panel do patičky (`footer`) — jen ten
                ví, jestli počítá reálnou knihu faktů, nebo označený vzorek. */}
            {/* citation-ok: citace je v `footer` panelu, který ten počet vlastní */}
            {tf("matchCount", { count: f.int(matchCount), total: f.int(total) })}
          </span>
          {headerLink}
        </span>
      </div>

      {/* Živá oblast: sdělením není jen jméno filtru, ale hlavně KOLIK řádků mu
          vyhovuje — bez toho by nevidoucí čtenář filtr zapnul naslepo. */}
      {selected && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper-strong px-4 py-2"
        >
          <span className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
            {tf("filteredTo", { label: filterLabel ?? "" })}{" "}
            <span className="sr-only">
              {/* citation-ok: týž počet jako v hlavičce; citace je v `footer` panelu */}
              {tf("matchCount", { count: f.int(matchCount), total: f.int(total) })}
            </span>
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt transition-colors hover:text-signal"
          >
            <X className="h-3.5 w-3.5" /> {tf("showAll")}
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      <div className="border-t-2 border-ink px-4 py-2.5">{footer}</div>
    </div>
  );
}
