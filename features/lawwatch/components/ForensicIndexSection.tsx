"use client";

/*
 * REJSTŘÍK FORENZNÍCH POSUDKŮ (/zakony §03, kotva `#posudky`).
 *
 * Posudek nese 141 ze 141 tisků — nejrozlišovanější aktivum platformy — a čtenář
 * se k němu do teď dostal jedině po jednom na /zakony/[cislo]; přehled ho srazil
 * na jediný facet v prohlížeči tisků. Tahle sekce publikuje korpus jako CELEK:
 * uzavřenost censu, rozdělení podle uložené závažnosti, počet posudků se
 * zadrženým textem a procházitelný rejstřík s odkazem na každý dosje.
 *
 * Disciplína:
 *  – Všechna čísla pocházejí z `data.forensicIndex` — čisté agregace nad tím, co
 *    loader už přečetl (features/lawwatch/forensicIndex.ts). Žádné nové čtení.
 *  – Štítek závažnosti je katalogový slovník, nikdy přepis; neznámý token se
 *    vypíše DOSLOVA a označí jako nepřeložený (vzor features/money/tieFlags.ts).
 *  – Řazení je neutrální a VYTIŠTĚNÉ na ploše. Skupiny podle počtu, tisky podle
 *    čísla tisku. Stupnice pochybení se tu nezavádí.
 *  – Zadržený text se přiznává jako ZADRŽENÝ, ne jako chybějící.
 *  – Posudky vznikly analytickým průchodem, ne rozhodnutím lidské brány — proto
 *    věta o negatované relaci ze slovníku /overeni, ne druhá kopie téže věty.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";

import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { GATE_UNGATED_KEY } from "@/features/overeni/gateVocabulary";
import { useFormat } from "@/lib/i18n/useFormat";
import type { ForensicIndexEntry } from "../forensicIndex";

/** Co sekce potřebuje z payloadu /zakony — jen index a titulky tisků, které
 *  stránka stejně už veze (žádné bajty navíc na drátě). */
export interface ForensicIndexSectionData {
  forensicIndex: {
    totalBills: number;
    verdictCount: number;
    complete: boolean;
    groups: { severity: string; known: boolean; count: number; entries: ForensicIndexEntry[] }[];
    reviewStates: { state: string; count: number }[];
    withheldVerdictCount: number;
    withheldFieldCount: number;
    unlinkableCount: number;
    passes: number[];
    uniformPass: number | null;
  };
  bills: { cislo: number | null; tiskId: number; title: string; summary: string | null }[];
}

