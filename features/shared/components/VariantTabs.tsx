"use client";

/**
 * @catalog Přepínač variant — pruh záložek nad porovnávanými verzemi jedné plochy.
 *
 * Doménově neutrální: dostane pole `{ id, label, hint }` a řízenou hodnotu, sám
 * nic neví o tom, co se pod ním kreslí. Klávesnice jede přes skutečné `<button>`
 * prvky (žádné `role="button"` na divu), aktivní záložka je `aria-current` a pruh
 * je `role="tablist"` jen tehdy, když ho volající opravdu jako taby používá.
 */

export interface VariantTab {
  id: string;
  /** Krátký název na záložce — jde do verzálek. */
  label: string;
  /** Jedna věta pod pruhem: čím se varianta liší. */
  hint?: string;
}

export default function VariantTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  tabs: VariantTab[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const active = tabs.find((t) => t.id === value) ?? tabs[0];
  return (
    <div className={`border-b-4 border-ink bg-paper ${className}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-px px-6">
        <nav aria-label={ariaLabel} className="flex flex-wrap gap-px">
          {tabs.map((t) => {
            const on = t.id === value;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={on ? "page" : undefined}
                className={`px-4 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${
                  on
                    ? "bg-ink text-paper"
                    : "bg-paper-strong text-steel-aa hover:bg-ink hover:text-paper"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
      {active?.hint && (
        <div className="mx-auto max-w-6xl px-6 pb-3 pt-2">
          <p className="font-mono text-xs leading-relaxed text-steel-aa">{active.hint}</p>
        </div>
      )}
    </div>
  );
}
