/**
 * Surový materiál — MĚŘENÝ stav zdrojů na kobaltové ploše + klíč IČO.
 *
 * Do 2026-08-12 tahle rubrika vypisovala sedm ukázkových zdrojů z
 * lib/civic/data.ts s kadencemi „denně / průběžně / téměř real-time" pod
 * titulkem „ověřené veřejné zdroje" a bez jediné citace — čísla, o kterých
 * hlavička toho souboru sama říká, že jsou ilustrativní mock. Fasáda teď čte
 * ATLAS KVALITY (features/atlas/getAtlasData.ts → lib/analysis/atlas.ts):
 * pokrytí provenancí, čerstvost proti deklarované kadenci, integrita pečetí a
 * úplnost, každé s pravidlem vytištěným na /atlas.
 *
 * Dvě věci, které se tu nesmí stát:
 *  · nehodnocená dimenze se NIKDY nekreslí jako nula (nula je tvrzení o
 *    kvalitě, nehodnoceno je tvrzení o podkladu) — proto `null` a slovo,
 *  · nedostupný atlas se přizná („stav zdrojů teď nelze změřit"), nikdy se
 *    nespadne zpátky na vymyšlené kadence.
 *
 * Sazba na kobaltu: text jde na PLNOU krytí `text-paper` (viz komentář u
 * titulku níž) — jedinou výjimkou je citační primitiv v tónu `paper`, který
 * si svou krytí (90 %) nese sám a na kobaltu drží ~6,5:1.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import type { Staleness } from "@/lib/analysis/atlas";
import type { LandingSourceState } from "../sourceStates";

/** Strojové pásmo čerstvosti z atlasu → klíč katalogu (vzor AtlasCards.tsx). */
const STALENESS_KEYS: Record<Staleness, string> = {
  "čerstvé": "stalenessFresh",
  "stárnoucí": "stalenessAging",
  "zastaralé": "stalenessStale",
};

/** Strojový stav souhrnu z atlasu → klíč katalogu (vzor AtlasCards.tsx). */
const COMPOSITE_KEYS: Record<LandingSourceState["composite"]["status"], string> = {
  hodnoceno: "sourceStatusRated",
  "částečné": "sourceStatusPartial",
  nehodnoceno: "sourceStatusUnrated",
};

export default function DataSources({
  /** Stav zdrojů z atlasu; `null` = atlas se nepodařilo přečíst. */
  sources,
}: {
  sources: LandingSourceState[] | null;
}) {
  const t = useTranslations("landing");
  const tc = useTranslations("common");
  const f = useFormat();
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
          {sources === null ? (
            <div className="bg-cobalt p-5 sm:col-span-2 lg:col-span-3">
              <p className="font-mono text-xs uppercase tracking-widest text-paper">
                {t("unavailableTag")}
              </p>
              <p className="mt-2 text-lg font-black uppercase">{t("sourcesUnavailable")}</p>
              <p className="mt-1 text-sm text-paper">{t("sourcesUnavailableBody")}</p>
            </div>
          ) : (
            sources.map((s, i) => (
              <div key={s.source} className="bg-cobalt p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-paper">
                  {String(i + 1).padStart(2, "0")} ·{" "}
                  {s.staleness === null ? t("stalenessUnrated") : t(STALENESS_KEYS[s.staleness])}
                </p>
                {/* Klíč zdroje je STROJOVÝ identifikátor atlasu — sází se doslova,
                    bez verzálkové transformace, aby zůstal dohledatelný. */}
                <p className="mt-2 font-mono text-lg font-black">{s.source}</p>
                <p className="mt-1 text-sm text-paper">
                  {t("sourceRows", { rows: f.int(s.rowsTotal) })}
                </p>
                <p className="mt-0.5 text-sm text-paper">
                  {s.coveragePct === null
                    ? t("sourceCoverageUnrated")
                    : t("sourceCoverage", { pct: f.int(s.coveragePct) })}
                </p>
                <p className="mt-3 font-mono text-xs uppercase tracking-widest text-paper">
                  {s.composite.score === null
                    ? t("sourceCompositeUnrated")
                    : t("sourceComposite", {
                        score: f.int(s.composite.score),
                        of100: tc("of100"),
                        status: t(COMPOSITE_KEYS[s.composite.status]),
                        evaluated: f.int(s.composite.evaluated),
                        of: f.int(s.composite.of),
                      })}
                </p>
              </div>
            ))
          )}
          <div className="flex flex-col justify-between bg-signal-deep p-5">
            <p className="font-mono text-xs uppercase tracking-widest text-paper">{t("joinKeyLabel")}</p>
            <p className="text-4xl font-black tracking-tight">IČO</p>
            <p className="text-sm text-paper">{t("joinKeyDesc")}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <SourceNote tone="paper" className="max-w-3xl">
            {sources === null ? t("sourcesUnavailableSource") : t("sourcesSource")}
          </SourceNote>
          <Link
            href="/atlas"
            // Bez `opacity-*` (viz komentář u titulku) — hover invertuje plochu,
            // takže papírový text nikdy neztrácí krytí.
            className="shrink-0 border-b-2 border-paper px-1 font-mono text-xs font-bold uppercase tracking-wider text-paper transition-colors hover:bg-paper hover:text-cobalt"
          >
            {t("sourcesAtlasLink")} →
          </Link>
        </div>
      </div>
    </section>
  );
}
