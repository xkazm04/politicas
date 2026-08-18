"use client";

/*
 * Našeptávač nad grafem — a zároveň jediná klávesnicová cesta k uzlům, protože
 * <canvas> se ovládat nedá. Proto je to plnohodnotný combobox se šipkami a
 * Enterem, ne dekorace vedle plátna.
 *
 * Hledá se na serveru: index má ~3 200 uzlů a je v paměti procesu, takže
 * odpověď chodí v jednotkách milisekund a do prohlížeče se nikdy nemusí poslat
 * celý seznam. Psaní se tlumí 140 ms — rychleji než čtenář stihne přečíst
 * návrh, a přitom to neposílá dotaz na každý znak.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { useFormat } from "@/lib/i18n/useFormat";
import { glyphPath, KIND_STYLE } from "../kindStyle";
import { searchGraphAction } from "../graphActions";
import type { SearchHit } from "../graphTypes";

const DEBOUNCE_MS = 140;

export default function NodeSearch({
  onPick,
  placeholder,
  disabledIds,
}: {
  onPick: (hit: SearchHit) => void;
  placeholder?: string;
  /** Uzly, které už na plátně jsou — nabízí se, ale označené. */
  disabledIds?: Set<string>;
}) {
  const t = useTranslations("graph");
  const f = useFormat();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqRef = useRef(0);

  const run = useCallback((value: string) => {
    const req = ++reqRef.current;
    if (value.trim().length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    void searchGraphAction(value, null).then((res) => {
      if (reqRef.current !== req) return;
      setHits(res);
      setActive(0);
      setBusy(false);
    });
  }, []);

  const onChange = (value: string) => {
    setQ(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => run(value), DEBOUNCE_MS);
  };

  // A pending debounce timer (or an in-flight request it kicked off) survives
  // unmount otherwise — switching variants or navigating away within the
  // 140ms window still fires the timer, which calls setHits/setActive/setBusy
  // on a component that no longer exists. reqRef guards against out-of-order
  // RESPONSES racing each other, but does nothing to stop the timer/request
  // from firing at all after unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      reqRef.current++;
    };
  }, []);

  const pick = (hit: SearchHit) => {
    onPick(hit);
    setQ("");
    setHits([]);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border-2 border-ink bg-paper px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-signal" />
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              pick(hits[active]);
            } else if (e.key === "Escape") {
              setHits([]);
            }
          }}
          placeholder={placeholder ?? t("search.placeholder")}
          aria-label={t("search.label")}
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="graph-search-results"
          aria-activedescendant={hits[active] ? `graph-search-opt-${hits[active].id}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-steel"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setHits([]);
            }}
            aria-label={t("search.clear")}
            className="shrink-0 text-steel transition-colors hover:text-signal"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {q.trim().length >= 2 && (
        <ul
          id="graph-search-results"
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-px max-h-80 overflow-y-auto border-2 border-ink bg-paper shadow-lg"
        >
          {hits.length === 0 && (
            <li className="px-3 py-3 font-mono text-[11px] uppercase tracking-widest text-steel">
              {busy ? t("search.searching") : t("search.noHits")}
            </li>
          )}
          {hits.map((hit, i) => {
            const style = KIND_STYLE[hit.kind];
            const already = disabledIds?.has(hit.id) ?? false;
            return (
              <li key={hit.id} id={`graph-search-opt-${hit.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(hit)}
                  className={`flex w-full items-center gap-2.5 border-b border-hairline px-3 py-2 text-left transition-colors ${
                    i === active ? "bg-paper-strong" : ""
                  }`}
                >
                  <svg viewBox="-12 -12 24 24" className="h-3 w-3 shrink-0" aria-hidden>
                    <path d={glyphPath(style.shape, 9)} fill={style.fill} />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{hit.label}</span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                      {t(`kinds.${hit.kind}`)} · {t("search.degree", { n: f.int(hit.degree) })}
                      {already ? ` · ${t("search.alreadyOnBoard")}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