export default function ForensicIndexSection({
  data,
  index,
}: {
  data: ForensicIndexSectionData;
  index: number;
}) {
  const t = useTranslations("lawwatch");
  const tOvereni = useTranslations("overeni");
  const f = useFormat();
  const [severity, setSeverity] = useState<string | null>(null);

  const fi = data.forensicIndex;
  const billByTiskId = useMemo(
    () => new Map(data.bills.map((b) => [b.tiskId, b])),
    [data.bills],
  );

  // Řádky rejstříku: buď jedna skupina závažnosti, nebo všechny za sebou —
  // v obou případech v pořadí, které index vyhlásil (skupiny podle počtu,
  // tisky uvnitř podle čísla tisku).
  const rows = useMemo(
    () => fi.groups.filter((g) => severity === null || g.severity === severity).flatMap((g) => g.entries),
    [fi.groups, severity],
  );

  return (
    <section id="posudky" className="mt-14 border-t-4 border-ink pt-10 pb-20">
      <SectionHeading
        index={index}
        title={t("forensicIndex.title")}
        aside={
          <SourceNote>
            {fi.uniformPass != null
              ? t("forensicIndex.source", { pass: fi.uniformPass })
              : fi.passes.length > 1
                ? t("forensicIndex.sourceMixedPass", { variants: fi.passes.length })
                : t("forensicIndex.sourceNoPass")}
          </SourceNote>
        }
      />

      {fi.verdictCount === 0 ? (
        <div className="mt-8 border-2 border-dashed border-hairline bg-paper-strong px-6 py-8">
          <p className="text-sm leading-relaxed text-steel">{t("forensicIndex.empty")}</p>
        </div>
      ) : (
        <>
          {/* uzavřenost censu + negatovanost — dvě věty, ne jedna */}
          <div className="mt-8 border-l-4 border-cobalt bg-cobalt/5 p-4">
            <p className="text-[15px] font-medium leading-relaxed">
              {fi.complete
                ? t("forensicIndex.complete", {
                    verdictsFmt: f.int(fi.verdictCount),
                    billsFmt: f.int(fi.totalBills),
                  })
                : t("forensicIndex.partial", {
                    verdictsFmt: f.int(fi.verdictCount),
                    billsFmt: f.int(fi.totalBills),
                  })}
            </p>
            <p className="mt-2 font-mono text-[10px] font-black uppercase tracking-wider text-ochre">
              {tOvereni(GATE_UNGATED_KEY)}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-steel">
              {fi.reviewStates.map((s) => `${s.state} · ${f.int(s.count)}`).join(" | ")}
              {" — "}
              {t("forensicIndex.reviewStateNote")}
            </p>
          </div>

          {/* rozdělení podle uložené závažnosti — zároveň filtr rejstříku */}
          <div className="mt-6">
            <SourceNote>{t("forensicIndex.distributionHeading")}</SourceNote>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSeverity(null)}
                aria-pressed={severity === null}
                className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  severity === null ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
                }`}
              >
                {t("filterAll")} · {f.int(fi.verdictCount)}
              </button>
              {fi.groups.map((g) => (
                <button
                  key={g.severity}
                  type="button"
                  onClick={() => setSeverity(severity === g.severity ? null : g.severity)}
                  aria-pressed={severity === g.severity}
                  className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    severity === g.severity
                      ? "border-cobalt bg-cobalt text-paper"
                      : "border-hairline text-steel hover:text-ink"
                  }`}
                >
                  {g.known ? t(`severity.${g.severity}`) : g.severity} · {f.int(g.count)}
                  {!g.known && <span className="font-normal normal-case">({t("forensicIndex.untranslated")})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* rejstřík — každý řádek vede na svůj dosje */}
          <div className="mt-6 border-t-2 border-ink">
            {rows.map((e) => {
              const bill = billByTiskId.get(e.tiskId);
              const content = (
                <>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
                      {e.cislo != null ? t("printNumbered", { cislo: e.cislo }) : t("printInternal", { tiskId: e.tiskId })}
                    </span>
                    <span className="flex flex-wrap items-baseline gap-2 font-mono text-[11px] uppercase tracking-wider text-steel">
                      <span className="font-black text-cobalt">
                        {e.severityKnown ? t(`severity.${e.severity}`) : e.severity}
                      </span>
                      {e.confidence != null && <span>{t("forensicIndex.confidence", { confidence: e.confidence })}</span>}
                      {e.withheldFields > 0 && (
                        <span className="font-black text-ochre">
                          {t("forensicIndex.withheldBadge", {
                            count: e.withheldFields,
                            countFmt: f.int(e.withheldFields),
                          })}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="mt-1 block text-[15px] font-bold leading-snug">
                    {bill?.summary ?? bill?.title ?? t("noSummaryYet")}
                  </span>
                  {bill?.summary && (
                    <span className="mt-0.5 block text-[13px] leading-snug text-steel">{bill.title}</span>
                  )}
                </>
              );
              return e.cislo != null ? (
                <Link
                  key={e.tiskId}
                  href={`/zakony/${e.cislo}`}
                  className="group block border-b border-hairline py-3.5 pr-2 transition-colors hover:bg-paper-strong"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1">{content}</span>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </Link>
              ) : (
                <div key={e.tiskId} className="border-b border-hairline py-3.5 pr-2 opacity-70">
                  {content}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <SourceNote>
              {t("forensicIndex.shown", { shownFmt: f.int(rows.length), totalFmt: f.int(fi.verdictCount) })}
            </SourceNote>
            {fi.unlinkableCount > 0 && (
              <SourceNote className="!text-[10px]">
                {t("forensicIndex.unlinkable", {
                  count: fi.unlinkableCount,
                  countFmt: f.int(fi.unlinkableCount),
                })}
              </SourceNote>
            )}
          </div>

          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">{t("forensicIndex.orderRule")}</p>
          <p className="mt-3 max-w-3xl border-l-4 border-ochre bg-ochre/5 p-4 text-sm leading-relaxed">
            {fi.withheldVerdictCount > 0
              ? t("forensicIndex.withheld", {
                  count: fi.withheldVerdictCount,
                  countFmt: f.int(fi.withheldVerdictCount),
                  fieldsFmt: f.int(fi.withheldFieldCount),
                })
              : t("forensicIndex.withheldNone")}
          </p>
        </>
      )}
    </section>
  );
}
