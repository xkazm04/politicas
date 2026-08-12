/**
 * Deník republiky (/denik) — chronologický denní záznam státu, sázený jako
 * noviny záznamu: datovaná hlavička každého dne (vydání), pod ní strohé řádky
 * v hlase knihy datovaných faktů, každý se zdrojem, den s trvalou kotvou
 * `#d-<datum>`. „Sledovat entitu" je jen jiná adresa téže stránky
 * (`?entita=<klíč>`) — URL je odběr, žádné účty.
 *
 * Serverová komponenta — žádná interaktivita kromě odkazů; zvýraznění cílové
 * kotvy řeší CSS `:target`.
 *
 * COPY JE V KATALOGU (2026-08-05): čtenářská věta žije v messages/{cs,en}.json
 * pod `denik.*` a plocha ji sází přes next-intl — čisté moduly (deriveDenik.ts,
 * kindLabels.ts) vracejí KLÍČE, ne text (vzor features/overeni). Strojové
 * podoby (RSS/JSON) zůstávají jednojazyčné a mluví brankovanou češtinou
 * (`titleCs`, `source`) — feed je artefakt, ne plocha.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Eye } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { formatCompactCzk, formatDate, formatInt } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { weekdayKey, DAYS_SHOWN, type DenikDay, type DenikEntry, type DenikLedger } from "./deriveDenik";
import {
  denikKindInfo,
  DENIK_KIND_UNMAPPED_NOTE_KEY,
  TIME_BASIS_LABEL_KEYS,
  TIME_BASIS_TITLE_KEYS,
} from "./kindLabels";
import { limitNotes } from "./limitNotes";
import type { DenikCoverage, DenikLimits } from "./getDenikData";
import FollowButton from "@/features/schranka/FollowButton";

/** Překladač namespace `denik` — jediný typ, který si komponenty předávají. */
type T = ReturnType<typeof useTranslations<"denik">>;

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
function EntryRow({
  e,
  followedKey,
  dayLabel,
  locale,
  t,
}: {
  e: DenikEntry;
  followedKey: string | null;
  dayLabel: string;
  locale: Locale;
  t: T;
}) {
  const kind = denikKindInfo(e.kind);
  const timeBasisTitle = t(TIME_BASIS_TITLE_KEYS[e.timeBasis]);
  return (
    <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3.5">
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${TONE_DOT[e.tone]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        <time dateTime={e.date} className="sr-only">
          {dayLabel}
        </time>
        {/* Druh SLOVEM — tečka vlevo je jeho barevná dekorace. */}
        <span className="mr-2 whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
          {kind.known ? t(kind.labelKey) : t(kind.labelKey, { token: kind.token })}
          {!kind.known && (
            <span className="ml-1 font-normal normal-case tracking-normal">
              {t(DENIK_KIND_UNMAPPED_NOTE_KEY)}
            </span>
          )}
        </span>
        {e.internalHref ? (
          <Link href={e.internalHref} className="hover:text-signal-deep hover:underline">
            {e.title ? t(e.title.key, e.title.params) : e.titleCs}
          </Link>
        ) : e.title ? (
          t(e.title.key, e.title.params)
        ) : (
          e.titleCs
        )}
        {e.czk !== undefined && (
          <span className="ml-2 whitespace-nowrap font-mono text-[13px] font-bold tabular-nums">
            {formatCompactCzk(e.czk, locale)}
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
            title={timeBasisTitle}
            aria-label={timeBasisTitle}
          >
            {t(TIME_BASIS_LABEL_KEYS.zaznamenano)}
          </span>
        ) : (
          <span
            className="ml-2 cursor-help whitespace-nowrap border-b border-dotted border-steel font-mono text-[10px] uppercase tracking-wider text-steel-aa"
            title={timeBasisTitle}
            aria-label={timeBasisTitle}
          >
            {t(TIME_BASIS_LABEL_KEYS.ucinne)}
          </span>
        )}
        {e.pending && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            {t("entryRow.pending")}
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
            {/* Ukazatel, který má na platformě vlastní adresu, JE odkaz: řádek
                rozhodnutí brány nese id, pod kterým totéž rozhodnutí kotví
                Deník důkazů (`/dukazy#z-<id>`). Adresu skládá kodek u zdroje
                (deriveDenik → evidenceHref), tady se jen vykresluje; ukazatel
                bez adresy (tabulka, hrana grafu) zůstává textem — odkaz se
                nedomýšlí. */}
            {e.evidence.map((ev) =>
              ev.href ? (
                <Link
                  key={`${ev.label}:${ev.value}`}
                  href={ev.href}
                  className="font-mono text-[11px] tracking-wider text-signal-deep hover:underline"
                  aria-label={t("entryRow.evidenceAria", { label: ev.label, value: ev.value })}
                >
                  {ev.label}: {ev.value}
                </Link>
              ) : (
                <span
                  key={`${ev.label}:${ev.value}`}
                  className="font-mono text-[11px] tracking-wider text-steel"
                >
                  {ev.label}: {ev.value}
                </span>
              ),
            )}
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
                aria-label={t("entryRow.entityAria", { label: en.label })}
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
function DayMasthead({ day, locale, t }: { day: DenikDay; locale: Locale; t: T }) {
  const wk = weekdayKey(day.date);
  const dayLabel = formatDate(day.date, locale);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-ink pb-2">
      <h3 id={`h-${day.anchor}`} className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
        {/* Den vydání strojově čitelně — kotva `#d-<datum>` je jeho adresa,
            `<time dateTime>` jeho datum. */}
        <time dateTime={day.date}>
          {wk ? `${t(wk)} ` : ""}
          {dayLabel}
        </time>
        <span className="text-signal">.</span>
      </h3>
      <span className="flex items-baseline gap-4">
        <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
          {t("masthead.entries", { n: formatInt(day.entries.length, locale) })}
        </span>
        <a
          href={`#${day.anchor}`}
          className="font-mono text-xs uppercase tracking-widest text-steel-aa hover:text-signal-deep hover:underline"
          aria-label={t("masthead.permalinkAria", { date: dayLabel })}
        >
          #{day.anchor}
        </a>
      </span>
    </div>
  );
}

const COVERAGE_NOTE_KEYS: { key: keyof DenikCoverage; noteKey: string }[] = [
  { key: "money", noteKey: "coverage.money" },
  { key: "law", noteKey: "coverage.law" },
  { key: "reviews", noteKey: "coverage.reviews" },
  { key: "changes", noteKey: "coverage.changes" },
];

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
  locale: Locale;
}

export default function DenikPage({
  ledger,
  coverage,
  limits,
  auditRows,
  builtOn,
  entityKey,
  entityLabelCs,
  locale,
}: DenikPageProps) {
  const t = useTranslations("denik");
  const feedQuery = entityKey ? `?entita=${encodeURIComponent(entityKey)}` : "";
  const missing = coverage ? COVERAGE_NOTE_KEYS.filter((c) => !coverage[c.key]) : [];
  const limitRows = limits ? limitNotes(limits, ledger, locale) : [];

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
        <SourceNote tone="signal">{t("kicker")}</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("title")}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">{t("lead")}</p>

        {/* Pravidlo deníku — co dny znamenají a proč (výsledek průzkumu úložiště). */}
        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">{t("rule.kicker")}</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            {t.rich("rule.body", {
              em: (chunks) => <em>{chunks}</em>,
              ucinne: (chunks) => (
                <span className="font-mono text-[11px] uppercase tracking-wider">{chunks}</span>
              ),
              zaznamenano: (chunks) => (
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt">
                  {chunks}
                </span>
              ),
            })}
          </p>
        </div>

        {/* Degradace po vrstvách — deník bez některé skupiny to říká nahlas. */}
        {missing.length > 0 && (
          <div className="mt-4 max-w-2xl border-l-4 border-ochre bg-paper-strong px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
              {t("coverage.kicker")}
            </p>
            <ul className="mt-1 list-none text-sm leading-relaxed text-steel-aa">
              {missing.map((m) => (
                <li key={m.key}>{t(m.noteKey)}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Meze čtení — každý strop, který smí ztratit řádek, se přizná i s počtem. */}
        {limitRows.length > 0 && (
          <div className="mt-4 max-w-2xl border-l-4 border-steel bg-paper-strong px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
              {t("limits.kicker")}
            </p>
            <ul className="mt-1 list-none space-y-1 text-sm leading-relaxed text-steel-aa">
              {limitRows.map((n) => (
                <li key={n.key}>{t(n.key, n.values)}</li>
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
                <Eye className="h-3.5 w-3.5" aria-hidden />{" "}
                {t("filter.label", { entity: entityLabelCs ?? entityKey })}
              </span>
              <Link
                href="/denik"
                className="font-mono text-xs uppercase tracking-widest text-steel-aa hover:text-signal-deep hover:underline"
              >
                {t("filter.clear")}
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
                {t.rich("filter.inboxNote", {
                  schranka: (chunks) => (
                    <Link
                      href="/schranka"
                      className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </div>
          </div>
        )}

        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={1}
            title={t("section.title")}
            aside={
              ledger && (
                <SourceNote>
                  {t("section.source", { rows: formatInt(auditRows, locale) })}
                  {builtOn ? ` · ${t("section.builtOn", { date: formatDate(builtOn, locale) })}` : ""}
                </SourceNote>
              )
            }
          />

          {ledger == null ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-lg">{t("unreadable")}</p>
            </div>
          ) : ledger.days.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              {entityKey ? (
                <p className="text-lg">
                  {t("emptyEntity.lead")}
                  <span className="text-signal">.</span> {t("emptyEntity.body", { key: entityKey })}{" "}
                  <Link
                    href="/denik"
                    className="font-mono text-sm uppercase tracking-widest text-cobalt hover:underline"
                  >
                    {t("emptyEntity.link")}
                  </Link>
                </p>
              ) : (
                <p className="text-lg">
                  {t("empty.lead")}
                  <span className="text-signal">.</span> {t("empty.body")}
                </p>
              )}
              <div className="mt-3">
                <SourceNote>
                  {t("empty.note", { n: formatInt(ledger.droppedImplausible, locale) })}
                </SourceNote>
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
                    <DayMasthead day={day} locale={locale} t={t} />
                    <ul
                      className="list-none"
                      aria-label={t("dayList.aria", { date: formatDate(day.date, locale) })}
                    >
                      {day.entries.map((e) => (
                        <EntryRow
                          key={e.id}
                          e={e}
                          followedKey={entityKey}
                          dayLabel={formatDate(day.date, locale)}
                          locale={locale}
                          t={t}
                        />
                      ))}
                    </ul>
                  </article>
                ))}
              </div>

              {/* Meze plochy — kolik dnů korpus nese a kolik jich stránka ukazuje. */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <SourceNote>
                  {ledger.daysTotal > ledger.days.length
                    ? t("daysNote.truncated", {
                        total: formatInt(ledger.daysTotal, locale),
                        shown: formatInt(ledger.days.length, locale),
                        cap: formatInt(DAYS_SHOWN, locale),
                      })
                    : t("daysNote.total", { total: formatInt(ledger.daysTotal, locale) })}
                  {ledger.droppedImplausible > 0
                    ? ` · ${t("daysNote.dropped", { n: formatInt(ledger.droppedImplausible, locale) })}`
                    : ""}
                </SourceNote>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/dukazy"
                  className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
                >
                  {t("evidenceLink")}{" "}
                  <ArrowUpRight
                    className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </Link>
                <SourceNote>{t("anchorsNote")}</SourceNote>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
