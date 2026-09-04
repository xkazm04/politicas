"use client";

/*
 * TABULKA PROVENIENCE GRAFU PO RELACÍCH — kdo hrany napsal a jedním průchodem, či ne.
 *
 * Uzel svou provenienci na /graf nesl vždycky (NodeInspector), ale GRAF jako
 * populace žádnou nepublikoval — hlavička uměla jen „kolik uzlů, kolik hran".
 * Žebříček tuhle otázku vyřešil pro jednu relaci už dávno
 * (`summarizeContributionProvenance`); tohle je její sazba pro graf.
 *
 * CO SE TU NESMÍ STÁT: vydat jedno úhledné číslo za rozpolcenou populaci.
 * Průchody běží po relacích (průchod tenderů přistál na skladu, který pro
 * ostatní relace nese starší), takže `mixed` NAPŘÍČ relacemi je normální stav
 * a tabulka ho ukáže jako varianty s populací. `mixed` UVNITŘ jedné relace je
 * poloviční přepočet — část hran té relace píše jeden průchod, část jiný — a
 * jen ten se sází výstražně.
 *
 * KAŽDÝ STROP NESE SVOU POPULACI: relací je málo, ale tabulka se ořezává
 * (MAX_RELS) a zbytek se PŘIZNÁVÁ, nikdy mlčky nemizí.
 */

import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import type { GraphProvenance } from "@/lib/kg/graphProvenance";

/** Kolik relací se vejde do panelu; zbytek se přizná řádkem „+ N dalších". */
export const MAX_RELS = 8;

export default function ProvenanceTable({
  provenance,
  relLabel,
}: {
  provenance: GraphProvenance;
  relLabel: (rel: string) => string;
}) {
  const t = useTranslations("graph.provenance");
  const f = useFormat();
  const rows = provenance.rels.slice(0, MAX_RELS);
  const more = Math.max(0, provenance.rels.length - MAX_RELS);

  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink px-3 py-1.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest">{t("title")}</span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-steel-aa">
          {t(`state.${provenance.state}`)}
        </span>
      </div>
      <div className="px-3 py-2">
        {/* „Nic orazítkovaného" NENÍ průchod č. 0 — říká se to větou, ne nulou. */}
        {provenance.rels.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-wider text-steel-aa">{t("empty")}</p>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel-aa">{t("cols")}</p>
            <ul className="mt-0.5 border-t border-hairline">
              {rows.map((r) => (
                <li
                  key={r.rel}
                  className="flex items-baseline justify-between gap-3 border-b border-hairline py-1 font-mono text-[11px]"
                >
                  <span className="min-w-0 truncate uppercase tracking-wider">{relLabel(r.rel)}</span>
                  <span className="shrink-0 tabular-nums text-steel-aa">
                    {r.state === "uniform" ? (
                      // Jeden autor: pass i ref se smějí vypsat jako fakt.
                      <>
                        {r.pass === null ? t("noPass") : t("pass", { n: f.int(r.pass) })}
                        {r.ref !== null && <span className="ml-1.5 normal-case">{r.ref}</span>}
                      </>
                    ) : r.state === "mixed" ? (
                      // Rozpolcená relace ŽÁDNÝ jeden průchod nemá — místo čísla
                      // jde ven počet variant a jejich populace.
                      <span className="text-signal">
                        {t("mixed", { n: f.int(r.variants.length) })}
                      </span>
                    ) : (
                      <span>{t("absent")}</span>
                    )}
                    <span className="ml-1.5">
                      {t("coverage", {
                        stamped: f.int(r.coverage.stamped),
                        read: f.int(r.coverage.read),
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {more > 0 && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel-aa">
                {t("more", { n: f.int(more) })}
              </p>
            )}
            {/* Poplach, ne informace: rozpolcenost UVNITŘ relace = poloviční přepočet. */}
            {provenance.mixedWithinRel.length > 0 && (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-signal">
                {t("halfRecomputed", {
                  n: f.int(provenance.mixedWithinRel.length),
                  rels: provenance.mixedWithinRel.map(relLabel).join(", "),
                })}
              </p>
            )}
          </>
        )}
        <SourceNote className="mt-1.5 normal-case">{t("source")}</SourceNote>
      </div>
    </div>
  );
}
