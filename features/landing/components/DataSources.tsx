/** Surový materiál — ověřené veřejné zdroje na kobaltové ploše + klíč IČO. */

import { useTranslations } from "next-intl";
import { SOURCES } from "@/lib/civic/data";

export default function DataSources() {
  const t = useTranslations("landing");
  const tc = useTranslations("content");
  return (
    <section id="k-data" className="bg-cobalt text-paper">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl font-black uppercase tracking-tight">{t("sourcesTitle")}</h2>
          {/* Bez `opacity-*`: papírový text na kobaltu má nominálně 4,6:1, ale
              měřený kontrast RENDEROVANÝCH pixelů padal na medián 3,2:1 —
              tenké antialiasované tahy strojopisu v 11 px se na plnou krytí
              nikdy nedostanou, takže nominální výpočet lže ve prospěch návrhu.
              Plná barva dává 7,75:1. Viz docs/design/impeccable-pass-01.md. */}
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-paper">
            {t("sourcesCaption")}
          </p>
        </div>
        <div className="mt-8 grid gap-px bg-paper/35 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.slice(0, 8).map((s, i) => (
            <div key={s.name} className="bg-cobalt p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-paper">
                {String(i + 1).padStart(2, "0")} · {tc(`sources.${i}.cadence`)}
              </p>
              <p className="mt-2 text-lg font-black uppercase">{tc(`sources.${i}.name`)}</p>
              <p className="mt-1 text-sm text-paper">{tc(`sources.${i}.what`)}</p>
            </div>
          ))}
          <div className="flex flex-col justify-between bg-signal-deep p-5">
            <p className="font-mono text-xs uppercase tracking-widest text-paper">{t("joinKeyLabel")}</p>
            <p className="text-4xl font-black tracking-tight">IČO</p>
            <p className="text-sm text-paper">{t("joinKeyDesc")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
