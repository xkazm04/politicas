/**
 * Deník republiky (/denik) — chronologický denní záznam státu, sázený jako
 * noviny záznamu: datovaná hlavička každého dne (vydání), pod ní strohé řádky
 * v hlase knihy datovaných faktů, každý se zdrojem, den s trvalou kotvou
 * `#d-<datum>`. „Sledovat entitu" je jen jiná adresa téže stránky
 * (`?entita=<klíč>`) — URL je odběr, žádné účty.
 *
 * Serverová komponenta — žádná interaktivita kromě odkazů; zvýraznění cílové
 * kotvy řeší CSS `:target`. Copy je záměrně česky přímo zde (messages/*.json
 * je sdílený soubor mimo plochu 3A — precedens /dukazy, batch 2C).
 */

import Link from "next/link";
import { ArrowUpRight, Eye } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { czechDate, czechInt } from "@/lib/format";
import { compactCzk } from "@/features/money/moneyTypes";
import { czechWeekday, DAYS_SHOWN, type DenikDay, type DenikEntry, type DenikLedger } from "./deriveDenik";
import type { DenikCoverage } from "./getDenikData";

const TONE_DOT: Record<DenikEntry["tone"], string> = {
  signal: "bg-signal",
  cobalt: "bg-cobalt",
  ink: "bg-steel",
  ochre: "bg-ochre",
};

function EntryRow({ e, followedKey }: { e: DenikEntry; followedKey: string | null }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3.5">
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${TONE_DOT[e.tone]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        {e.internalHref ? (
          <Link href={e.internalHref} className="hover:text-signal-deep hover:underline">
            {e.titleCs}
          </Link>
        ) : (
          e.titleCs
        )}
        {e.czk !== undefined && (
          <span className="ml-2 whitespace-nowrap font-mono text-[13px] font-bold tabular-nums">
            {compactCzk(e.czk, "cs")}
          </span>
        )}
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
          [{e.source}]
        </span>
        {/* Kterým časem je řádek datován — světový den události vs. den záznamu. */}
        {e.timeBasis === "zaznamenano" ? (
          <span className="ml-2 whitespace-nowrap border border-cobalt px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
            zaznamenáno
          </span>
        ) : (
          <span className="ml-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-steel-aa">
            účinné
          </span>
        )}
        {e.pending && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            stojí na vazbě čekající na lidskou kontrolu
          </span>
        )}
        {/* Sledovat entitu: filtr je adresa — každý čip je odkaz na vlastní deník entity. */}
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {e.entities.map((en) =>
            en.key === followedKey ? (
              <span
                key={en.key}
                className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt"
              >
                <Eye className="h-3 w-3" aria-hidden /> {en.label}
              </span>
            ) : (
              <Link
                key={en.key}
                href={`/denik?entita=${encodeURIComponent(en.key)}`}
                className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-steel-aa hover:text-cobalt hover:underline"
                aria-label={`Sledovat entitu ${en.label}`}
              >
                <Eye className="h-3 w-3" aria-hidden /> {en.label}
              </Link>
            ),
          )}
        </span>
      </span>
    </div>
  );
}

/** Datovaná hlavička dne — „vydání" novin záznamu, s trvalou kotvou. */
function DayMasthead({ day }: { day: DenikDay }) {
  const weekday = czechWeekday(day.date);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-ink pb-2">
      <h3 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
        {weekday ? `${weekday} ` : ""}
        {czechDate(day.date)}
        <span className="text-signal">.</span>
      </h3>
      <span className="flex items-baseline gap-4">
        <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
          zápisů: {czechInt(day.entries.length)}
        </span>
        <a
          href={`#${day.anchor}`}
          className="font-mono text-xs uppercase tracking-widest text-steel-aa hover:text-signal-deep hover:underline"
          aria-label={`Trvalý odkaz na den ${czechDate(day.date)}`}
        >
          #{day.anchor}
        </a>
      </span>
    </div>
  );
}

const COVERAGE_NOTES: { key: keyof DenikCoverage; note: string }[] = [
  { key: "money", note: "peněžní vrstva je teď nečitelná — smlouvy a rejstříkové role v deníku chybí" },
  { key: "law", note: "legislativní vrstva je teď nečitelná — přikázání výborům a vyhlášení ve Sbírce chybí" },
  { key: "reviews", note: "lidská brána je teď nečitelná — rozhodnutí revizorů v deníku chybí" },
  { key: "changes", note: "tabulka change_event je teď nečitelná — proud „zaznamenáno“ v deníku chybí" },
];

export interface DenikPageProps {
  /** null ⇒ žádná vrstva nebyla čitelná (čestný stav „nečitelné, ne prázdné"). */
  ledger: DenikLedger | null;
  coverage: DenikCoverage | null;
  auditRows: number;
  builtOn: string | null;
  /** Klíč sledované entity (`?entita=`), je-li pohled filtrovaný. */
  entityKey: string | null;
  /** Popisek sledované entity; null = klíč se v záznamech nenašel. */
  entityLabelCs: string | null;
}

