/*
 * Atlas kvality otevřených dat (/atlas, batch-6 item 6D) — publikovaná skóre
 * kvality per zdroj, každé s vytištěným pravidlem. Institucionální paměť
 * o českých otevřených datech (kontexty zdrojů, přiznané mezery, kadence,
 * Merkle pečetě) se stává veřejnou stránkou; strojová podoba /atlas/atlas.json.
 *
 * Serverová obálka — interaktivní je jen řazení karet (AtlasCards).
 * Copy je záměrně česky přímo zde (ne přes messages/*.json) — precedens
 * /data (batch 3D) a /dukazy (batch 2C).
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { czechInt } from "@/lib/format";
import {
  STALE_CADENCE_MULTIPLIER,
  ZERO_CADENCE_MULTIPLIER,
  type AtlasReport,
} from "@/lib/analysis/atlas";
import AtlasCards from "./AtlasCards";

function StoreDownState() {
  return (
    <div className="mt-8 border-2 border-dashed border-hairline p-8">
      <p className="text-lg">
        Atlas teď nelze sestavit — úložiště je v tomto prostředí nedostupné. Tahle stránka nemůže
        říct, jak na tom zdroje jsou; skóre nejsou nulová, jsou nečitelná.
      </p>
      <div className="mt-3">
        <SourceNote>zdroj: store nedostupný — žádné skóre není zamlčeno ani vymyšleno</SourceNote>
      </div>
    </div>
  );
}

export default function AtlasPage({ report }: { report: AtlasReport | null }) {
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ atlas</span>
          {/* Strojově čitelná podoba atlasu — veřejné API skóre. */}
          <a
            href="/atlas/atlas.json"
            className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            atlas.json
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">veřejný atlas kvality zdrojů datové vrstvy</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Atlas kvality otevřených dat
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
          Každý zdroj, který politicas nasypává, tu má veřejnou známku: pokrytí provenancí,
          čerstvost proti deklarované kadenci, integritu Merkle pečetí a úplnost měřenou přiznanými
          mezerami upstreamu. Každé skóre nese své pravidlo doslova vytištěné vedle čísla — a
          dimenze bez podkladu je poctivě „nehodnoceno&ldquo;, nikdy nula. Pasti, na které tu
          narazíte (sentinelová data narození, sloučené hlasy K, placeholder roky 2925), jsou tatáž
          institucionální paměť, kterou čtou analytické běhy politicas.
        </p>

        {/* Metodika — co skóre tvrdí a co záměrně netvrdí. */}
        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">metodika atlasu</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            Skóre 0–100 se počítají deterministicky z aktuálního stavu úložiště (entitní tabulky s
            provenance kvartetem, tabulka ingest_run, kontexty zdrojů). Slovník kadence: stáří
            poslední obnovy ≤ kadence je „čerstvé&ldquo;, do {czechInt(STALE_CADENCE_MULTIPLIER)}×
            kadence „stárnoucí&ldquo;, nad {czechInt(STALE_CADENCE_MULTIPLIER)}× kadence
            „zastaralé&ldquo;; skóre čerstvosti klesá k nule při {czechInt(ZERO_CADENCE_MULTIPLIER)}×
            kadenci. Kadence je deklarované očekávání politicas, ne SLA vydavatele. Nízká úplnost je
            výpověď o datech vydavatele, ne o zpracování — mezery se přiznávají, neschovávají.
            Dimenze bez podkladu je „nehodnoceno&ldquo; s důvodem a do souhrnu nevstupuje.
          </p>
        </div>

        {report === null ? (
          <StoreDownState />
        ) : (
          <section className="mt-14 border-t-4 border-ink pt-10">
            <SectionHeading
              index={1}
              title="Zdroje"
              aside={
                <SourceNote>
                  zdroj: entitní tabulky + ingest_run + kontexty zdrojů (context-model)
                </SourceNote>
              }
            />
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
              {czechInt(report.sources.length)} zdrojů v záznamu. Sjednocení tří pohledů: zdroje se
              zpracovaným kontextem, zdroje s řádky ve store a zdroje s ingest běhy — zdroj známý
              jen z jedné strany se ukazuje taky, s poctivým „nehodnoceno&ldquo; tam, kde podklad
              chybí.
            </p>
            <div className="mt-8">
              <AtlasCards report={report} />
            </div>
          </section>
        )}

        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title="Souvislosti"
            aside={<SourceNote>atlas je jedna tvář téže datové vrstvy jako /data</SourceNote>}
          />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href="/data"
              className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              datové verze <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
            <Link
              href="/dukazy"
              className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              deník důkazů <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
            <SourceNote>
              verze a integrita vydání žijí na /data; rozhodnutí lidské brány na /dukazy
            </SourceNote>
          </div>
        </section>
      </div>
    </main>
  );
}
