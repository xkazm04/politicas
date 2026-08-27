"use client";

/*
 * TownPicker — výběr obce nad plným rejstříkem (6 254 obcí).
 *
 * Search-first: pole s našeptávačem (bez diakritiky, řazení přesná shoda →
 * prefix → podřetězec, uvnitř podle velikosti obce), výsledky seskupené po
 * krajích, plně ovladatelné klávesnicí (šipky / Enter / Escape) podle vzoru
 * ARIA combobox. Chipy pod polem jsou rychlé volby největších měst — u 6 254
 * položek nemůže být výčet chipů primární navigací, tou je hledání.
 *
 * Řazení zůstává v `searchMunicipalities`; samotný combobox (vstup, listbox,
 * klávesnice, skupinové hlavičky) je sdílený katalogový primitiv `Combobox`.
 *
 * Copy přes next-intl (messages/*.json, sekce "budget" — dvojjazyčný start).
 */

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import Combobox from "@/features/shared/components/Combobox";
import { useFormat } from "@/lib/i18n/useFormat";
import { searchMunicipalities, type Municipality } from "./mirrorData";

const RESULT_LIMIT = 40;

const getKey = (m: Municipality) => m.ic;
const getLabel = (m: Municipality) => m.name;
const getGroup = (m: Municipality) => m.krajName;

export default function TownPicker({
  registry,
  covered,
  selectedIc,
  onSelect,
}: {
  registry: readonly Municipality[];
  /** IČO obcí, které mají v záznamu rozpočtovou řadu. */
  covered: ReadonlySet<string>;
  selectedIc: string;
  onSelect: (ic: string) => void;
}) {
  const t = useTranslations("budget");
  const f = useFormat();

  const search = useCallback(
    (query: string, items: readonly Municipality[], limit: number) => searchMunicipalities(items, query, limit),
    [],
  );

  const quickPicks = useMemo(
    () => registry.filter((m) => covered.has(m.ic)).slice(0, 8),
    [registry, covered],
  );

  const choose = (ic: string) => onSelect(ic);

  return (
    <div className="max-w-2xl">
      <Combobox
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        resultsLabel={t("resultsLabel")}
        emptyLabel={t("noResults")}
        items={registry}
        getKey={getKey}
        getLabel={getLabel}
        getGroup={getGroup}
        search={search}
        limit={RESULT_LIMIT}
        selectedKey={selectedIc}
        onSelect={(m) => choose(m.ic)}
        renderItem={(m, active) => (
          <>
            <span className="min-w-0">
              <span className="text-sm font-black uppercase tracking-tight">{m.name}</span>
              <span className={`ml-2 font-mono text-[10px] ${active ? "text-paper/70" : "text-steel-aa"}`}>
                {t("districtAbbr", { county: m.county })}
              </span>
            </span>
            <span className="shrink-0 text-right">
              {/* citation-ok: počty obyvatel cituje SourceNote rodičovské plochy (BudgetMirrorPage, řádek zdroje MONITOR) */}
              <span className="font-mono text-xs tabular-nums">{f.int(m.population)}</span>
              <span
                className={`ml-2 font-mono text-[10px] uppercase tracking-wider ${
                  active ? "text-paper/70" : covered.has(m.ic) ? "text-cobalt" : "text-steel-aa"
                }`}
              >
                {covered.has(m.ic) ? t("inRecord") : t("noNumbers")}
              </span>
            </span>
          </>
        )}
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {quickPicks.map((m) => (
          <button
            key={m.ic}
            type="button"
            onClick={() => choose(m.ic)}
            aria-pressed={m.ic === selectedIc}
            className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
              m.ic === selectedIc ? "border-ink bg-ink text-paper" : "border-hairline text-steel-aa hover:text-ink"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
