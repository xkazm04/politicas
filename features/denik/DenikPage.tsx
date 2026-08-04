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
import { denikKindLabel, TIME_BASIS_TITLE } from "./kindLabels";
import type { DenikCoverage, DenikLimits } from "./getDenikData";
import FollowButton from "@/features/schranka/FollowButton";

const TONE_DOT: Record<DenikEntry["tone"], string> = {
  signal: "bg-signal",
  cobalt: "bg-cobalt",
  ink: "bg-steel",
  ochre: "bg-ochre",
};

/**
 * Jeden zápis. ČTE SE JAKO ŘÁDEK KNIHY, ne jako odstavec: druh SLOVEM (tečka
 * je jeho dekorace, ne jediný nositel — `aria-hidden` tečka byla do 2026-08-04
 * jediné, co druh sdělovalo), věta, částka, zdroj, časová osa s vlastním
 * výkladem u sebe, doklady do primárních rejstříků a čipy entit.
 *
 * `<li>` uvnitř `<ul>` dne: seznam zápisů JE seznam a čtečka to má vědět
 * („položka 3 z 12“). `<time dateTime>` nese den strojově i pro řádek, který
 * někdo přečte mimo jeho hlavičku.
 */
function EntryRow({ e, followedKey, dayCs }: { e: DenikEntry; followedKey: string | null; dayCs: string }) {
  const kind = denikKindLabel(e.kind);
  return (
    <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3.5">
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${TONE_DOT[e.tone]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        <time dateTime={e.date} className="sr-only">
          {dayCs}
        </time>
        {/* Druh SLOVEM — tečka vlevo je jeho barevná dekorace. */}
        <span className="mr-2 whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
          {kind.text}
          {!kind.translated && (
            <span className="ml-1 font-normal normal-case tracking-normal">(nepřeložený druh)</span>
          )}
        </span>
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
        {/* Kterým časem je řádek datován — a co to znamená, U ŘÁDKU: výklad
            stál 200 px výš, mimo pohled čtenáře, který zrovna čte tenhle řádek.
            Tečkované podtržení je viditelný příslib vysvětlení. */}
        {e.timeBasis === "zaznamenano" ? (
          <span
            className="ml-2 cursor-help whitespace-nowrap border border-cobalt px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt"
            title={TIME_BASIS_TITLE.zaznamenano}
            aria-label={TIME_BASIS_TITLE.zaznamenano}
          >
            zaznamenáno
          </span>
        ) : (
          <span
            className="ml-2 cursor-help whitespace-nowrap border-b border-dotted border-steel font-mono text-[10px] uppercase tracking-wider text-steel-aa"
            title={TIME_BASIS_TITLE.ucinne}
            aria-label={TIME_BASIS_TITLE.ucinne}
          >
            účinné
          </span>
        )}
        {e.pending && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            stojí na vazbě čekající na lidskou kontrolu
          </span>
        )}
        {/* Doklad: co si čtenář může sám otevřít. Do 2026-08-04 tu stálo jen
            JMÉNO rejstříku v hranatých závorkách — citace, kterou neslo přečíst. */}
        {(e.links.length > 0 || e.evidence.length > 0) && (
          <span className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {e.links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-mono text-[11px] uppercase tracking-wider text-signal-deep hover:underline"
              >
                {l.label}
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </a>
            ))}
            {e.evidence.map((ev) => (
              <span
                key={`${ev.label}:${ev.value}`}
                className="font-mono text-[11px] tracking-wider text-steel"
              >
                {ev.label}: {ev.value}
              </span>
            ))}
          </span>
        )}
        {/* Filtr je adresa — každý čip je odkaz na vlastní deník entity. Sledovat
            se dá až v tom pohledu (tlačítko u filtru), čip sám nic neukládá. */}
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
                aria-label={`Deník entity ${en.label}`}
              >
                <Eye className="h-3 w-3" aria-hidden /> {en.label}
              </Link>
            ),
          )}
        </span>
      </span>
    </li>
  );
}

