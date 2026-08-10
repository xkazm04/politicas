"use client";

/*
 * Section — „Závislosti na doprovodných tiscích" (/zakony). The batch-014
 * dependency census scans each print's own cached text for the e-Sbírka
 * drafting placeholder and, where the evidence supports it, names the OTHER
 * print this one's text presumes has already reached the statute book — a
 * companion_dependency PODNĚT (a lead, per the census payload's own method
 * string, never a "nález"/finding). This is an enactment-order HAZARD (this
 * bill's text can misfire if its companion is delayed, amended differently,
 * or dropped), never an ethics claim, and the copy says so explicitly.
 *
 * Inline Czech literals, not next-intl `t()` — same precedent as
 * lawwatchLabels.ts and features/civicscore/components/LeaderboardTable.tsx's
 * "Tiší pracanti" filter: messages/*.json is off-boundary for this surface.
 * (A prior in-flight edit briefly converted this file to `useTranslations`
 * against keys that were never added to either catalog — batch-015-audit.md
 * N8 — which rendered the whole section as MISSING_MESSAGE in both locales.
 * Reverted rather than backfilled: this file owns no shared i18n surface, and
 * the inline pattern is the documented norm for this exact area.)
 *
 * ONE string is the exception since 2026-08-10, and for the reason the rule
 * itself names: the section TITLE became a shared surface the moment the left
 * rail started offering the `#zavislosti` anchor (features/shell/navModel.ts
 * addresses it by `labelKey`, and the rail is catalog-driven). It is therefore
 * read from `lawwatch.dependencies.title` — ONE definition for the rail and the
 * heading — and the key exists in BOTH catalogs, which is exactly what the
 * reverted edit lacked. Everything else here stays an inline literal.
 *
 * getDependencyData.ts already ran every reader-facing string through the
 * Czech + law-jargon gate — nothing here re-checks language. This component's
 * own job is gating LINKS, not text: a companion tisk number only becomes a
 * link when (a) the evidence names one, (b) it resolves in the loaded corpus,
 * and (c) the evidence is not itself hedged as unresolved — and the subject
 * print's own header link is gated the same way (batch-015-audit.md M17):
 * the census and the bill corpus are two different artifacts and can
 * disagree on a tisk number, and an ungated Link straight from the payload
 * hard-404s at /zakony/[cislo] on that disagreement.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import type { DependencyData, DependencyHit } from "../getDependencyData";
import { resolveCompanionLink } from "../buildDependencyView";
import type { LawData } from "../getLawData";

/** „ten podnět" — masculine inanimate, so numeral congruence bends the verb
 * too (5+ takes a neuter-singular verb form): 1 podnět prošel · 2–4 podněty
 * prošly · 5+ podnětů prošlo. */
function podnetNoun(n: number): string {
  if (n === 1) return "podnět";
  if (n >= 2 && n <= 4) return "podněty";
  return "podnětů";
}
function podnetVerbProsel(n: number): string {
  if (n === 1) return "prošel";
  if (n >= 2 && n <= 4) return "prošly";
  return "prošlo";
}

