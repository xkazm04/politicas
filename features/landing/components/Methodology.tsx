/** Metoda — žádná černá skříňka: zveřejněné váhy, citace, drill-down.
 *  Dlaždice = ŠEST reálných složek indexu přispění z componentDefs.ts
 *  (kanonický zdroj štítků, vah i citací — týž jako /zebricek a /metodika;
 *  žádná druhá kopie vah). Váhy sčítají 100, takže % je přesné. */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { COMPONENT_DEFS } from "@/features/civicscore/componentDefs";
import SourceNote from "@/features/shared/components/SourceNote";

export default function Methodology() {
  const t = useTranslations("landing");
  return (
    <section id="k-metoda" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <h2 className="text-4xl font-black uppercase tracking-tight">
          {t("methodTitle")}<span className="text-signal">.</span>
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-steel-aa">
          {t("methodBody")}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/zebricek"
            // bg-signal-deep, ne bg-signal: papírový text na `signal` má 4,1:1 a
            // `text-sm font-black` (14 px) se do výjimky pro velký text nevejde —
            // ta začíná na 18,66 px tučně. Viz docs/design/impeccable-pass-02.md.
            className="inline-flex items-center gap-2 bg-signal-deep px-6 py-3.5 text-sm font-black uppercase tracking-wider text-paper transition-transform hover:-translate-y-0.5"
          >
            {t("methodCtaFind")} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/metodika"
            className="inline-flex items-center gap-2 border-2 border-ink px-6 py-3.5 text-sm font-black uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
          >
            {t("methodCtaFull")}
          </Link>
          {/* Datové kanály pro redakce — /data (vydání grafu, snapshoty). */}
          <Link
            href="/data"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            {t("methodCtaData")} →
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px self-start border border-ink bg-ink">
        {COMPONENT_DEFS.map((c) => (
          <div key={c.key} className="bg-paper p-5">
            <p className={`text-4xl font-black tabular-nums ${c.key === "participation" ? "text-signal" : "text-ink"}`}>
              {c.weight}
              <span className="text-lg">%</span>
            </p>
            <p className="mt-1 text-sm font-black uppercase tracking-wide">{c.label}</p>
            <SourceNote>{c.source}</SourceNote>
          </div>
        ))}
      </div>
    </section>
  );
}
