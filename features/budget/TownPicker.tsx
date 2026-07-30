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
 * Česká copy inline — messages/*.json je mimo plochu (precedens lawwatchLabels).
 */

import { useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useFormat } from "@/lib/i18n/useFormat";
import { searchMunicipalities, type Municipality } from "./mirrorData";

const RESULT_LIMIT = 40;

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
  const f = useFormat();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchMunicipalities(registry, query, RESULT_LIMIT), [registry, query]);

  /** Skupiny po krajích v pořadí prvního výskytu — ploché indexy zůstávají
   *  klíčem klávesnice, skupinové hlavičky jsou jen vizuální předěl. */
  const groups = useMemo(() => {
    const out: { kraj: string; items: { m: Municipality; flatIndex: number }[] }[] = [];
    const byKraj = new Map<string, number>();
    results.forEach((m, flatIndex) => {
      let gi = byKraj.get(m.krajName);
      if (gi === undefined) {
        gi = out.length;
        byKraj.set(m.krajName, gi);
        out.push({ kraj: m.krajName, items: [] });
      }
      out[gi].items.push({ m, flatIndex });
    });
    return out;
  }, [results]);

  const quickPicks = useMemo(
    () => registry.filter((m) => covered.has(m.ic)).slice(0, 8),
    [registry, covered],
  );

  const choose = (ic: string) => {
    onSelect(ic);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      setActive((a) => Math.min(a + 1, results.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((a) => Math.max(a - 1, 0));
      e.preventDefault();
    } else if (e.key === "Home") {
      setActive(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setActive(results.length - 1);
      e.preventDefault();
    } else if (e.key === "Enter") {
      const hit = results[active];
      if (hit) choose(hit.ic);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    }
  };

  return (
    <div className="relative max-w-2xl">
      <div className="flex items-center gap-3 border-2 border-ink bg-paper px-4 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cobalt">
        <Search className="h-4 w-4 shrink-0 text-steel-aa" aria-hidden />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && results[active] ? `${listboxId}-${results[active].ic}` : undefined}
          aria-autocomplete="list"
          aria-label="Vyhledat obec podle názvu"
          className="w-full bg-transparent font-mono text-sm text-ink outline-none placeholder:text-steel-aa"
          placeholder="Najdi svou obec — kterákoli z 6 254…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Timeout: klik na položku (mousedown) musí proběhnout dřív, než
            // blur seznam zavře — jinak by se nedalo kliknout myší.
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Nalezené obce"
          className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          {results.length === 0 && (
            <li className="px-4 py-3 font-mono text-xs text-steel-aa" role="presentation">
              Žádná obec tohoto jména v rejstříku není — rejstřík nese všech 6 254 obcí ČR.
            </li>
          )}
          {groups.map((g) => (
            <li key={g.kraj} role="presentation">
              <p className="border-b border-hairline bg-paper-strong px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">
                {g.kraj}
              </p>
              <ul role="presentation">
                {g.items.map(({ m, flatIndex }) => (
                  <li
                    key={m.ic}
                    id={`${listboxId}-${m.ic}`}
                    role="option"
                    aria-selected={m.ic === selectedIc}
                    className={`flex cursor-pointer items-baseline justify-between gap-3 border-b border-hairline px-4 py-2 ${
                      flatIndex === active ? "bg-ink text-paper" : "hover:bg-paper-strong"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(m.ic);
                    }}
                    onMouseEnter={() => setActive(flatIndex)}
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-black uppercase tracking-tight">{m.name}</span>
                      <span className={`ml-2 font-mono text-[10px] ${flatIndex === active ? "text-paper/70" : "text-steel-aa"}`}>
                        okr. {m.county}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {/* citation-ok: počty obyvatel cituje SourceNote rodičovské plochy (BudgetMirrorPage, řádek zdroje MONITOR) */}
                      <span className="font-mono text-xs tabular-nums">{f.int(m.population)}</span>
                      <span
                        className={`ml-2 font-mono text-[10px] uppercase tracking-wider ${
                          flatIndex === active ? "text-paper/70" : covered.has(m.ic) ? "text-cobalt" : "text-steel-aa"
                        }`}
                      >
                        {covered.has(m.ic) ? "v záznamu" : "bez čísel"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

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
