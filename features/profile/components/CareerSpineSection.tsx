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
 * Copy jde přes messages/*.json (`profile.career*`) jako zbytek spisu —
 * serverIntl.profileIntl(), tatáž dvojice { t, f } jako u ostatních oddílů.
 */

import type { Formatters } from "@/lib/format";
import { profileIntl, type ProfileIntl } from "../serverIntl";
import SourceNote from "@/features/shared/components/SourceNote";
import { careerYears, type CareerSpine, type CareerTerm } from "../careerSpine";

type T = ProfileIntl["t"];

/** „8. volební období" / fallback na syrový kód mimo konvenci. */
const termTitle = (t: T, term: CareerTerm): string =>
  term.termNumber !== null ? t("careerTermTitle", { n: term.termNumber }) : term.termCode;

/**
 * Roky do datového sloupce. Které okno se kreslí a co z něj, ROZHODUJE ČISTÉ
 * PRAVIDLO `careerYears()` (../careerSpine.ts) — tady se jen na jeho tvar věší
 * věta z katalogu. Do 2026-08-13 to pravidlo bylo napsané uvnitř téhle
 * komponenty jako `mandateFrom ?? chamberFrom` – `mandateTo ?? chamberTo`, tedy
 * dvě nezávislé volby, které mlčky mísily osobní okno se sněmovním; v téhle
 * repozitáři nemá jsdom co spustit, takže se to nedalo pojistit ničím.
 */
const yearsOf = (t: T, term: CareerTerm): string => {
  const y = careerYears(term);
  switch (y.kind) {
    case "mandateSince":
      return t("careerYearsSince", { year: y.from });
    case "mandateRange":
      return `${y.from}–${y.to}`;
    case "mandateFromOnly":
      return t("careerYearsFromOnly", { year: y.from });
    case "chamberRange":
      return t("careerYearsChamber", { from: y.from, to: y.to });
    case "chamberSince":
      return t("careerYearsChamberSince", { year: y.from });
    case "unknown":
      return "—";
  }
};

function TermRow({ term, t, f }: { term: CareerTerm; t: T; f: Formatters }) {
  // ZVÝRAZNĚNÍ PATŘÍ SLUŽBĚ, NE KALENDÁŘI. `current` je fakt o období, `serving`
  // o člověku: poslanec, který se mandátu v běžícím období vzdal, tu dosud
  // dostával signální rámeček a četl se jako aktivní.
  const serving = term.serving === true;
  return (
    <div
      className={`grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline py-3 pr-2 sm:grid-cols-[5.5rem_auto_1fr] ${
        serving ? "border-l-4 border-l-signal bg-paper-strong pl-3" : "pl-4"
      }`}
    >
      <span className="col-span-2 font-mono text-[11px] uppercase tracking-wider text-steel sm:col-span-1">
        {yearsOf(t, term)}
      </span>
      <span
        className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${serving ? "bg-signal" : "bg-steel"}`}
        aria-hidden
      />
      <span className="min-w-0 text-[15px] leading-relaxed">
        <span className={serving ? "font-black uppercase tracking-tight" : "font-bold"}>
          {termTitle(t, term)}
        </span>
        {term.partyList && <span className="text-steel"> · {t("careerPartyList", { list: term.partyList })}</span>}
        {term.region && <span className="text-steel"> · {term.region}</span>}
        {/* Citace řádku jde z katalogu jako každá jiná — „[psp.cz]" tu bylo
            napsané natvrdo v JSX, mimo katalog i mimo SourceNote, v oddílu,
            který vlastní SourceNote o pár řádků níž má. */}
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
          {t("careerRowSource")}
        </span>
        {/* Osobní okno mandátu — jen když ho registr doopravdy nese. */}
        {term.mandateFrom && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
            {term.openEnded
              ? t("careerMandateSinceRunning", { date: f.date(term.mandateFrom) })
              : term.mandateTo
                ? t("careerMandateRange", { from: f.date(term.mandateFrom), to: f.date(term.mandateTo) })
                : t("careerMandateSince", { date: f.date(term.mandateFrom) })}
            {term.stintCount > 1
              ? ` · ${t("careerStints", { count: term.stintCount, countFmt: f.int(term.stintCount) })}`
              : ""}
          </span>
        )}
        {term.windowUnknown && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
            {t("careerWindowUnknown")}
          </span>
        )}
        {term.dateUnreadable && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            {t("careerDateUnreadable")}
          </span>
        )}
        {/* Pokrytí záznamu aktivity — přiznaná mezera, nikdy dopočtený trend. */}
        {term.coverage === "none" && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            {t("careerCoverageNone")}
          </span>
        )}
        {term.coverage === "partial" && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
            {t("careerCoveragePartial")}
          </span>
        )}
        {/* Věta o POKRYTÍ ZÁZNAMU (fakt o období), proto visí na `current`.
            Že poslanec v tom období už nesedí, je jiný fakt a má vlastní řádek. */}
        {term.current && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-signal">
            {t("careerCoverageCurrent")}
          </span>
        )}
        {term.current && term.serving === false && (
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            {t("careerNotServing")}
          </span>
        )}
      </span>
    </div>
  );
}

export default async function CareerSpineSection({ career, asOf }: { career: CareerSpine; asOf: string }) {
  const { t, f } = await profileIntl();
  if (career.terms.length === 0) return null;

  // Přestávka se vykresluje ZA obdobím, po kterém následuje.
  const breakAfter = new Map(career.breaks.map((b) => [b.afterTermCode, b]));

  return (
    // Kariérní spis stojí v hlavičce, ne mezi číslovanými oddíly — kotvu má proto,
    // aby na služební záznam vedla trvalá adresa, ne aby se objevil v liště.
    <section id="kariera" aria-label={t("careerHeading")} className="mt-10">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
        {t("careerHeading")} ·{" "}
        {t("careerServedTerms", { count: career.servedTermCount, countFmt: f.int(career.servedTermCount) })}
      </p>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-steel">{t("careerLead")}</p>
      <div className="mt-4 border-t-2 border-ink">
        {career.terms.map((term) => (
          <div key={term.termCode}>
            <TermRow term={term} t={t} f={f} />
            {breakAfter.has(term.termCode) && (
              <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 border-b border-dashed border-hairline py-2 pl-4 sm:grid-cols-[5.5rem_auto_1fr]">
                <span className="font-mono text-[11px] uppercase tracking-wider text-steel">·</span>
                <span aria-hidden />
                <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                  {t("careerBreak", { terms: breakAfter.get(term.termCode)!.missedTermCodes.join(", ") })}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <SourceNote className="mt-2 !text-[10px]">{t("careerSource", { date: f.date(asOf) })}</SourceNote>
    </section>
  );
}
