"use client";

/*
 * Section — „Závislosti na doprovodných tiscích" (/zakony). The batch-014
 * dependency census scans each print's own cached text for the e-Sbírka
 * drafting placeholder and, where the evidence supports it, names the OTHER
 * print this one's text presumes has already reached the statute book — a
 * companion_dependency hit. This is an enactment-order HAZARD (this bill's
 * text can misfire if its companion is delayed, amended differently, or
 * dropped), never an ethics claim, and the copy says so explicitly.
 *
 * getDependencyData.ts already ran every reader-facing string through the
 * Czech + law-jargon gate — nothing here re-checks language, this component
 * only decides whether a companion tisk number resolves to a real row in the
 * loaded LawData corpus before turning it into a link (the census and the
 * bill corpus are two different artifacts and can disagree on a tisk number).
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import type { DependencyData } from "../getDependencyData";
import type { LawData } from "../getLawData";

export default function DependencyRadar({
  data,
  dependencyData,
  index,
}: {
  data: LawData;
  dependencyData: DependencyData;
  index: number;
}) {
  const f = useFormat();
  const billTitleByCislo = new Map(data.bills.filter((b) => b.cislo != null).map((b) => [b.cislo as number, b.title]));

  return (
    <section id="zavislosti" className="mt-14 border-t-4 border-ink pt-10 pb-20">
      <SectionHeading
        index={index}
        title="Závislosti na doprovodných tiscích"
        aside={
          <SourceNote>
            {f.int(dependencyData.bills.length)} tisků · {f.int(dependencyData.companionCount)} nálezů závislosti ·
            texty tisků na psp.cz
          </SourceNote>
        }
      />

      <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-steel">
        Detektor prochází vlastní text každého tisku a hledá zástupnou citaci e-Sbírky
        („zákona č. …/2026 Sb.&quot;), kterou psp.cz vkládá do novelizačních vět dřív, než je konečné
        číslo zákona známé. Nález se dělí na tři třídy — tisk cituje sám sebe (vlastní pozdější
        akt), tisk se opírá o JINÝ, doprovodný tisk, který musí projít současně nebo dřív, nebo
        nález zůstává nejasný, protože v dostupném textu chybí důkaz pro kteroukoli z předchozích
        dvou možností. Klasifikace byla ručně auditovaná; přesto{" "}
        <span className="font-bold text-ink">{f.int(dependencyData.unclearCount)}</span> z{" "}
        <span className="font-bold text-ink">{f.int(dependencyData.totalTriaged)}</span> nálezů zůstává poctivě
        nejasných a níže se nevykreslují. Závislost na doprovodném tisku je fakt legislativního procesu —
        upozorňuje na riziko chybného pořadí přijetí (tento tisk počítá s tím, že doprovodný tisk už
        bude zákonem), nikoli obvinění z pochybení.
      </p>

      <div className="mt-6 border-t-2 border-ink">
        {dependencyData.bills.map((bill) => {
          const title = billTitleByCislo.get(bill.cislo);
          return (
            <div key={bill.cislo} className="border-b border-hairline py-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={`/zakony/${bill.cislo}`}
                  className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-signal transition-colors hover:text-cobalt"
                >
                  sn. tisk {f.int(bill.cislo)}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
                {title && <span className="text-[13px] leading-snug text-steel">{title}</span>}
              </div>

              <ul className="mt-3 space-y-3">
                {bill.hits.map((hit, i) => {
                  const companionExists = hit.likelyCompanionTisk != null && billTitleByCislo.has(hit.likelyCompanionTisk);
                  return (
                    <li key={i} className="border-l-4 border-ochre pl-4">
                      <div className="text-[13px] leading-snug">
                        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ochre">
                          závisí na:{" "}
                        </span>
                        {companionExists ? (
                          <Link
                            href={`/zakony/${hit.likelyCompanionTisk}`}
                            className="font-bold text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal"
                          >
                            sn. tisk {f.int(hit.likelyCompanionTisk as number)}
                          </Link>
                        ) : null}
                        {hit.companionSubject ? (
                          <span className={companionExists ? "ml-1 text-steel" : "font-bold text-ink"}>
                            {hit.companionSubject}
                          </span>
                        ) : (
                          !companionExists && <span className="italic text-steel">popis závislosti čeká na český přepis — citace textu níže je zachycena</span>
                        )}
                      </div>
                      {hit.context && (
                        <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-steel">„…{hit.context}…&quot;</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {dependencyData.withheldHitCount > 0 && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-steel">
          <span className="font-black uppercase tracking-wide text-steel">Poznámka: </span>
          {f.int(dependencyData.withheldHitCount)}{" "}
          {dependencyData.withheldHitCount === 1 ? "další nález" : "dalších nálezů"} závislosti prošlo klasifikací,
          ale jeho popis neprošel jazykovou bránou (čeká na český přepis), takže se zde nezobrazuje.
        </p>
      )}

      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        Census pokrývá tisky, u kterých se zástupná citace v textu vůbec objevila — tak, jak jich
        aktuálně přibývá v korpusu. S rostoucím počtem zpracovaných tisků poroste i tento seznam;
        žádný limit počtu řádků se nevynucuje.
      </p>

      <div className="mt-3">
        <SourceNote>
          vlastní text tisků na psp.cz · deterministický detektor, auditovaná klasifikace ·{" "}
          {f.int(dependencyData.unclearCount)} z {f.int(dependencyData.totalTriaged)} nálezů nejasných
        </SourceNote>
      </div>
    </section>
  );
}
