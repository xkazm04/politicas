"use client";

/**
 * @catalog ARIA combobox over any item list — search-first input + listbox,
 * keyboard-complete (arrows / Home / End / Enter / Escape / Tab), optional
 * group headers; the CALLER supplies ranking and folding, this only debounces,
 * limits and renders.
 *
 * Extracted from `features/budget/TownPicker.tsx` (6 254 obcí) so the idiom —
 * `role="combobox"` input, `aria-activedescendant` pointing into a
 * `role="listbox"`, mousedown-before-blur selection — exists once. No numbers
 * are rendered here; whatever `renderItem` draws is cited by its caller.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { comboboxKey, groupItems } from "./comboboxKeys";

export type ComboboxProps<T> = {
  /** Stable id prefix; option ids are `${id}-${getKey(item)}`. */
  id?: string;
  /** Accessible name of the input (aria-label). */
  label: string;
  placeholder: string;
  items: readonly T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  /** When given, results render under a header per group, first-occurrence order. */
  getGroup?: (item: T) => string;
  /** Ranking belongs to the caller; `limit` is passed so it can stop early. The
   *  primitive slices the result to `limit` regardless. */
  search: (query: string, items: readonly T[], limit: number) => T[];
  /** Max rows shown. Default 40. */
  limit?: number;
  /** Debounce of the query fed to `search`, in ms. Default 0 — synchronous. */
  debounceMs?: number;
  onSelect: (item: T) => void;
  emptyLabel: string;
  /** aria-label of the listbox; falls back to `label`. */
  resultsLabel?: string;
  /** Key of the currently chosen item — marks `aria-selected`. */
  selectedKey?: string;
  renderItem?: (item: T, active: boolean) => ReactNode;
  autoFocus?: boolean;
  className?: string;
};

export default function Combobox<T>({
  id,
  label,
  placeholder,
  items,
  getKey,
  getLabel,
  getGroup,
  search,
  limit = 40,
  debounceMs = 0,
  onSelect,
  emptyLabel,
  resultsLabel,
  selectedKey,
  renderItem,
  autoFocus,
  className,
}: ComboboxProps<T>) {
  const generatedId = useId();
  const listboxId = id ?? generatedId;
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  // Cleanup only — no state is set from the effect.
  useEffect(() => () => window.clearTimeout(debounceRef.current), []);

  const results = useMemo(
    () => search(searchQuery, items, limit).slice(0, limit),
    [search, searchQuery, items, limit],
  );
  const groups = useMemo(
    () => (getGroup ? groupItems(results, getGroup) : [{ group: "", items: results.map((item, flatIndex) => ({ item, flatIndex })) }]),
    [results, getGroup],
  );

  const choose = (item: T) => {
    onSelect(item);
    setOpen(false);
    setQuery("");
    setSearchQuery("");
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const action = comboboxKey(e.key, { open, active, count: results.length });
    switch (action.type) {
      case "open":
        setOpen(true);
        e.preventDefault();
        break;
      case "move":
        setActive(action.active);
        e.preventDefault();
        break;
      case "select": {
        const hit = results[action.index];
        if (hit) choose(hit);
        e.preventDefault();
        break;
      }
      case "close":
        setOpen(false);
        // Tab keeps its default: focus moves on, the list just closes.
        if (!action.blur) e.preventDefault();
        break;
      default:
        break;
    }
  };

  const onChange = (value: string) => {
    setQuery(value);
    setActive(0);
    setOpen(true);
    window.clearTimeout(debounceRef.current);
    if (debounceMs > 0) {
      debounceRef.current = window.setTimeout(() => setSearchQuery(value), debounceMs);
    } else {
      setSearchQuery(value);
    }
  };

  const activeItem = results[active];

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-3 border-2 border-ink bg-paper px-4 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cobalt">
        <Search className="h-4 w-4 shrink-0 text-steel-aa" aria-hidden />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeItem ? `${listboxId}-${getKey(activeItem)}` : undefined}
          aria-autocomplete="list"
          aria-label={label}
          autoFocus={autoFocus}
          className="w-full bg-transparent font-mono text-sm text-ink outline-none placeholder:text-steel-aa"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onChange(e.target.value)}
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
          aria-label={resultsLabel ?? label}
          className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          {results.length === 0 && (
            <li className="px-4 py-3 font-mono text-xs text-steel-aa" role="presentation">
              {emptyLabel}
            </li>
          )}
          {groups.map((g) => (
            <li key={g.group} role="presentation">
              {getGroup && (
                <p className="border-b border-hairline bg-paper-strong px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">
                  {g.group}
                </p>
              )}
              <ul role="presentation">
                {g.items.map(({ item, flatIndex }) => {
                  const key = getKey(item);
                  const isActive = flatIndex === active;
                  return (
                    <li
                      key={key}
                      id={`${listboxId}-${key}`}
                      role="option"
                      aria-selected={selectedKey !== undefined && key === selectedKey}
                      className={`flex cursor-pointer items-baseline justify-between gap-3 border-b border-hairline px-4 py-2 ${
                        isActive ? "bg-ink text-paper" : "hover:bg-paper-strong"
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(item);
                      }}
                      onMouseEnter={() => setActive(flatIndex)}
                    >
                      {renderItem ? (
                        renderItem(item, isActive)
                      ) : (
                        <span className="min-w-0 text-sm font-black uppercase tracking-tight">{getLabel(item)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
