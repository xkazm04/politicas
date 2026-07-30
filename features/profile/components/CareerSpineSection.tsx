"use client";

/*
 * Kariérní spis — svislá stuha volebních období ve hlavičce spisu.
 *
 * Vizuální hlas je záměrně hlas knihy datovaných faktů (dashboard/FactRow):
 * datový sloupec v mono verzálkách, tónová tečka, věta složená z typovaných
 * polí, citace zdroje v hranaté závorce. Nerozvětvuje se tu třetí styl
 * datovaného řádku — jen se stejná řeč čte podél svislé osy služby.
 *
 * Datová poctivost (viz ../careerSpine.ts): mandáty jsou v registru pro
 * VŠECHNA období PSP1–PSP10, ale záznam AKTIVITY jen pro běžící období
 * (a částečně PSP9). Období bez záznamu nese přiznanou mezeru „období zatím
 * mimo záznam — zdroj: psp.cz" — nikdy dopočtená čísla. Nesouvislá služba
 * („mimo sněmovnu") je reálná nepřítomnost z registru, ne mezera v datech.
 *
 * Copy je česky přímo tady po vzoru DataUnavailable/FactRow-Exponát:
 * messages/*.json je sdílený soubor a tahle plocha do něj nezapisuje.
 */

import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import type { CareerSpine, CareerTerm } from "../careerSpine";

/** „8. volební období" / fallback na syrový kód mimo konvenci. */
const termTitle = (t: CareerTerm): string =>
  t.termNumber !== null ? `${t.termNumber}. volební období` : t.termCode;

/** Roky do datového sloupce: „2017–2021", u běžícího „od 2025". */
const yearsOf = (t: CareerTerm): string => {
  const fromYear = (t.mandateFrom ?? t.chamberFrom)?.slice(0, 4) ?? null;
  const toYear = (t.mandateTo ?? t.chamberTo)?.slice(0, 4) ?? null;
  if (fromYear === null) return "—";
  if (t.openEnded || toYear === null) return `od ${fromYear}`;
  return `${fromYear}–${toYear}`;
};

/** „× volebních období" se správnou českou číslovkou. */
const servedLabel = (n: number): string =>
  n === 1 ? "1 volební období" : n >= 2 && n <= 4 ? `${n} volební období` : `${n} volebních období`;

function TermRow({ term, f }: { term: CareerTerm; f: ReturnType<typeof useFormat> }) {
  return (
    <div
      className={`grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline py-3 pr-2 sm:grid-cols-[5.5rem_auto_1fr] ${
        term.current ? "border-l-4 border-l-signal bg-paper-strong pl-3" : "pl-4"
      }`}
    >
      <span className="col-span-2 font-mono text-[11px] uppercase tracking-wider text-steel sm:col-span-1">
        {yearsOf(term)}
      </span>
      <span
        className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${term.current ? "bg-signal" : "bg-steel"}`}
        aria-hidden
      />
      <span className="min-w-0 text-[15px] leading-relaxed">
        <span className={term.current ? "font-black uppercase tracking-tight" : "font-bold"}>
          {termTitle(term)}
        </span>
        {term.partyList && <span className="text-steel"> · kandidátka {term.partyList}</span>}
        {term.region && <span className="text-steel"> · {term.region}</span>}
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
          [psp.cz]
        </span>
        {/* Osobní okno mandátu — jen když ho registr doopravdy nese. */}
        {term.mandateFrom && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
            {term.openEnded
              ? `mandát od ${f.date(term.mandateFrom)} · běží`
              : term.mandateTo
                ? `mandát ${f.date(term.mandateFrom)} – ${f.date(term.mandateTo)}`
                : `mandát od ${f.date(term.mandateFrom)}`}
            {term.stintCount > 1 ? ` · ${term.stintCount} úseky` : ""}
          </span>
        )}
        {term.windowUnknown && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
            osobní okno mandátu v registru chybí
          </span>
        )}
        {term.dateUnreadable && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            datum v registru nečitelné — potlačeno, neopraveno
          </span>
        )}
        {/* Pokrytí záznamu aktivity — přiznaná mezera, nikdy dopočtený trend. */}
        {term.coverage === "none" && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            období zatím mimo záznam — zdroj: psp.cz
          </span>
        )}
        {term.coverage === "partial" && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
            záznam částečný (bez sněmovních hlasování) — viz vývoj výše
          </span>
        )}
        {term.current && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-signal">
            běžící období — úplný záznam tohoto spisu
          </span>
        )}
      </span>
    </div>
  );
}

export default function CareerSpineSection({ career, asOf }: { career: CareerSpine; asOf: string }) {
  const f = useFormat();
  if (career.terms.length === 0) return null;

  // Přestávka se vykresluje ZA obdobím, po kterém následuje.
  const breakAfter = new Map(career.breaks.map((b) => [b.afterTermCode, b]));

  return (
    <section aria-label="Služební záznam" className="mt-10">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
        Služební záznam · {servedLabel(career.servedTermCount)}
      </p>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-steel">
        Mandáty poslance napříč volebními obdobími podle registru psp.cz. Období bez
        ingestovaného záznamu aktivity jsou přiznaná, nikdy dopočtená.
      </p>
      <div className="mt-4 border-t-2 border-ink">
        {career.terms.map((term) => (
          <div key={term.termCode}>
            <TermRow term={term} f={f} />
            {breakAfter.has(term.termCode) && (
              <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 border-b border-dashed border-hairline py-2 pl-4 sm:grid-cols-[5.5rem_auto_1fr]">
                <span className="font-mono text-[11px] uppercase tracking-wider text-steel">·</span>
                <span aria-hidden />
                <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                  mimo sněmovnu · {breakAfter.get(term.termCode)!.missedTermCodes.join(", ")}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <SourceNote className="mt-2 !text-[10px]">
        psp.cz · poslanec + zarazeni (registr všech období) · hodnoceno k {f.date(asOf)}
      </SourceNote>
    </section>
  );
}