export default function DenikPage({ ledger, coverage, auditRows, builtOn, entityKey, entityLabelCs }: DenikPageProps) {
  const feedQuery = entityKey ? `?entita=${encodeURIComponent(entityKey)}` : "";
  const missing = coverage ? COVERAGE_NOTES.filter((c) => !coverage[c.key]) : [];

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ denik</span>
          {/* Strojově čitelné podoby deníku — URL (včetně filtru) je odběr. */}
          <div className="flex items-center gap-4">
            <a
              href={`/denik/feed.xml${feedQuery}`}
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              RSS
            </a>
            <a
              href={`/denik/feed.json${feedQuery}`}
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              JSON
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">denní záznam republiky</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Deník republiky
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
          Co den, to zápis: podepsané smlouvy firem s vazbou na poslance, přikázání sněmovních tisků
          výborům, vyhlášení ve Sbírce, zápisy a výmazy rejstříkových rolí a rozhodnutí lidské brány.
          Každý řádek má datum, zdroj a den má trvalou adresu.
        </p>

        {/* Pravidlo deníku — co dny znamenají a proč (výsledek průzkumu úložiště). */}
        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">pravidlo deníku</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            Deník vede dva proudy a každý řádek přiznává, kterým časem je datován. Řádky{" "}
            <span className="font-mono text-[11px] uppercase tracking-wider">účinné</span> nesou den,
            kdy se událost <em>stala</em> podle svého registru (podpis smlouvy, zápis role, krok tisku)
            — ne den, kdy ji ingest našel. Řádky{" "}
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt">zaznamenáno</span>{" "}
            nesou den, kdy fakt <em>vstoupil do záznamu</em>: rozhodnutí lidské brány (review_audit je
            append-only log) a od zavedení bitemporálního grafu i změny grafu samotného (change_event —
            nová vazba, změna vazby, smlouva v grafu). Co graf zaznamenal před epochou bitemporální
            migrace, proud „zaznamenáno&ldquo; poctivě nenese — zpětně se nic neorazítkovává. Smlouvy se
            uvádějí jen u firem s vazbou typu vlastník/jednatel — smlouvy institucí, kde poslanec pouze
            zasedá v orgánu, jsou penězi té instituce.
          </p>
        </div>

        {/* Degradace po vrstvách — deník bez některé skupiny to říká nahlas. */}
        {missing.length > 0 && (
          <div className="mt-4 max-w-2xl border-l-4 border-ochre bg-paper-strong px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest">neúplné pokrytí</p>
            <ul className="mt-1 list-none text-sm leading-relaxed text-steel-aa">
              {missing.map((m) => (
                <li key={m.key}>{m.note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Aktivní filtr entity — pohled i odběr téhle entity. */}
        {entityKey && (
          <div className="mt-4 flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-1 border-l-4 border-cobalt bg-paper-strong px-4 py-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-cobalt">
              <Eye className="h-3.5 w-3.5" aria-hidden /> sledujete: {entityLabelCs ?? entityKey}
            </span>
            <Link
              href="/denik"
              className="font-mono text-xs uppercase tracking-widest text-steel-aa hover:text-signal-deep hover:underline"
            >
              zrušit filtr
            </Link>
          </div>
        )}

        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={1}
            title="Zápisy"
            aside={
              ledger && (
                <SourceNote>
                  zdroj: registr smluv + ares + psp.cz + review_audit ({czechInt(auditRows)} řádků brány) + change_event
                  {builtOn ? ` · sestaveno ${czechDate(builtOn)}` : ""}
                </SourceNote>
              )
            }
          />

          {ledger == null ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-lg">
                Zápisy teď nelze načíst — úložiště je v tomto prostředí nedostupné. Tahle stránka
                nemůže říct, jestli nějaké zápisy existují; deník není prázdný, jen nečitelný.
              </p>
            </div>
          ) : ledger.days.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              {entityKey ? (
                <p className="text-lg">
                  Pro sledovanou entitu deník žádný zápis nenese<span className="text-signal">.</span>{" "}
                  Buď o ní registry nedrží žádnou datovanou událost, nebo klíč „{entityKey}&ldquo;
                  neodpovídá žádné entitě záznamu.{" "}
                  <Link href="/denik" className="font-mono text-sm uppercase tracking-widest text-cobalt hover:underline">
                    celý deník
                  </Link>
                </p>
              ) : (
                <p className="text-lg">
                  Deník je zatím prázdný<span className="text-signal">.</span> Čitelné vrstvy nenesou
                  žádnou datovanou událost — první zápis se objeví, jakmile registry nějakou ponesou.
                </p>
              )}
              <div className="mt-3">
                <SourceNote>žádný záznam není zamlčen; vyhozená nemožná data: {czechInt(ledger.droppedImplausible)}</SourceNote>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8 space-y-12">
                {ledger.days.map((day) => (
                  <article key={day.date} id={day.anchor} className="scroll-mt-24 target:bg-paper-strong">
                    <DayMasthead day={day} />
                    <div>
                      {day.entries.map((e) => (
                        <EntryRow key={e.id} e={e} followedKey={entityKey} />
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              {/* Meze plochy — kolik dnů korpus nese a kolik jich stránka ukazuje. */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <SourceNote>
                  {ledger.daysTotal > ledger.days.length
                    ? `zapsaných dnů celkem ${czechInt(ledger.daysTotal)}; stránka ukazuje posledních ${czechInt(ledger.days.length)} (strop ${czechInt(DAYS_SHOWN)}) — starší dny nese filtr entity a strojové podoby`
                    : `zapsaných dnů celkem ${czechInt(ledger.daysTotal)}`}
                  {ledger.droppedImplausible > 0
                    ? ` · záznamů s nemožným datem vyhozeno ${czechInt(ledger.droppedImplausible)} (datum se nikdy neopravuje)`
                    : ""}
                </SourceNote>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/dukazy"
                  className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
                >
                  deník důkazů{" "}
                  <ArrowUpRight
                    className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </Link>
                <SourceNote>kotvy dnů: #d-&lt;datum&gt; · guid záznamu: politicas:denik:&lt;id&gt;</SourceNote>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
