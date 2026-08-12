/**
 * Dnešní zápis — kompaktní rubrika titulní strany (moonshot 3A, teaser only).
 * Ukáže poslední zapsaný den Deníku republiky: datum, počet zápisů ve feedovém
 * výřezu a první řádky.
 *
 * ── SERVEROVÁ, A PROTO BEZ PROBLIKNUTÍ (2026-08-12) ──────────────────────────
 * Do teď to byl klientský komponent, který si po hydrataci sám stáhl
 * `/denik/feed.json` (~58 kB, `force-dynamic`) a do té doby vypisoval „Zápis se
 * načítá…". Čtenář tedy platil druhý kompletní běh loaderu deníku V PROHLÍŽEČI
 * za data, která server drží. Teď je rubrika ČISTĚ VYKRESLOVACÍ: odečet dělá
 * server (DenikSlot.tsx) uvnitř `<Suspense>`, skořápka stránky odchází hned a
 * rubrika dopluje. Žádný `useEffect`, žádný fetch, žádná klientská hranice —
 * a všechny tři poctivé stavy (nedostupné / prázdné / den) zůstávají.
 *
 * DVA ÚDAJE DÁL PŘICHÁZEJÍ ZE SERVERU JAKO DATA:
 *  · pražský dnešek (features/denik/pragueDay.ts) — podle něj se pozná, jestli
 *    je poslední zápis „dnešní"; UTC den prohlížeče byl přesně ta chyba, kvůli
 *    které ten modul vznikl. Rozhodnutí padne v DenikSlotu, sem doteče jako
 *    `isToday`;
 *  · `feedCap` — FEED_ENTRIES, strop strojového výřezu. Počet zápisů dne je
 *    počet V TOM VÝŘEZU, ne za celý den, a strop se přiznává vedle čísla.
 *
 * Copy jde z katalogu (`landing.denik.*`) — hlídá features/landing/hardcodedCopy.test.ts.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import { landingIntl } from "../serverIntl";

/** Jeden řádek dne — věta deníku už PŘELOŽENÁ (klíč + parametry řeší slot). */
export interface TeaserTitle {
  /** Deterministické id záznamu — veřejná adresa řádku ve feedu, tedy i React key. */
  id: string;
  text: string;
}

export interface TeaserDay {
  /** `YYYY-MM-DD` posledního zapsaného dne. */
  date: string;
  /** Kolik zápisů ten den nese ve výřezu seříznutém na FEED_ENTRIES. */
  count: number;
  /** První řádky dne. */
  titles: TeaserTitle[];
}

/** Co rubrika umí vyslovit. Tři stavy, každý s vlastní větou — nikdy ticho. */
export type TeaserState =
  | { kind: "unavailable" }
  | { kind: "empty" }
  | { kind: "day"; day: TeaserDay; isToday: boolean };

export default async function DenikTeaser({
  state,
  feedCap,
}: {
  state: TeaserState;
  feedCap: number;
}) {
  const { t, f } = await landingIntl();

  return (
    <section aria-label={t("denik.regionLabel")} className="border-t-4 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep">
              {state.kind === "day" && !state.isToday ? t("denik.eyebrowLatest") : t("denik.eyebrowToday")}
            </p>
            <h2 className="mt-1 text-3xl font-black uppercase tracking-tight sm:text-4xl">
              {t("denik.title")}<span className="text-signal">.</span>
            </h2>
          </div>
          <Link
            href="/denik"
            className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            {t("denik.readLink")}{" "}
            <ArrowUpRight
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </Link>
        </div>

        {state.kind === "unavailable" && (
          <p className="mt-4 max-w-2xl text-sm text-steel-aa">{t("denik.unavailable")}</p>
        )}
        {state.kind === "empty" && (
          <p className="mt-4 max-w-2xl text-sm text-steel-aa">{t("denik.empty")}</p>
        )}
        {state.kind === "day" && (
          <div className="mt-4 max-w-2xl">
            <p className="font-mono text-sm font-bold uppercase tracking-widest">
              {t("denik.dayLine", { date: f.date(state.day.date), countFmt: f.int(state.day.count) })}
            </p>
            {/* Číslo je počet ve VÝŘEZU, ne za celý den — strop se přiznává
                vedle něj, ne až v komentáři ve zdrojáku. */}
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
              {t("denik.feedCapNote", { capFmt: f.int(feedCap) })}
            </p>
            <ul className="mt-3 list-none space-y-1 border-l-4 border-ink pl-4">
              {state.day.titles.map((title) => (
                <li key={title.id} className="text-[15px] leading-relaxed">
                  {title.text}
                </li>
              ))}
              {state.day.count > state.day.titles.length && (
                <li className="font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                  {t("denik.moreInDenik")}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-4">
          {/* Čtyři vrstvy deníku, ne tři: `change_event` („zaznamenáno" — diff
              snímků ingestů) je samostatný pramen a citace ho vynechávala.
              A citace pojmenuje TO, CO SE ČTE: rubrika už nesahá na
              /denik/feed.json, čte týž loader, jaký ten feed serializuje. */}
          <SourceNote>{t("denik.source")}</SourceNote>
        </div>
      </div>
    </section>
  );
}
