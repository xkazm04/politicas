/**
 * Jak stopa vzniká — čtyři kroky od rejstříků k doloženému faktu,
 * sutnarovské glyfy + kadence zdrojů. Poslední krok je lidská kontrola:
 * práh spolehlivosti je součást metodiky, ne provozní detail.
 */

import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";

const STEP_GLYPHS: Record<string, React.ReactNode> = {
  ares: (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <circle cx="24" cy="24" r="18" className="fill-cobalt" />
      <circle cx="24" cy="24" r="7" className="fill-paper" />
    </svg>
  ),
  registers: (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <rect x="7" y="24" width="9" height="17" className="fill-cobalt" />
      <rect x="20" y="14" width="9" height="27" className="fill-signal" />
      <rect x="33" y="20" width="9" height="21" className="fill-ink" />
    </svg>
  ),
  watchdog: (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <line x1="10" y1="37" x2="38" y2="11" className="stroke-ink" strokeWidth="3" />
      <circle cx="10" cy="37" r="6.5" className="fill-signal" />
      <circle cx="38" cy="11" r="6.5" className="fill-cobalt" />
    </svg>
  ),
  resolution: (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <path d="M24 7 42 40 6 40Z" className="fill-signal" />
      <path d="M24 19 33 37 15 37Z" className="fill-paper" />
    </svg>
  ),
};

const STEP_KEYS = ["ares", "registers", "watchdog", "resolution"] as const;

export default function TrailMethod() {
  const t = useTranslations("money");

  const STEPS = STEP_KEYS.map((key, i) => ({
    n: String(i + 1).padStart(2, "0"),
    title: t(`method.steps.${key}.title`),
    body: t(`method.steps.${key}.body`),
    cadence: t(`method.steps.${key}.cadence`),
    glyph: STEP_GLYPHS[key],
  }));

  return (
    <div>
      <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="flex min-h-52 flex-col justify-between bg-paper p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-2xl font-bold text-signal">{s.n}</span>
                {s.glyph}
              </div>
              <p className="mt-3 text-lg font-black uppercase leading-tight tracking-tight">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-steel">{s.body}</p>
            </div>
            <SourceNote className="mt-3 !text-[10px]">{s.cadence}</SourceNote>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        {t("method.footnote")}
      </p>
    </div>
  );
}