/** Datovaná hlavička dne — „vydání" novin záznamu, s trvalou kotvou. */
function DayMasthead({ day }: { day: DenikDay }) {
  const weekday = czechWeekday(day.date);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-ink pb-2">
      <h3 id={`h-${day.anchor}`} className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
        {/* Den vydání strojově čitelně — kotva `#d-<datum>` je jeho adresa,
            `<time dateTime>` jeho datum. */}
        <time dateTime={day.date}>
          {weekday ? `${weekday} ` : ""}
          {czechDate(day.date)}
        </time>
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

/**
 * MEZE ČTENÍ, VYPSANÉ VĚTOU (2026-08-04). Každý strop, který smí ztratit řádek,
 * má svou větu a svůj počet — precedens `droppedImplausible`: vyhozeno,
 * spočítáno, počet vypsán. Věta se ukáže jen tehdy, když se mez SKUTEČNĚ
 * dotkla dat; nulová mez je pojistka, ne sdělení.
 */
function limitNotes(limits: DenikLimits, ledger: DenikLedger | null): string[] {
  const notes: string[] = [];
  if (limits.companiesOverCap > 0) {
    notes.push(
      `firem s přisouditelnou vazbou je víc než strop ${czechInt(limits.companyCap)}; ` +
        `smlouvy ${czechInt(limits.companiesOverCap)} z nich se nečetly vůbec`,
    );
  }
  if (limits.companiesEdgeTruncated > 0) {
    notes.push(
      `u ${czechInt(limits.companiesEdgeTruncated)} firem se dosáhlo stropu ` +
        `${czechInt(limits.edgeCap)} smluv na firmu — jejich starší smlouvy deník nenese`,
    );
  }
  if (limits.malformedIco > 0) {
    notes.push(
      `${czechInt(limits.malformedIco)} vazeb nese IČO, které nelze převést na kanonický tvar; ` +
        `řádek se zobrazuje, ale firmu v něm nelze sledovat ani otevřít`,
    );
  }
  if (limits.changesUndisplayable > 0) {
    notes.push(
      `${czechInt(limits.changesUndisplayable)} záznamů grafu nese druh, který tahle verze deníku neumí vyslovit — ` +
        `nezobrazují se, ale ani nemizí bez počtu`,
    );
  }
  if (limits.changesFromGate > 0) {
    notes.push(
      `${czechInt(limits.changesFromGate)} záznamů grafu popisuje rozhodnutí lidské brány; ` +
        `ta deník uvádí ze samotného review_audit, aby se událost nepočítala dvakrát`,
    );
  }
  if (ledger && ledger.mergedContractRows > 0) {
    notes.push(
      `${czechInt(ledger.mergedContractRows)} řádků o smlouvách se slilo do jiného — ` +
        `jedna smlouva je jeden řádek, i když ji v grafu dodává víc firem`,
    );
  }
  if (ledger && ledger.contractAmountConflicts > 0) {
    notes.push(
      `${czechInt(ledger.contractAmountConflicts)} slitých smluv neslo rozporné částky, ` +
        `a proto neuvádějí žádnou (vybrat jednu by znamenalo vymyslet peníze)`,
    );
  }
  return notes;
}

export interface DenikPageProps {
  /** null ⇒ žádná vrstva nebyla čitelná (čestný stav „nečitelné, ne prázdné"). */
  ledger: DenikLedger | null;
  coverage: DenikCoverage | null;
  /** Meze čtení loaderu; null při zcela nečitelném úložišti. */
  limits: DenikLimits | null;
  auditRows: number;
  builtOn: string | null;
  /** Klíč sledované entity (`?entita=`), je-li pohled filtrovaný. */
  entityKey: string | null;
  /** Popisek sledované entity; null = klíč se v záznamech nenašel. */
  entityLabelCs: string | null;
}

export default function DenikPage({
  ledger,
  coverage,
  limits,
  auditRows,
  builtOn,
  entityKey,
  entityLabelCs,
}: DenikPageProps) {
  const feedQuery = entityKey ? `?entita=${encodeURIComponent(entityKey)}` : "";
  const missing = coverage ? COVERAGE_NOTES.filter((c) => !coverage[c.key]) : [];
  const limitsCs = limits ? limitNotes(limits, ledger) : [];

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

        {/* Meze čtení — každý strop, který smí ztratit řádek, se přizná i s počtem. */}
        {limitsCs.length > 0 && (
          <div className="mt-4 max-w-2xl border-l-4 border-steel bg-paper-strong px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest">meze čtení</p>
            <ul className="mt-1 list-none space-y-1 text-sm leading-relaxed text-steel-aa">
              {limitsCs.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Aktivní filtr entity. Dřív tu stálo „sledujete:" — filtr je ale
            POHLED, ne odběr; sledování je tlačítko vedle a žije ve schránce. */}
        {entityKey && (
          <div className="mt-4 max-w-2xl border-l-4 border-cobalt bg-paper-strong px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-cobalt">
                <Eye className="h-3.5 w-3.5" aria-hidden /> filtr entity: {entityLabelCs ?? entityKey}
              </span>
              <Link
                href="/denik"
                className="font-mono text-xs uppercase tracking-widest text-steel-aa hover:text-signal-deep hover:underline"
              >
                zrušit filtr
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <FollowButton
                entityKey={entityKey}
                label={entityLabelCs ?? entityKey}
                subject={entityLabelCs ?? entityKey}
                compact
              />
              <span className="text-sm leading-relaxed text-steel-aa">
                Sledovaná entita se ukládá jen ve vašem prohlížeči; co jí přibylo od minulé
                návštěvy, pak sečte{" "}
                <Link
                  href="/schranka"
                  className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
                >
                  občanská schránka
                </Link>
                .
              </span>
            </div>
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
              {/* Vydání dne = <article>, jeho zápisy = <ul>/<li>. Byly to holé
                  <div>y, takže čtečka nevěděla, že jde o seznam, ani kolik má
                  položek — deník je přitom seznam ze všeho nejdřív. */}
              <div className="mt-8 space-y-12">
                {ledger.days.map((day) => (
                  <article
                    key={day.date}
                    id={day.anchor}
                    aria-labelledby={`h-${day.anchor}`}
                    className="scroll-mt-24 target:bg-paper-strong"
                  >
                    <DayMasthead day={day} />
                    <ul className="list-none" aria-label={`Zápisy dne ${czechDate(day.date)}`}>
                      {day.entries.map((e) => (
                        <EntryRow key={e.id} e={e} followedKey={entityKey} dayCs={czechDate(day.date)} />
                      ))}
                    </ul>
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
