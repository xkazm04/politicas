"use client";

/*
 * „Z čeho to skóre je" — čitelnost indexu přispění přímo ve spisu.
 *
 * Index přispění je hlavní tvrzení produktu a na spisu dosud dorazil jako číslo
 * a šest sloupečků. Politicas se profiluje jako metodicky transparentní zdroj,
 * takže novinář nebo konkurenční kampaň musí umět skóre přepočítat BEZ čtení
 * zdrojáku. Tenhle panel to umožňuje: u každé složky hodnota poslance ve VLASTNÍ
 * jednotce složky (tisky, výbory, vystoupení, %), strop, na kterém složka
 * přestává přidávat body, medián sněmovny a — proti skutečnému pořadí skutečné
 * sněmovny spočítané — pořadí při naplnění stropu.
 *
 * VŠECHNO ODVOZENÉ, a takto i označené. Nemění index ani jeho váhy; jen v reálných
 * jednotkách převypráví, co dělá zveřejněný vzorec v lib/analysis/contribution.ts.
 * Čistá logika (a její test) žije v lib/analysis/score-legibility.ts, tady je jen
 * sazba.
 *
 * Copy je ZÁMĚRNĚ popisná, ne návodná: říká, co index měří a kde poslanec stojí —
 * nikdy „co dělat, aby stoupl". Metrika, kterou návod udělá hratelnou, přestane
 * měřit to, kvůli čemu vznikla.
 *
 * Chybějící vstup se NEVYKRESLÍ jako nula: uzel bez `speech_turns` řekne
 * „údaj v grafu chybí", protože „0 vystoupení" by bylo vymyšlené tvrzení.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import type { ComponentLegibility, ScoreLegibility } from "@/lib/analysis/score-legibility";

export default function ScoreLegibilityPanel({
  legibility,
  labels,
}: {
  legibility: ScoreLegibility;
  /** Component key → the same Czech label the tiles above use. */
  labels: Record<string, string>;
}) {
  const t = useTranslations("profile");
  const f = useFormat();

  // A rate is stored 0–1 and read as a percentage; a count is read as it stands —
  // and a whole count reads as a whole number ("3 výbory", not "3,0 výbory"),
  // while a median that genuinely falls between two MPs keeps its decimal.
  const unitValue = (c: ComponentLegibility, v: number) =>
    c.unit === "rate" ? `${f.dec(v * 100)} %` : Number.isInteger(v) ? f.int(v) : f.dec(v);

  return (
    <div className="mt-10 border-2 border-ink">
      <div className="border-b-2 border-ink px-5 py-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
          {t("legibilityHeading")}
        </p>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-steel">{t("legibilityLead")}</p>
        <p className="mt-2 max-w-3xl text-[14px] font-bold leading-relaxed text-ink">
          {legibility.gapToNext == null || legibility.nextName == null
            ? t("legibilityTop")
            : legibility.gapToNext === 0
              ? // Scores tie often (they are rounded to 1 dp over 207 MPs); "chybí
                // 0,0 bodu" would be a nonsense sentence. buildLeaderboard breaks a
                // tie on the Czech collation of the name — say that instead.
                t("legibilityTied", { rank: f.int(legibility.rank - 1), name: legibility.nextName })
              : t("legibilityGap", {
                  rank: f.int(legibility.rank - 1),
                  name: legibility.nextName,
                  gap: f.dec(legibility.gapToNext),
                })}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline font-mono text-[10px] uppercase tracking-widest text-steel">
              <th scope="col" className="px-5 py-2.5 font-bold">
                {t("legibilityColComponent")}
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-bold">
                {t("legibilityColValue")}
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-bold">
                {t("legibilityColCap")}
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-bold">
                {t("legibilityColMedian")}
              </th>
              <th scope="col" className="px-5 py-2.5 font-bold">
                {t("legibilityColHeadroom")}
              </th>
            </tr>
          </thead>
          <tbody>
            {legibility.components.map((c) => (
              <tr key={c.key} className="border-b border-hairline last:border-b-0 align-baseline">
                <th scope="row" className="px-5 py-3 text-[14px] font-black uppercase tracking-tight">
                  {labels[c.key] ?? c.key}
                  <span className="ml-1.5 font-mono text-[10px] font-bold tracking-widest text-steel">
                    × {f.int(c.weight)}
                  </span>
                </th>
                <td className="px-5 py-3 text-right text-[15px] font-black tabular-nums">
                  {c.value == null ? (
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ochre">
                      {t("legibilityMissing")}
                    </span>
                  ) : (
                    unitValue(c, c.value)
                  )}
                </td>
                <td className="px-5 py-3 text-right text-[14px] tabular-nums text-steel">{unitValue(c, c.cap)}</td>
                <td className="px-5 py-3 text-right text-[14px] tabular-nums text-steel">
                  {c.chamberMedian == null ? "—" : unitValue(c, c.chamberMedian)}
                </td>
                <td className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-steel">
                  {c.headroomUnits == null ? (
                    "—"
                  ) : c.headroomPoints === 0 ? (
                    <span className="text-cobalt">{t("legibilitySaturated")}</span>
                  ) : (
                    <>
                      {t("legibilityHeadroom", {
                        units: unitValue(c, c.headroomUnits),
                        points: f.dec(c.headroomPoints!),
                      })}
                      {c.rankAtCap != null && (
                        <span className="ml-1.5 font-black text-ink">
                          {t("legibilityAtCap", { rank: f.int(c.rankAtCap) })}
                        </span>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-hairline px-5 py-4">
        <SourceNote className="!text-[10px]">{t("legibilityDerived")}</SourceNote>
        <SourceNote className="mt-1.5 !text-[10px]">{t("legibilitySource")}</SourceNote>
        {/* Panel převypráví vzorec v reálných jednotkách; /metodika ten vzorec
            ukazuje celý (váhy, stropy, započítané orgány — vykreslené z
            lib/analysis/contribution.ts). Ze všech míst na spisu ho potřebuje
            právě tohle nejvíc, a jako jediné ho nemělo. */}
        <p className="mt-2">
          <Link
            href="/metodika"
            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt hover:underline"
          >
            {t("legibilityMethodLink")}
            <ArrowUpRight className="h-2.5 w-2.5 shrink-0" aria-hidden />
          </Link>
        </p>
      </div>
    </div>
  );
}