export default function DependencyRadar({
  data,
  dependencyData,
  index,
}: {
  data: LawData;
  /** null ⇒ oba census payloady jsou nečitelné. Sekce se pak NEVYNECHÁ, jen řekne
   *  proč je prázdná: kotva `#zavislosti` je v levém pruhu, a pruh nesmí nabízet
   *  kotvu, která někdy nikam nevede (pravidlo z /poslanec). Prázdno se přiznává,
   *  stejně jako rejstřík posudků nad nulou posudků. */
  dependencyData: DependencyData | null;
  index: number;
}) {
  const t = useTranslations("lawwatch");
  const f = useFormat();
  const billTitleByCislo = new Map(data.bills.filter((b) => b.cislo != null).map((b) => [b.cislo as number, b.title]));

  if (!dependencyData) {
    return (
      <section id="zavislosti" className="mt-14 border-t-4 border-ink pt-10 pb-20">
        <SectionHeading
          index={index}
          title={t("dependencies.title")}
          aside={<SourceNote>census závislostí není k dispozici</SourceNote>}
        />
        <div className="mt-8 border-2 border-dashed border-hairline bg-paper-strong px-6 py-8">
          <p className="font-mono text-xs uppercase tracking-widest text-steel">census se nepodařilo přečíst</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-steel">
            Detektor zástupných citací e-Sbírky běží nad vlastními texty tisků a jeho výstup je
            samostatný artefakt, ne součást grafu — teď ho nelze přečíst. Sekce proto nic
            nevypisuje. Není to zjištění, že žádné závislosti nejsou; je to přiznaný výpadek
            vstupu.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="zavislosti" className="mt-14 border-t-4 border-ink pt-10 pb-20">
      <SectionHeading
        index={index}
        title={t("dependencies.title")}
        aside={
          <SourceNote>
            {f.int(dependencyData.bills.length)} tisků · {f.int(dependencyData.companionCount)}{" "}
            {podnetNoun(dependencyData.companionCount)} k prověření · texty tisků na psp.cz
          </SourceNote>
        }
      />

      <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-steel">
        Detektor prochází vlastní text každého tisku a hledá zástupnou citaci e-Sbírky
        („zákona č. …/2026 Sb.“), kterou předkladatel vkládá do novelizačních vět dřív, než je
        konečné číslo zákona známé. Klasifikace je řízena pravidly, ne ručně, a namátkově
        nezávisle prověřena — nezávislé prověření je zaznamenáno u{" "}
        <span className="font-bold text-ink">{f.int(dependencyData.spotCheckedCompanionCount)}</span> z{" "}
        <span className="font-bold text-ink">{f.int(dependencyData.companionCount)}</span> podnětů níže. Podnět se
        dělí na tři třídy — tisk cituje sám sebe (vlastní pozdější akt), tisk se opírá o JINÝ,
        doprovodný tisk, který musí projít současně nebo dřív, nebo podnět zůstává nejasný, protože
        v dostupném textu chybí důkaz pro kteroukoli z předchozích dvou možností.{" "}
        <span className="font-bold text-ink">{f.int(dependencyData.unclearCount)}</span> z{" "}
        <span className="font-bold text-ink">{f.int(dependencyData.totalTriaged)}</span> podnětů zůstává poctivě
        nejasných a níže se nevykreslují. Závislost na doprovodném tisku je fakt legislativního
        procesu — podnět k prověření rizika chybného pořadí přijetí (tento tisk počítá s tím, že
        doprovodný tisk už bude zákonem), nikoli obvinění z pochybení ani potvrzené zjištění.
      </p>

      <div className="mt-6 border-t-2 border-ink">
        {dependencyData.bills.map((bill) => {
          const title = billTitleByCislo.get(bill.cislo);
          const billExists = billTitleByCislo.has(bill.cislo);
          return (
            <div key={bill.cislo} className="border-b border-hairline py-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {billExists ? (
                  <Link
                    href={`/zakony/${bill.cislo}`}
                    className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-signal transition-colors hover:text-cobalt"
                  >
                    sn. tisk {bill.cislo}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ) : (
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-steel">
                    tisk {bill.cislo} (mimo korpus)
                  </span>
                )}
                {title && <span className="text-[13px] leading-snug text-steel">{title}</span>}
              </div>

              <ul className="mt-3 space-y-3">
                {bill.hits.map((hit, i) => (
                  <DependencyHitRow key={i} hit={hit} billTitleByCislo={billTitleByCislo} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {dependencyData.dedupedRowCount <
        dependencyData.companionCount - dependencyData.withheldHitCount - dependencyData.misalignedDroppedCount && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-steel">
          <span className="font-black uppercase tracking-wide text-steel">Poznámka: </span>
          Detektor hlásí {f.int(dependencyData.companionCount)} {podnetNoun(dependencyData.companionCount)} k
          prověření celkem, ale několik z nich pojmenovává stejnou závislost vícekrát v jednom tisku (stejný
          doprovodný tisk, stejný popis). Níže je zobrazeno {f.int(dependencyData.dedupedRowCount)} řádků — každá
          opakovaná shoda je sloučena do jednoho řádku se značkou „×N“.
        </p>
      )}

      {dependencyData.withheldHitCount > 0 && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-steel">
          <span className="font-black uppercase tracking-wide text-steel">Poznámka: </span>
          {f.int(dependencyData.withheldHitCount)} další {podnetNoun(dependencyData.withheldHitCount)} k prověření
          závislosti {podnetVerbProsel(dependencyData.withheldHitCount)} klasifikací, ale jeho popis neprošel
          jazykovou bránou (čeká na český přepis), takže se zde nezobrazuje.
        </p>
      )}

      {dependencyData.misalignedDroppedCount > 0 && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-steel">
          <span className="font-black uppercase tracking-wide text-steel">Poznámka: </span>
          {f.int(dependencyData.misalignedDroppedCount)} další {podnetNoun(dependencyData.misalignedDroppedCount)} k
          prověření závislosti {podnetVerbProsel(dependencyData.misalignedDroppedCount)} klasifikací, ale u
          příslušného tisku se počet nálezů v obou zdrojových souborech neshoduje — aby se citace neomylem
          nepřiřadila ke špatnému nálezu, tisk se zde vůbec nezobrazuje.
        </p>
      )}

      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        Census pokrývá tisky, u kterých se zástupná citace v textu vůbec objevila — tak, jak jich
        aktuálně přibývá v korpusu. S rostoucím počtem zpracovaných tisků poroste i tento seznam;
        žádný limit počtu řádků se nevynucuje.
      </p>

      <div className="mt-3">
        <SourceNote>
          vlastní text tisků na psp.cz · deterministický detektor, pravidly řízená klasifikace ·{" "}
          {f.int(dependencyData.unclearCount)} z {f.int(dependencyData.totalTriaged)} podnětů nejasných
        </SourceNote>
      </div>
    </section>
  );
}

/** One dependency lead. Every row carries the same derived/pending-review
 * marker (batch-015-audit.md B11) — this is a podnět k prověření, never a
 * finding — and the marker itself flags a hedged (weakEvidence) hit with a
 * dashed border and its own qualifier rather than staying visually identical
 * to an unhedged one. */
function DependencyHitRow({
  hit,
  billTitleByCislo,
}: {
  hit: DependencyHit;
  billTitleByCislo: Map<number, string>;
}) {
  const link = resolveCompanionLink(hit.likelyCompanionTisk, (t) => billTitleByCislo.has(t));
  const companionExists = link.kind === "linked";
  const outOfCorpusNumber = link.kind === "out-of-corpus";
  const rawTisk = link.kind !== "none" ? link.tisk : null;

  return (
    <li className="border-l-4 border-ochre pl-4">
      <span
        className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ochre ${
          hit.weakEvidence ? "border-dashed border-ochre/60" : "border-ochre"
        }`}
      >
        odvozeno · čeká na kontrolu{hit.weakEvidence ? " · vazba nejistá" : ""}
        {hit.dupeCount > 1 ? ` · ×${hit.dupeCount}` : ""}
      </span>
      <div className="mt-1.5 text-[13px] leading-snug">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ochre">závisí na: </span>
        {companionExists && (
          <Link
            href={`/zakony/${rawTisk}`}
            className="font-bold text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal"
          >
            sn. tisk {rawTisk}
          </Link>
        )}
        {companionExists && hit.companionSubject && <span className="ml-1 text-steel">{hit.companionSubject}</span>}
        {/* no chamber prefix below — a companion outside the corpus may be a Senate print
            (tisk 777 is), and „sn." would assert a chamber the data does not carry */}
        {!companionExists && outOfCorpusNumber && (
          <span className="italic text-steel">tisk {rawTisk} (mimo korpus — bez odkazu)</span>
        )}
        {!companionExists && !outOfCorpusNumber && hit.companionSubject && (
          <span className="italic text-steel">{hit.companionSubject}</span>
        )}
        {!companionExists && !outOfCorpusNumber && !hit.companionSubject && (
          <span className="italic text-steel">popis závislosti čeká na český přepis — citace textu níže je zachycena</span>
        )}
      </div>
      {hit.context && <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-steel">„{hit.context}“</p>}
    </li>
  );
}
